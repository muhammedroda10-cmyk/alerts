import { RequestHandler } from "express";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1),
  apiKey: z.string().optional(),
  targetLocale: z.string().optional(),
  model: z.string().optional(),
  isTranslation: z.boolean().optional(), // Legacy pure translation mode
  includeTranslation: z.boolean().optional(), // The combined mode
});

// --- Helpers ---

function normalizeDigits(input: string): string {
  const map: Record<string, string> = {
    "٠": "0", "۰": "0", "١": "1", "۱": "1", "٢": "2", "۲": "2",
    "٣": "3", "۳": "3", "٤": "4", "۴": "4", "٥": "5", "۵": "5",
    "٦": "6", "۶": "6", "٧": "7", "۷": "7", "٨": "8", "۸": "8",
    "٩": "9", "۹": "9",
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] || d);
}

function extractJson(text: string): any {
  const cleaned = text.trim();
  const fence = cleaned.match(/```\w*\n([\s\S]*?)```/);
  const body = fence ? fence[1] : cleaned;
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  const jsonStr =
    firstBrace >= 0 && lastBrace >= 0
      ? body.slice(firstBrace, lastBrace + 1)
      : body;
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(normalizeDigits(jsonStr));
    } catch {
      return {};
    }
  }
}

function normalizeDateToISO(input?: string): string | undefined {
  if (!input) return undefined;
  const s = normalizeDigits(String(input))
    .replace(/\./g, "/")
    .replace(/-/g, "/")
    .trim();
  const m = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (!m) return undefined;
  const y = parseInt(m[1], 10),
    mo = parseInt(m[2], 10),
    d = parseInt(m[3], 10);

  // Allow Jalali (1300-1499) or Gregorian (1900-2999)
  if ((y >= 1300 && y <= 1499) || (y > 1900 && y < 3000)) {
    return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }
  return undefined;
}

function normalizeTime24(input?: string): string | undefined {
  if (!input) return undefined;
  const s = normalizeDigits(String(input)).replace(/\s/g, "");
  const m = s.match(/(\d{1,2})[:٫.](\d{1,2})/);
  if (!m) return undefined;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

/**
 * Reusable helper to call Gemini.
 * Handles model fallback and fetch logic.
 */
async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  preferredModel?: string
): Promise<string> {
  const msel = (preferredModel || "").trim();
  const preferred = msel
    ? [msel, msel.endsWith("-latest") ? msel : `${msel}-latest`]
    : [];
  
  const models = [
    ...preferred,
    "gemini-2.0-flash",
    "gemini-2.0-flash-latest",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ];

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0 },
  } as const;

  let lastStatus = 500;
  let lastBody = "";

  for (const model of models) {
    for (const ver of ["v1beta", "v1"]) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (r.ok) {
          const data = await r.json();
          return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        } else {
          lastStatus = r.status;
          lastBody = await r.text();
          // If 404/Not Found, try next model. Otherwise, if it's a server error, maybe retry?
          // For now, we treat NOT_FOUND as continue, others as potentially fatal but we try next model anyway just in case.
           if (
              !(
                r.status === 404 ||
                /NOT_FOUND|not found|unsupported/i.test(lastBody)
              )
            ) {
             // Optional: break on strict auth errors, but continuing acts as a retry mechanism
            }
        }
      } catch (e) {
        // Network error, try next
      }
    }
  }

  throw new Error(lastBody || `Gemini request failed with status ${lastStatus}`);
}

// --- Main Handler ---

