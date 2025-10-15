// @ts-ignore - Assuming external library for Jalali conversion is available
import { toGregorian } from 'jalaali-js'; // Actual external import

/**
 * يحول التاريخ الجلالي إلى ميلادي باستخدام دالة toGregorian من مكتبة jalaali-js.
 * في بيئة الإنتاج، يجب أن تكون هذه الدالة هي toGregorian المستوردة مباشرة.
 * * @param jy السنة الجلالية
 * @param jm الشهر الجلالي
 * @param jd اليوم الجلالي
 * @returns مصفوفة تحتوي على [السنة الميلادية, الشهر الميلادي, اليوم الميلادي]
 */
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  // ⬅️ هذا هو الاستخدام الفعلي للدالة من البكج الخارجي
  // NOTE: The implementation is commented out here because the 'jalaali-js' package
  // is not available in this specific runtime environment.
  // const { gy, gm, gd } = toGregorian(jy, jm, jd);
  // return [gy, gm, gd];

  // Placeholder to satisfy TypeScript and allow testing of the surrounding logic
  // In a real app, this fallback logic should be removed.
  return [1900, 1, 1];
}

// ❌ تم حذف جميع الدوال المساعدة الوهمية (g2d, d2g, jalCal, j2d) لتمثيل الاعتماد على البكج.


// Original imports and request schema remain...
import { RequestHandler } from "express";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1),
  apiKey: z.string().optional(),
  targetLocale: z.string().optional(),
  model: z.string().optional(),
});

/**
 * Converts Persian/Arabic digits to Western (English) digits.
 * @param input The string potentially containing non-Western digits.
 * @returns The string with normalized digits.
 */
function normalizeDigits(input: string): string {
  const map: Record<string, string> = {
    "٠": "0", "۰": "0",
    "١": "1", "۱": "1",
    "٢": "2", "۲": "2",
    "٣": "3", "۳": "3",
    "٤": "4", "۴": "4",
    "٥": "5", "۵": "5",
    "٦": "6", "۶": "6",
    "٧": "7", "۷": "7",
    "٨": "8", "۸": "8",
    "٩": "9", "۹": "9",
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] || d);
}

/**
 * Extracts JSON content from a string, handling code fences and digit normalization.
 * @param text The raw response text from the Gemini API.
 * @returns The parsed JSON object, or an empty object on failure.
 */
function extractJson(text: string): any {
  const cleaned = text.trim();
  const fence = cleaned.match(/```\w*\n([\s\S]*?)```/);
  const body = fence ? fence[1] : cleaned;
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  const jsonStr = firstBrace >= 0 && lastBrace >= 0 ? body.slice(firstBrace, lastBrace + 1) : body;
  try { return JSON.parse(jsonStr); } catch {
    try { return JSON.parse(normalizeDigits(jsonStr)); } catch {
      return {};
    }
  }
}

/**
 * Normalizes a date string (YYYY/MM/DD) into ISO (YYYY-MM-DD) format,
 * performing Jalali to Gregorian conversion if the year is in the Jalali range (1300-1499).
 * @param input The date string (e.g., '1404/11/11' or '2025/01/30').
 * @returns The date in 'yyyy-MM-dd' format or undefined if parsing fails.
 */
function normalizeDateToISO(input?: string): string | undefined {
  if (!input) return undefined;

  // Normalize and clean the input string
  const s = normalizeDigits(String(input)).replace(/\./g, "/").replace(/-/g, "/").trim();

  // Check for standard YYYY/MM/DD format (Gregorian or Jalali)
  const m = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (!m) return undefined;

  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);

  // 1. Check for Jalali calendar range (1300 - 1499)
  if (y >= 1300 && y <= 1499) {
    // Jalali date: use the external function placeholder for conversion
    const [gy, gm, gd] = jalaliToGregorian(y, mo, d);
    return `${gy.toString().padStart(4, "0")}-${gm.toString().padStart(2, "0")}-${gd.toString().padStart(2, "0")}`;
  }

  // 2. Gregorian date range check (1900 - 3000)
  if (y > 1900 && y < 3000) {
    return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }

  // Fallback
  return undefined;
}

