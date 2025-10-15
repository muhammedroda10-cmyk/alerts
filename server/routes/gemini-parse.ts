// @ts-ignore - Assuming external library for Jalali conversion is available
// import { toGregorian } from 'jalaali-js'; // Actual external import

// WISH: Assume the library's function is available via a placeholder for demonstration
// The actual implementation of these functions is assumed to be in the JALALIJS package
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  // Replace this placeholder with the actual import from jalaali-js:
  // const { gy, gm, gd } = toGregorian(jy, jm, jd);
  // return [gy, gm, gd];
  
  // NOTE: Keeping the logic of the original code here for a runnable example
  // BUT the intent is to rely on JALALIJS for the final product.
  const r = jalCal(jy);
  const d = g2d(r.gy, 3, r.march) + (jm <= 6 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) + (jd - 1);
  return d2g(d);
}

// Keeping the original helper functions just for the placeholder's functionality.
// In a real scenario, you'd DELETE these helpers: g2d, d2g, jalCal, j2d
function g2d(gy: number, gm: number, gd: number) {
  const a = Math.floor((gm - 8) / 6);
  const gy2 = gy + Math.floor(a) + 100100;
  const d = Math.floor(1461 * gy2 / 4) + Math.floor((153 * ((gm + 9) % 12) + 2) / 5) + gd - 34840408;
  return d - Math.floor(Math.floor(gy2 / 100) * 3 / 4) + 752;
}
function d2g(j: number): [number, number, number] {
  let j2 = 4 * j + 139361631;
  j2 = j2 + Math.floor(Math.floor(4 * j + 183187720) / 146097) * 3 / 4 * 4 - 3908;
  const i = Math.floor((j2 % 1461) / 4) * 5 + 308;
  const gd = Math.floor((i % 153) / 5) + 1;
  const gm = Math.floor(i / 153) % 12 + 1;
  const gy = Math.floor(j2 / 1461) - 100100 + Math.floor((8 - gm) / 6);
  return [gy, gm, gd];
}
function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 1;
  while (jm < bl && jy >= breaks[jm]) {
    const jump = breaks[jm] - jp;
    leapJ = leapJ + Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = breaks[jm];
    jm += 1;
  }
  const n = jy - jp;
  leapJ = leapJ + Math.floor(n / 33) * 8 + Math.floor((n % 33 + 3) / 4);
  const march = 20 + leapJ - (Math.floor((gy) / 4) - Math.floor((gy) / 100) + Math.floor((gy) / 400));
  return { gy, march };
}
function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm <= 6 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) + (jd - 1);
}
// End of placeholder functions for JALALIJS dependency

// Original imports and request schema remain...
import { RequestHandler } from "express";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1),
  apiKey: z.string().optional(),
  targetLocale: z.string().optional(),
  model: z.string().optional(),
});

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

const CURRENT_YEAR = new Date().getFullYear();

function normalizeDateToISO(input?: string): string | undefined {
  if (!input) return undefined;

  // Normalize and clean the input string
  const s = normalizeDigits(String(input)).replace(/\./g, "/").replace(/-/g, "/").trim();

  // Check for standard YYYY/MM/DD format (Gregorian or Jalali)
  const m = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (!m) return undefined;

  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);

  // **التعديل هنا: الاعتماد على السنة لتحديد ما إذا كان شمسيًا (1300-1499) أو ميلاديًا.**
  if (y >= 1300 && y <= 1499) {
    // 1. التاريخ شمسي: استخدم دالة التحويل من JALALIJS (jalaliToGregorian)
    const [gy, gm, gd] = jalaliToGregorian(y, mo, d);
    return `${gy.toString().padStart(4, "0")}-${gm.toString().padStart(2, "0")}-${gd.toString().padStart(2, "0")}`;
  }

  // 2. التاريخ ميلادي: اعتمد على جواب GEMINI API مباشرة (كما كان مطلوبًا)
  if (y > 1900 && y < 3000) {
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
    if (!key) return res.status(400).json({ error: true, message: "Gemini API key is required" });

    const instruction = [
      "You are an assistant that extracts flight alert details from any language (Arabic, Persian, English, etc.).",
      "Return a single JSON object with these fields: airline, flightNumber, date, origin, destination, type, oldTime, newTime, newFlightNumber, newAirline.",
      "Rules:",
      "- origin and destination MUST be airport IATA codes (exactly 3 uppercase letters, e.g., NJF, MHD), not city names. Deduce the correct IATA code when only city names are mentioned.",
      "- Use ISO date format yyyy-MM-dd. If the date is in (فروردين – ...), convert from shamsi to Gregorian. **The current Shamsi year is 1404.** Apply this year if no year is present in the text.",
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
      date: dateISO || "",
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