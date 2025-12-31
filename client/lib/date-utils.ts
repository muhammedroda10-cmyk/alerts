import { format } from "date-fns";
import moment from "jalali-moment";

export function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d;
}

export function toMinutes(t: string) {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
}

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

export function convertJalaliToGregorian(dateStr: string): string {
    if (!dateStr) return dateStr;

    try {
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return dateStr;

        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);

        // Check if this is a Jalali date (Shamsi year range 1300-1499)
        if (year >= 1300 && year <= 1499) {
            // Convert Jalali to Gregorian using jalali-moment
            const jDate = moment(`${year}/${month}/${day}`, "jYYYY/jMM/jDD");
            return jDate.format("YYYY-MM-DD");
        }

        // Already a Gregorian date
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
    return `${m[3]}/${m[2]}/${m[1]}`;
}

export function convertFromDisplayFormat(displayStr: string): string {
    if (!displayStr) return "";
    const m = displayStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return displayStr;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

export function equalCI(a?: string, b?: string) {
    return (
        String(a ?? "")
            .trim()
            .toUpperCase() ===
        String(b ?? "")
            .trim()
            .toUpperCase()
    );
}

export function containsKeyword(text?: string, keyword?: string): boolean {
    if (!text || !keyword) return false;
    const cleanText = String(text).trim().toUpperCase();
    const cleanKeyword = String(keyword).trim().toUpperCase();
    return cleanText.includes(cleanKeyword);
}