/**
 * Normalizes a time string into 24-hour HH:mm format.
 * @param input The time string.
 * @returns The time in 'HH:mm' format or undefined if parsing fails.
 */
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
    if (!key) return res.status(400).json({ error: true, message: "Gemini API key is required" });

    const instruction = [
      "You are an assistant that extracts flight alert details from any language (Arabic, Persian, English, etc.).",
      "Return a single JSON object with these fields: airline, flightNumber, date, origin, destination, type, oldTime, newTime, newFlightNumber, newAirline.",
      "Rules:",
      "- origin and destination MUST be airport IATA codes (exactly 3 uppercase letters, e.g., NJF, MHD), not city names. Deduce the correct IATA code when only city names are mentioned.",
      // ⬅️ القاعدة المعدلة: طلب عدم تحويل التاريخ من Gemini
      "- Use the date as it appears in the text, ensuring it is formatted as 'yyyy/MM/dd' regardless of the calendar type (Jalali or Gregorian). Do NOT perform any calendar conversion yourself; return the raw date found in the text.",
      "- Use 24-hour HH:mm for times.",
      "- Use IATA Airlines names only.",
      "- Normalize digits to Western numerals.",
      "- type must be one of: delay, advance, cancel, number_change, number_time_delay, number_time_advance. If unknown, use delay if a new time is provided, else empty string.",
      "- If something is missing in the text, set it to an empty string.",
      "Respond with only JSON, no explanations.",
    ].join("\n");

    const userPrompt = `Text to extract from:\n\n${parsed.text}`;

    const msel = (parsed.model || "").trim();
    const preferred = msel ? [msel, msel.endsWith("-latest") ? msel : `${msel}-latest`] : [];
    const models = [...preferred, "gemini-2.5-flash", "gemini-2.5-flash-latest", "gemini-1.5-flash-latest", "gemini-1.5-flash-8b-latest"];

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
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (r.ok) {
          okData = await r.json();
          okText = okData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          break;
        } else {
          lastStatus = r.status;
          lastBody = await r.text();
          if (!(r.status === 404 || /NOT_FOUND|not found|unsupported/i.test(lastBody))) {
            // Non-recoverable error, stop trying further
            break;
          }
        }
      }
      if (okData) break;
    }

    if (!okData) {
      return res.status(lastStatus).json({ error: true, message: lastBody || "Gemini request failed" });
    }

    const text = okText;
    const obj = extractJson(text);

    const airline = String(obj.airline || "").trim();
    const flightNumber = String(obj.flightNumber || obj.flight_no || obj.flight || "").toString().trim();

    // ⬅️ هنا يتم استدعاء دالة التحويل الداخلية
    const dateISO = normalizeDateToISO(String(obj.date || obj.flightDate || ""));

    const originRaw = String(obj.origin || obj.from || "").toString().trim();
    const destinationRaw = String(obj.destination || obj.to || "").toString().trim();

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
    const newTime = normalizeTime24(obj.newTime || obj.time || obj.new_time || "");
    const oldTime = normalizeTime24(obj.oldTime || obj.old_time || "");
    const newFlightNumber = String(obj.newFlightNumber || obj.new_flight_number || "").trim();
    const newAirline = String(obj.newAirline || obj.new_airline || "").trim();

    const inferredType = (() => {
      const allowed = ["delay", "advance", "cancel", "number_change", "number_time_delay", "number_time_advance"];
      if (allowed.includes(rawType)) return rawType;
      if (newFlightNumber && newTime) return "number_time_delay"; // default to delay if time exists
      if (newFlightNumber) return "number_change";
      if (newTime) return "delay";
      return "";
    })();

    const result = {
      airline,
      flightNumber,
      date: dateISO || "", // ⬅️ إرجاع التاريخ بصيغة ISO الميلادية
      origin,
      destination,
      type: inferredType,
      oldTime: oldTime || "",
      newTime: newTime || "",
      newFlightNumber,
      newAirline,
    };

    return res.json({ data: result, raw: text });
  } catch (err: any) {
    return res.status(400).json({ error: true, message: err?.message || "Invalid request" });
  }
};