export const handleGeminiParse: RequestHandler = async (req, res) => {
  try {
    const parsed = RequestSchema.parse(req.body || {});
    const key = (parsed.apiKey || process.env.GEMINI_API_KEY || "").trim();
    if (!key) {
      return res.status(400).json({ error: true, message: "Gemini API key is required" });
    }

    // 1. Handle Pure Translation Mode (Legacy)
    if (parsed.isTranslation === true) {
      const translationInstruction = [
        "You are a professional translator.",
        "Translate the following text to Arabic. Keep the original formatting.",
        "Translate the entire input text from its original language (Persian, English, etc.) into Arabic. Even if the text looks like Arabic (e.g. Persian), you MUST translate it to proper Arabic. Ensure the string is properly escaped for JSON.",
        "If text is Arabic, return as-is.",
        "Respond ONLY with the translated text.",
      ].join("\n");

      const text = await callGeminiAPI(
        `${translationInstruction}\n\nText:\n${parsed.text}`,
        key,
        parsed.model
      );
      return res.json({ translated: text.trim() });
    }

    // 2. Prepare Prompts for Split Execution
    
    // A. Extraction Prompt (Strict JSON)
    const extractionInstruction = [
      "You are a flight analyst assistant.",
      "Extract flight details from the text into a valid JSON object.",
      "Fields: airline, flightNumber, date, origin, destination, type, oldTime, newTime, newFlightNumber, newAirline.",
      "Rules:",
      "- origin/destination: IATA codes (3 uppercase letters).",
      "- date: yyyy/MM/dd (Keep Jalali/Shamsi if present).",
      "- time: HH:mm (24h).",
      "- airline:THIS IS MANDATORY to be IATA name of airline only as single word (not a code).",
      "- type options: delay, advance, cancel, number_change, number_time_delay, number_time_advance.",
      "- If missing, use empty string.",
      "Respond with ONLY JSON.",
    ].join("\n");

    const extractionPrompt = `${extractionInstruction}\n\nText to extract:\n${parsed.text}`;

    // B. Translation Prompt (Plain Text)
    const translationInstruction = [
      "You are a professional translator.",
      "Translate the text to Arabic.",
      "Translate the entire input text from its original language (Persian, English, etc.) into Arabic. Even if the text looks like Arabic (e.g. Persian), you MUST translate it to proper Arabic. Ensure the string is properly escaped for JSON.",
      "Maintain numbers and dates exactly as they appear.",
      "Respond ONLY with the translated text.",
    ].join("\n");

    const translationPrompt = `${translationInstruction}\n\nText:\n${parsed.text}`;

    // 3. Execute Requests
    // If includeTranslation is true, we run both in parallel. Otherwise, just extraction.
    const promises: Promise<string>[] = [
      callGeminiAPI(extractionPrompt, key, parsed.model) // Index 0: Extraction
    ];

    if (parsed.includeTranslation) {
      promises.push(callGeminiAPI(translationPrompt, key, parsed.model)); // Index 1: Translation
    }

    // Wait for all requests to finish
    const results = await Promise.all(promises);
    
    const extractionRawText = results[0];
    const translationRawText = parsed.includeTranslation ? results[1] : "";

    // 4. Process Extraction Data
    const obj = extractJson(extractionRawText);

    const airline = String(obj.airline || "").trim();
    const flightNumber = String(obj.flightNumber || obj.flight_no || "").trim();
    const dateISO = normalizeDateToISO(String(obj.date || obj.flightDate || ""));
    
    const toIata = (s: string): string => {
      const up = (s || "").trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(up)) return up;
      const code = up.match(/\b[A-Z]{3}\b/);
      return code ? code[0] : up;
    };

    const origin = toIata(String(obj.origin || ""));
    const destination = toIata(String(obj.destination || ""));

    const rawType = String(obj.type || "").toLowerCase();
    const newTime = normalizeTime24(obj.newTime || obj.new_time);
    const oldTime = normalizeTime24(obj.oldTime || obj.old_time);
    const newFlightNumber = String(obj.newFlightNumber || "").trim();
    const newAirline = String(obj.newAirline || "").trim();

    // Infer type if missing
    let inferredType = rawType;
    const allowed = ["delay", "advance", "cancel", "number_change", "number_time_delay", "number_time_advance"];
    if (!allowed.includes(inferredType)) {
        if (newFlightNumber && newTime) inferredType = "number_time_delay";
        else if (newFlightNumber) inferredType = "number_change";
        else if (newTime) inferredType = "delay";
        else inferredType = "";
    }

    const result: any = {
      airline,
      flightNumber,
      date: dateISO || "",
      origin,
      destination,
      type: inferredType,
      oldTime: oldTime || "",
      newTime: newTime || "",
      newFlightNumber,
      newAirline,
    };

    // 5. Attach Translation if requested
    if (parsed.includeTranslation) {
      result.translated = translationRawText.trim();
    }

    // 6. Return Result
    return res.json({ 
        data: result, 
        // Optional: return raw outputs for debugging if needed
        raw_extraction: extractionRawText, 
        raw_translation: translationRawText 
    });

  } catch (err: any) {
    console.error("Gemini Handler Error:", err);
    return res
      .status(400)
      .json({ error: true, message: err?.message || "Invalid request" });
  }
};