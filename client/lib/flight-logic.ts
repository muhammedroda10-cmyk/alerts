
import { format } from "date-fns";
import moment from "jalali-moment";

// --- Types ---
export interface Trip {
  buyer: string;
  title: string;
  pnr: string;
  flightNumber: string;
  date?: string;
  origin?: string;
  destination?: string;
  airline?: string;
  supplier?: string;
  booking_status?: string;
}

export interface NotificationItem {
  id: string;
  createdAt: string;
  message: string;
  summary: string;
}

// --- Date Helpers ---
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDateSafely(
  dateStr: string,
  pattern: string,
  fallback?: string,
): string {
  if (!dateStr) return fallback || "";
  try {
    const date = new Date(dateStr);
    if (!isValidDate(date)) return fallback || dateStr;
    return format(date, pattern);
  } catch {
    return fallback || dateStr;
  }
}

export function formatDateYMD(dateStr: string) {
  return formatDateSafely(dateStr, "yyyy/MM/dd", dateStr);
}

export function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

export function toMinutes(t: string) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

export function convertJalaliToGregorian(dateStr: string): string {
  if (!dateStr) return dateStr;
  try {
    const m = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return dateStr;

    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);

    // Check if this is a Jalali date (Shamsi year range 1300-1499)
    if (year >= 1300 && year <= 1499) {
      const jDate = moment(`${year}/${month}/${day}`, "jYYYY/jMM/jDD");
      return jDate.format("YYYY-MM-DD");
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function normalizeDateForCompare(s?: string) {
  if (!s) return "";
  const m = String(s).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : String(s);
}

export function convertToDisplayFormat(dateStr: string): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`; // DD/MM/YYYY
}

export function convertFromDisplayFormat(displayStr: string): string {
  if (!displayStr) return "";
  const m = displayStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return displayStr;
  return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
}

export function equalCI(a?: string, b?: string) {
  return (
    String(a ?? "").trim().toUpperCase() === String(b ?? "").trim().toUpperCase()
  );
}

export function containsKeyword(text?: string, keyword?: string): boolean {
  if (!text || !keyword) return false;
  const cleanText = String(text).trim().toUpperCase();
  const cleanKeyword = String(keyword).trim().toUpperCase();
  return cleanText.includes(cleanKeyword);
}

// --- Parser ---
export function parseTrips(raw: string): Trip[] {
  const text = raw.trim();
  if (!text) return [];

  const extractFlightNo = (s: string | undefined) => {
    if (!s) return "";
    const m = String(s).match(/(\d{2,})/);
    return m ? m[1] : String(s).trim();
  };
  
  const normalizeDate = (d: string | undefined) => {
    if (!d) return undefined as unknown as string;
    const m = String(d).match(/(\d{4}[\/-]\d{2}[\/-]\d{2})/);
    return m ? m[1].replace(/-/g, "/") : String(d);
  };

  try {
    // Try JSON parsing first
    const json = JSON.parse(text);
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as any)?.data)
        ? (json as any).data
        : null;

    if (arr) {
      const out: Trip[] = [];
      for (const r of arr) {
        const status = String(r.booking_status ?? r.bookingStatus ?? "").toUpperCase();
        if (status === "FAILED") continue;
        
        const title = String(
          r.userSearchTitle ??
            r.lp_reference ??
            (r.usersName && r.usersName[0]) ??
            r.buyer ??
            r.customer ??
            r.client ??
            "",
        ).trim();
        
        const buyer = String(r.buyer ?? r.customer ?? r.client ?? title).trim();
        const pnr = String(r.pnr ?? r.PNR ?? r.booking ?? "").trim();
        const supplier = r.supplier;

        const legs: any[] = r.serviceDetails?.legsInfo ?? [];
        if (legs.length > 0) {
          const tripType = String(r.tripType ?? r.serviceDetails?.tripType ?? "").toLowerCase();
          const isOpenReturn = tripType === "openreturn";
          const legsToUse = isOpenReturn ? [legs[0]].filter(Boolean) : legs;
          
          for (const leg of legsToUse) {
            const t: Trip = {
              buyer,
              title,
              pnr,
              flightNumber: extractFlightNo(leg.airlineAndflightNumber),
              date: normalizeDate(leg.date),
              origin: leg.departureAirportAbb,
              destination: leg.arrivalAirportAbb,
              airline: leg.airline ?? r.flight_airline,
              supplier,
              booking_status: status || undefined,
            };
            if (t.buyer && t.pnr && t.flightNumber) out.push(t);
          }
        } else {
          // Fallback for flat structure
          const t: Trip = {
            buyer,
            title,
            pnr,
            flightNumber: extractFlightNo(r.flightNumber ?? r.flight_no ?? r.flight),
            date: normalizeDate(r.date ?? r.flightDate),
            origin: r.origin ?? r.from,
            destination: r.destination ?? r.to,
            airline: r.airline ?? r.flight_airline,
            supplier,
            booking_status: status || undefined,
          };
          if (t.buyer && t.pnr && t.flightNumber) out.push(t);
        }
      }
      return out;
    }
  } catch {
    // Ignore JSON error, try CSV
  }

  // CSV Parsing
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(",").map((h) => h.trim());
  const get = (row: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) if (row[k] != null) return row[k];
    return "";
  };
  
  const out: Trip[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    
    const status = (row["booking_status"] || row["bookingStatus"] || "").toUpperCase();
    if (status === "CANCELED" || status === "CANCELLED") continue;
    
    const title = get(row, "userSearchTitle", "lp_reference", "buyer", "customer", "client");
    const trip: Trip = {
      buyer: get(row, "buyer", "customer", "client") || title,
      title,
      pnr: get(row, "pnr", "PNR", "booking"),
      flightNumber: get(row, "flightNumber", "flight", "flight_no"),
      date: get(row, "date", "flightDate"),
      origin: get(row, "origin", "from"),
      destination: get(row, "destination", "to"),
      airline: get(row, "airline"),
      supplier: get(row, "supplier"),
      booking_status: status || undefined,
    };
    if (trip.buyer && trip.pnr && trip.flightNumber) out.push(trip);
  }
  return out;
}
