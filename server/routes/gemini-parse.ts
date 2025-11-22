import { RequestHandler } from "express";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1),
  apiKey: z.string().optional(),
  targetLocale: z.string().optional(),
  model: z.string().optional(),
  isTranslation: z.boolean().optional(),
  includeTranslation: z.boolean().optional(),
});

function normalizeDigits(input: string): string {
  const map: Record<string, string> = {
    "٠": "0",
    "۰": "0",
    "١": "1",
    "۱": "1",
    "٢": "2",
    "۲": "2",
    "٣": "3",
    "۳": "3",
    "٤": "4",
    "۴": "4",
    "٥": "5",
    "۵": "5",
    "٦": "6",
    "۶": "6",
    "٧": "7",
    "۷": "7",
    "٨": "8",
    "۸": "8",
    "٩": "9",
    "۹": "9",
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

const CURRENT_YEAR = new Date().getFullYear();

function normalizeDateToISO(input?: string): string | undefined {
  if (!input) return undefined;

  // Normalize and clean the input string
  const s = normalizeDigits(String(input))
    .replace(/\./g, "/")
    .replace(/-/g, "/")
    .trim();

  // Check for standard YYYY/MM/DD format (Gemini returns dates in this format)
  const m = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (!m) return undefined;

  const y = parseInt(m[1], 10),
    mo = parseInt(m[2], 10),
    d = parseInt(m[3], 10);

  // Return the date as-is in yyyy-MM-dd format
  // Do NOT convert Jalali dates here - the frontend will handle conversion using jalali-moment
  // Jalali dates will have years in range 1300-1499, Gregorian will be > 1900
  if ((y >= 1300 && y <= 1499) || (y > 1900 && y < 3000)) {
    return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }

  // Fallback for any other case
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

export const handleGeminiParse: RequestHandler = async (req, res) => {
  try {
    const parsed = RequestSchema.parse(req.body || {});
    const key = (parsed.apiKey || process.env.GEMINI_API_KEY || "").trim();
    if (!key)
      return res
        .status(400)
        .json({ error: true, message: "Gemini API key is required" });

    const isTranslation = parsed.isTranslation === true;

    if (isTranslation) {
      // Translation mode: translate text to Arabic
      const translationInstruction = [
        "You are a professional translator.",
        "Translate the following text to Arabic. Keep the original formatting and structure.",
        "If the text is already in Arabic, return it as-is.",
        "Respond with only the translated text, no explanations or metadata.",
      ].join("\n");

      const userPrompt = `Text to translate:\n\n${parsed.text}`;

      const msel = (parsed.model || "").trim();
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
        contents: [
          {
            role: "user",
            parts: [{ text: translationInstruction + "\n\n" + userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      } as const;

      let okData: any = null;
      let okText = "";
      let lastStatus = 500;
      let lastBody = "";

      for (const model of models) {
        for (const ver of ["v1beta", "v1"]) {
          const url = `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (r.ok) {
            okData = await r.json();
            okText = okData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            break;
          } else {
            lastStatus = r.status;
            lastBody = await r.text();
            if (
              !(
                r.status === 404 ||
                /NOT_FOUND|not found|unsupported/i.test(lastBody)
              )
            ) {
              break;
            }
          }
        }
        if (okData) break;
      }

      if (!okData) {
        return res
          .status(lastStatus)
          .json({ error: true, message: lastBody || "Translation request failed" });
      }

      return res.json({ translated: okText.trim() });
    }

    const hasIncludeTranslation = parsed.includeTranslation === true;

    const instruction = hasIncludeTranslation
      ? [
          "You are an assistant that extracts flight alert details from any language (Arabic, Persian, English, etc.) and translates to Arabic.",
          "Return a single JSON object with these fields: airline, flightNumber, date, origin, destination, type, oldTime, newTime, newFlightNumber, newAirline, translated.",
          "Rules:",
          "- origin and destination MUST be airport IATA codes (exactly 3 uppercase letters, e.g., NJF, MHD), not city names. Deduce the correct IATA code when only city names are mentioned.",
          "- Use date format yyyy/MM/dd (forward slashes). Do NOT convert Jalali/Shamsi dates to Gregorian. If the date is Jalali (فروردین, etc.), return it in yyyy/MM/dd format as-is. **The current Shamsi year is 1404.** Apply this year if no year is present in the text.",
          "- Use 24-hour HH:mm for times.",
          "- When you return airline Use IATA Airlines names only first airline name dont include air or airlines in it.",
          "- Normalize digits to Western numerals.",
          "- type must be one of: delay, advance, cancel, number_change, number_time_delay, number_time_advance. If unknown, use delay if a new time is provided, else empty string.",
          "- 'translated' field: Translate the entire text to Arabic. If already in Arabic, return as-is. Keep formatting and structure.",
          "- If something is missing in the text, set it to an empty string.",
          "Respond with only JSON, no explanations.",
        ].join("\n")
      : [
          "You are an assistant that extracts flight alert details from any language (Arabic, Persian, English, etc.).",
          "Return a single JSON object with these fields: airline, flightNumber, date, origin, destination, type, oldTime, newTime, newFlightNumber, newAirline.",
          "Rules:",
          "- origin and destination MUST be airport IATA codes (exactly 3 uppercase letters, e.g., NJF, MHD), not city names. Deduce the correct IATA code when only city names are mentioned.",
          "- Use date format yyyy/MM/dd (forward slashes). Do NOT convert Jalali/Shamsi dates to Gregorian. If the date is Jalali (فروردین, etc.), return it in yyyy/MM/dd format as-is. **The current Shamsi year is 1404.** Apply this year if no year is present in the text.",
          "- Use 24-hour HH:mm for times.",
          "- When you return airline Use IATA Airlines names only first airline name dont include air or airlines in it.",
          "- Normalize digits to Western numerals.",
          "- type must be one of: delay, advance, cancel, number_change, number_time_delay, number_time_advance. If unknown, use delay if a new time is provided, else empty string.",
          "- If something is missing in the text, set it to an empty string.",
          "Respond with only JSON, no explanations.",
        ].join("\n");

    const userPrompt = `Text to extract from:\n\n${parsed.text}`;

    const msel = (parsed.model || "").trim();
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
      contents: [
        { role: "user", parts: [{ text: instruction + "\n\n" + userPrompt }] },
      ],
      generationConfig: {
        temperature: 0,
      },
    } as const;

    let okData: any = null;
    let okText = "";
    let lastStatus = 500;
    let lastBody = "";

    for (const model of models) {
      for (const ver of ["v1beta", "v1"]) {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          okData = await r.json();
          okText = okData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          break;
        } else {
          lastStatus = r.status;
          lastBody = await r.text();
          if (
            !(
              r.status === 404 ||
              /NOT_FOUND|not found|unsupported/i.test(lastBody)
            )
          ) {
            // Non-recoverable error, stop trying further
            break;
          }
        }
      }
      if (okData) break;
    }

    if (!okData) {
      return res
        .status(lastStatus)
        .json({ error: true, message: lastBody || "Gemini request failed" });
    }

    const text = okText;
    const obj = extractJson(text);

    const airline = String(obj.airline || "").trim();
    const flightNumber = String(
      obj.flightNumber || obj.flight_no || obj.flight || "",
    )
      .toString()
      .trim();
    const dateISO = normalizeDateToISO(
      String(obj.date || obj.flightDate || ""),
    );
    const originRaw = String(obj.origin || obj.from || "")
      .toString()
      .trim();
    const destinationRaw = String(obj.destination || obj.to || "")
      .toString()
      .trim();

    const toIata = (s: string): string => {
      const up = (s || "").trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(up)) return up;
      const paren = up.match(/\(([A-Z]{3})\)/);
      if (paren) return paren[1];
      const code = up.match(/\b[A-Z]{3}\b/);
      if (code) return code[0];
      return up;
    };

    const origin = toIata(originRaw);
    const destination = toIata(destinationRaw);

    const rawType = String(obj.type || "").toLowerCase();
    const newTime = normalizeTime24(
      obj.newTime || obj.time || obj.new_time || "",
    );
    const oldTime = normalizeTime24(obj.oldTime || obj.old_time || "");
    const newFlightNumber = String(
      obj.newFlightNumber || obj.new_flight_number || "",
    ).trim();
    const newAirline = String(obj.newAirline || obj.new_airline || "").trim();

    const inferredType = (() => {
      const allowed = [
        "delay",
        "advance",
        "cancel",
        "number_change",
        "number_time_delay",
        "number_time_advance",
      ];
      if (allowed.includes(rawType)) return rawType;
      if (newFlightNumber && newTime) return "number_time_delay"; // default to delay if time exists
      if (newFlightNumber) return "number_change";
      if (newTime) return "delay";
      return "";
    })();

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

    if (hasIncludeTranslation) {
      result.translated = String(obj.translated || "").trim();
    }

    return res.json({ data: result, raw: text });
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: true, message: err?.message || "Invalid request" });
  }
};
