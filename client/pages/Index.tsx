import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import moment from "jalali-moment";

interface NotificationItem {
  id: string;
  createdAt: string;
  message: string;
  summary: string;
}

interface Trip {
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

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function toMinutes(t: string) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

function formatDateSafely(
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

function formatDateYMD(dateStr: string) {
  return formatDateSafely(dateStr, "yyyy/MM/dd", dateStr);
}

function convertJalaliToGregorian(dateStr: string): string {
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

function normalizeDateForCompare(s?: string) {
  if (!s) return "";
  const m = String(s).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : String(s);
}

function convertToDisplayFormat(dateStr: string): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function convertFromDisplayFormat(displayStr: string): string {
  if (!displayStr) return "";
  const m = displayStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return displayStr;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function equalCI(a?: string, b?: string) {
  return (
    String(a ?? "")
      .trim()
      .toUpperCase() ===
    String(b ?? "")
      .trim()
      .toUpperCase()
  );
}

function containsKeyword(text?: string, keyword?: string): boolean {
  if (!text || !keyword) return false;
  const cleanText = String(text).trim().toUpperCase();
  const cleanKeyword = String(keyword).trim().toUpperCase();
  return cleanText.includes(cleanKeyword);
}

function parseTrips(raw: string): Trip[] {
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
    const json = JSON.parse(text);

    // Shape: { data: [...] }
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as any)?.data)
        ? (json as any).data
        : null;
    if (arr) {
      const out: Trip[] = [];
      for (const r of arr) {
        const status = String(
          r.booking_status ?? r.bookingStatus ?? "",
        ).toUpperCase();
        if (status === "FAILED" || status === "FAILED") continue;
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
          const tripType = String(
            r.tripType ?? r.serviceDetails?.tripType ?? "",
          ).toLowerCase();
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
          const t: Trip = {
            buyer,
            title,
            pnr,
            flightNumber: extractFlightNo(
              r.flightNumber ?? r.flight_no ?? r.flight,
            ),
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
  } catch {}

  // CSV fallback
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
    const status = (
      row["booking_status"] ||
      row["bookingStatus"] ||
      ""
    ).toUpperCase();
    if (status === "CANCELED" || status === "CANCELLED") continue;
    const title = get(
      row,
      "userSearchTitle",
      "lp_reference",
      "buyer",
      "customer",
      "client",
    );
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

export default function Index() {
  const [airline, setAirline] = useState("Aseman Airlines");
  const [flightNumber, setFlightNumber] = useState("6568");
  const [newFlightNumber, setNewFlightNumber] = useState("");
  const [newAirline, setNewAirline] = useState("");
  const [date, setDate] = useState("2025-09-21");
  const [origin, setOrigin] = useState("IKA");
  const [destination, setDestination] = useState("BGW");
  const [oldTime, setOldTime] = useState("");
  const [newTime, setNewTime] = useState("01:00");
  const [supplier, setSupplier] = useState("فريق FLY4ALL");
  const [type, setType] = useState("delay"); // delay | advance | cancel
  const [aiTags, setAiTags] = useState<string[]>([]);

  const [rawTrips, setRawTrips] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<Record<string, boolean>>({});

  // API fetch states
  const [apiUrl, setApiUrl] = useState(
    "https://accounts.fly4all.com/api/booking/flight",
  );
  const [apiToken, setApiToken] = useState("");
  const [apiDepartureFrom, setApiDepartureFrom] = useState("");
  const [apiDepartureTo, setApiDepartureTo] = useState("");
  const [apiFlightNumber, setApiFlightNumber] = useState("");
  const [apiPnr, setApiPnr] = useState("");
  const [apiPerPage, setApiPerPage] = useState(100);
  // Token persistence states
  const TOKEN_KEY = "booking_api_token";
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenCandidate, setTokenCandidate] = useState("");

  // AI parse states
  const [aiText, setAiText] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-1.5-flash-latest");
  const [aiLoading, setAiLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const GEMINI_KEY_STORAGE = "gemini_api_key";
  const GEMINI_MODEL_STORAGE = "gemini_model";

  // Settings dialog state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsApiUrl, setSettingsApiUrl] = useState(apiUrl);
  const [settingsApiToken, setSettingsApiToken] = useState(apiToken);
  const [settingsGeminiKey, setSettingsGeminiKey] = useState(geminiKey);
  const [settingsGeminiModel, setSettingsGeminiModel] = useState(geminiModel);

  // Notification/history and editable state
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [singleEdited, setSingleEdited] = useState("");
  const [singleDirty, setSingleDirty] = useState(false);


  // 1. تعريف المراجع للعناصر
  const aiTextRef = React.useRef<HTMLTextAreaElement>(null);
  const translatedTextRef = React.useRef<HTMLTextAreaElement>(null);

  // 2. دالة مساعدة لضبط الارتفاع
  const adjustHeight = (element: HTMLTextAreaElement) => {
    element.style.height = "auto"; // تصغير الارتفاع أولاً
    element.style.height = `${element.scrollHeight + 2}px`; // تكبيره بناءً على المحتوى (+2 للإطار)
  };

  // 3. مراقبة تغير نص التبليغ الأصلي
  useEffect(() => {
    if (aiTextRef.current) {
      adjustHeight(aiTextRef.current);
    }
  }, [aiText]);

  // 4. مراقبة تغير نص الترجمة
  useEffect(() => {
    if (translatedTextRef.current) {
      adjustHeight(translatedTextRef.current);
    }
  }, [translatedText]);

  const isNextDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) < toMinutes(oldTime);
  }, [oldTime, newTime]);
  const isPrevDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) > toMinutes(oldTime);
  }, [oldTime, newTime]);

  const basePreview = useMemo(() => {
    const route = `${origin} -> ${destination}`;
    const dateObj = new Date(date);
    const isDateValid = isValidDate(dateObj);
    const dateFmt = formatDateSafely(date, "dd/MM/yyyy", date);

    if (type === "delay") {
      const nextDayNote =
        isNextDay && isDateValid
          ? ` (اليوم التالي ${formatDateSafely(addDays(date, 1).toISOString().split("T")[0], "dd/MM/yyyy")})`
          : "";
      return [
        "🟨 تبليغ تأخير رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم تأخير",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        ` على متن طيران :${airline}`,
        `رقم الرحلة :${flightNumber}`,
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${nextDayNote}`,
        "",
      ].join("\n");
    }

    if (type === "advance") {
      const prevDayNote =
        isPrevDay && isDateValid
          ? ` (اليوم السابق ${formatDateSafely(addDays(date, -1).toISOString().split("T")[0], "dd/MM/yyyy")})`
          : "";
      return [
        "🟩 تبليغ تقديم رحلة",
        "تحية طيبة",
        "ود إعلامكم بأنه تم تقديم",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        ` على متن طيران :${airline}`,
        `رقم الرحلة :${flightNumber}`,
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${prevDayNote}`,
        "",
      ].join("\n");
    }

    if (type === "number_change") {
      return [
        "تحية طيبة ...",
        `تم تغيير رقم الرحلة   ${route}  بتاريخ *${dateFmt}*`,
        "",
        `رقم الرحلة القديم ( *${flightNumber}* ) على طيران ${airline}`,
        newFlightNumber
          ? `رقم الرحلة الجديد ( *${newFlightNumber}* )${newAirline ? ` على طيران ${newAirline}` : ""}`
          : newAirline
            ? `شركة الطيران الجديدة: ${newAirline}`
            : "",
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "number_time_delay") {
      const nextDayNote =
        isNextDay && isDateValid
          ? ` (اليوم التالي ${formatDateSafely(addDays(date, 1).toISOString().split("T")[0], "dd/MM/yyyy")})`
          : "";
      return [
        "🟨 تبليغ تأخير وتغيير رقم رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم تأخير وتغيير رقم",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        ` على متن طيران :${airline}`,
        `*رقم الرحلة القديم: ${flightNumber}*`,
        newFlightNumber
          ? `*رقم الرحلة الجديد : ${newFlightNumber}* ${newAirline ? ` على طيران ${newAirline}` : ""}`
          : newAirline
            ? `شركة الطيران الجديدة: ${newAirline}`
            : "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${nextDayNote}`,
        "",
      ].join("\n");
    }

    if (type === "number_time_advance") {
      const prevDayNote =
        isPrevDay && isDateValid
          ? ` (اليوم السابق ${formatDateSafely(addDays(date, -1).toISOString().split("T")[0], "dd/MM/yyyy")})`
          : "";
      return [
        "🟩 تبليغ تقديم وتغيير رقم رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم تقديم وتغيير رقم",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        ` على متن طيران :${airline}`,
        `*رقم الرحلة القديم: ${flightNumber}*`,
        newFlightNumber
          ? `*رقم الرحلة الجديد : ${newFlightNumber}* ${newAirline ? ` على طيران ${newAirline}` : ""}`
          : newAirline
            ? `شركة الطيران الجديدة: ${newAirline}`
            : "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${prevDayNote}`,
        "",
      ].join("\n");
    }

    if (type === "cancel") {
      return [
        "🟥 تبليغ إلغاء رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم الغاء",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        ` على متن طيران :${airline}`,
        `رقم الرحلة :${flightNumber}`,
        "",
      ].join("\n");
    }

    return "";
  }, [
    airline,
    newAirline,
    date,
    destination,
    flightNumber,
    newFlightNumber,
    isNextDay,
    isPrevDay,
    newTime,
    oldTime,
    origin,
    type,
  ]);

  const previewSingle = useMemo(() => {
    return [basePreview, `رقم الحجز (PNR) : `, "", supplier].join("\n");
  }, [basePreview, supplier]);

  useEffect(() => {
    if (!singleDirty) setSingleEdited(previewSingle);
  }, [previewSingle, singleDirty]);

  useEffect(() => {
    const raw = localStorage.getItem("alerts-history");
    if (raw) setHistory(JSON.parse(raw));
    const savedTrips = localStorage.getItem("alerts-trips");
    if (savedTrips) setTrips(JSON.parse(savedTrips));
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) setApiToken(savedToken);
  }, []);

  useEffect(() => {
    const savedGemini = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedGemini) setGeminiKey(savedGemini);
    const savedModel = localStorage.getItem(GEMINI_MODEL_STORAGE);
    if (savedModel) setGeminiModel(savedModel);
  }, []);

  useEffect(() => {
    if (geminiKey) localStorage.setItem(GEMINI_KEY_STORAGE, geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    if (geminiModel) localStorage.setItem(GEMINI_MODEL_STORAGE, geminiModel);
  }, [geminiModel]);

  useEffect(() => {
    localStorage.setItem("alerts-trips", JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem("alerts-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (apiToken) localStorage.setItem(TOKEN_KEY, apiToken);
  }, [apiToken]);

  useEffect(() => {
    setSettingsApiUrl(apiUrl);
    setSettingsApiToken(apiToken);
    setSettingsGeminiKey(geminiKey);
    setSettingsGeminiModel(geminiModel);
  }, [showSettingsDialog, apiUrl, apiToken, geminiKey, geminiModel]);

  const saveSettings = () => {
    setApiUrl(settingsApiUrl);
    setApiToken(settingsApiToken);
    setGeminiKey(settingsGeminiKey);
    setGeminiModel(settingsGeminiModel);
    setShowSettingsDialog(false);
    toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات" });
  };

  const copy = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast({ title: "تم النسخ", description: "النص في الحافظة" });
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          toast({ title: "تم النسخ", description: "النص في الحافظة" });
          return;
        }
        throw new Error("execCommand failed");
      } catch {
        toast({ title: "تعذر النسخ", description: "يرجى النسخ يدويًا" });
      }
    }
  };

  const save = (message: string, summary: string) => {
    const item: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      message,
      summary,
    };
    setHistory((prev) => [item, ...prev].slice(0, 100));
    toast({ title: "تم الحفظ", description: "أُضيف إلى السجل" });
  };

  const importTrips = () => {
    const parsed = parseTrips(rawTrips);
    setTrips(parsed);
    setHiddenGroups({});
    toast({ title: "تم الاستيراد", description: `${parsed.length} رحلة` });
  };

  const parseWithGemini = async () => {
    if (!aiText.trim()) {
      toast({ title: "نص مفقود", description: "أدخل نص التبليغ أولًا" });
      return;
    }
    try {
      setAiLoading(true);
      setAiTags([]);
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          apiKey: geminiKey || undefined,
          model: geminiModel || undefined,
          includeTranslation: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error)
        throw new Error(data?.message || "فشل التحليل");
      const d = data.data || {};

      if ((d.airline || "").trim()) setAirline(d.airline);
      if ((d.flightNumber || "").trim())
        setFlightNumber(String(d.flightNumber));
      if ((d.date || "").trim()) {
        const uiDate = String(d.date).slice(0, 10).replace(/\//g, "-");
        const convertedDate = convertJalaliToGregorian(uiDate);
        setDate(convertedDate);
      }
      if ((d.origin || "").trim()) setOrigin(String(d.origin));
      if ((d.destination || "").trim()) setDestination(String(d.destination));
      if ((d.oldTime || "").trim()) setOldTime(String(d.oldTime));
      if ((d.newTime || "").trim()) setNewTime(String(d.newTime));
      if ((d.newFlightNumber || "").trim())
        setNewFlightNumber(String(d.newFlightNumber));
      if ((d.newAirline || "").trim()) setNewAirline(String(d.newAirline));
      if ((d.type || "").trim()) setType(String(d.type));

      // Set translation
      if ((d.translated || "").trim()) {
        setTranslatedText(String(d.translated));
      }
      if (Array.isArray(d.tags)) {
        setAiTags(d.tags);
      }
      // Also fill API proxy fields (dates and flight number)
      if ((d.date || "").trim()) {
        const dd = String(d.date).slice(0, 10).replace(/\//g, "-");
        const convertedDate = convertJalaliToGregorian(dd);
        setApiDepartureFrom(convertedDate);
        setApiDepartureTo(convertedDate);
      }
      if ((d.flightNumber || "").trim()) {
        const num = String(d.flightNumber).match(/(\d{2,})/);
        setApiFlightNumber(num ? num[1] : String(d.flightNumber));
      }

      toast({ title: "تم الاستخراج", description: "تم تعبئة الحقول من النص" });
    } catch (e: any) {
      toast({
        title: "خطأ في التحليل",
        description: e?.message || "تعذر الاتصال",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const fetchFromApi = async () => {
    if (!apiToken) {
      setShowTokenDialog(true);
      toast({ title: "مطلوب التوكن", description: "أدخل Bearer Token" });
      return;
    }
    try {
      const payload = {
        url: apiUrl,
        token: apiToken,
        params: {
          pagination: { page: 1, perpage: apiPerPage },
          query: {
            bookingStatus: "all",
            paymentStatus: "default",
            seller: 0,
            departureFrom: apiDepartureFrom || date,
            departureTo: apiDepartureFrom || date,
            flightNumber: apiFlightNumber || flightNumber,
            pnr: apiPnr,
          },
          sort: { field: "id", sort: "desc" },
        },
      };
      const res = await fetch("/api/booking/flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (
          res.status === 401 ||
          /unauth|token|bearer/i.test(String(data?.message || ""))
        ) {
          setShowTokenDialog(true);
        }
        throw new Error(data?.message || "فشل الطلب");
      }
      const parsed = parseTrips(JSON.stringify(data));
      setTrips(parsed);
      // Auto reset states on new fetch
      setHiddenGroups({});
      setCopiedGroups({});
      setDeliveredGroups({});
      setEditedBodies({});
      toast({ title: "تم الجلب", description: `${parsed.length} رحلة` });
    } catch (e: any) {
      toast({
        title: "خطأ في الجلب",
        description: e?.message || "تعذر الاتصال",
      });
    }
  };

  type PnrSupplier = {
    pnr: string;
    supplier: string;
    apiAirline?: string;
    booking_status?: string;
  };
  const matchedByTitle = useMemo(() => {
    const map = new Map<string, PnrSupplier[]>();
    const wantDate = normalizeDateForCompare(date);
    for (const t of trips) {
      if (!t.flightNumber) continue;
      if (String(t.flightNumber).trim() !== String(flightNumber).trim())
        continue;
      if (origin && destination) {
        if (!equalCI(t.origin, origin) || !equalCI(t.destination, destination))
          continue;
      }
      if (airline && t.airline && !containsKeyword(t.airline, airline))
        continue;
      if (t.date) {
        const legDate = normalizeDateForCompare(t.date);
        if (legDate && wantDate && legDate !== wantDate) continue;
      }
      const key = String(t.title || "غير معروف").trim();
      const list = map.get(key) ?? [];
      if (!list.find((ps) => ps.pnr === t.pnr))
        list.push({
          pnr: t.pnr,
          supplier: String(t.supplier || "غير معروف"),
          apiAirline: t.airline,
          booking_status: t.booking_status,
        });
      map.set(key, list);
    }
    return map;
  }, [trips, flightNumber, origin, destination, airline, date]);

  const DEFAULT_SUPPLIER_NOTE =
    "🔸 ملاحظة :\nفي حال القبول أو الرفض يرجى إبلاغنا حتى الساعة 22:22\nونود التنويه أننا غير مسؤولين عن حالة الحجز بعد هذا الوقت في حال عدم وصول تأكيد من قبلكم";

  const [selectedSuppliers, setSelectedSuppliers] = useState<
    Record<string, boolean>
  >({});
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>(
    {},
  );
  const [copiedGroups, setCopiedGroups] = useState<Record<string, boolean>>({});
  const [deliveredGroups, setDeliveredGroups] = useState<
    Record<string, boolean>
  >({});
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<
    string | null
  >(null);

  const groupedNotifications = useMemo(() => {
    const items: {
      id: string;
      groupName: string;
      supplier: string;
      pnrs: string[];
      body: string;
      booking_status?: string;
    }[] = [];
    for (const [groupName, pnrsSuppliers] of matchedByTitle.entries()) {
      const bySupplier = new Map<
        string,
        { pnrs: string[]; apiAirline?: string; booking_status?: string }
      >();
      const supplierOrder: string[] = [];
      for (const {
        pnr,
        supplier: s,
        apiAirline,
        booking_status,
      } of pnrsSuppliers) {
        const sup = s || "غير معروف";
        if (!bySupplier.has(sup)) {
          bySupplier.set(sup, { pnrs: [], apiAirline, booking_status });
          supplierOrder.push(sup);
        }
        bySupplier.get(sup)!.pnrs.push(pnr);
      }
      for (const sup of supplierOrder) {
        const { pnrs: list, apiAirline, booking_status } = bySupplier.get(sup)!;

        // Build preview with actual airline from API (if available), otherwise use user input
        const actualAirline = apiAirline || airline;
        const previewLines = basePreview.split("\n");
        const updatedPreview = previewLines
          .map((line) => {
            if (line.includes("على متن طيران :")) {
              return ` على متن طيران :${actualAirline}`;
            }
            return line;
          })
          .join("\n");

        const lines: string[] = [updatedPreview];
        const note = (supplierNotes[sup] || DEFAULT_SUPPLIER_NOTE).trim();

        for (const p of list) lines.push(`*رقم الحجز (PNR) : ${p}*`);
        lines.push("");
        if (selectedSuppliers[sup] && note) {
          lines.push(note);
        }
        lines.push("", supplier);
        items.push({
          id: `${groupName}__${sup}`,
          groupName,
          supplier: sup,
          pnrs: list,
          body: lines.join("\n"),
          booking_status: booking_status,
        });
      }
    }
    return items;
  }, [matchedByTitle, basePreview, selectedSuppliers, supplierNotes]);

  const supplierStats = useMemo(() => {
    const stats = new Map<
      string,
      { pnrCount: number; notifications: number }
    >();
    for (const item of groupedNotifications) {
      if (!stats.has(item.supplier)) {
        stats.set(item.supplier, { pnrCount: 0, notifications: 0 });
      }
      const stat = stats.get(item.supplier)!;
      stat.pnrCount += item.pnrs.length;
      stat.notifications += 1;
    }
    return stats;
  }, [groupedNotifications]);

  const filteredNotifications = useMemo(() => {
    if (!selectedSupplierFilter) return groupedNotifications;
    return groupedNotifications.filter(
      (item) => item.supplier === selectedSupplierFilter,
    );
  }, [groupedNotifications, selectedSupplierFilter]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            نظام التبليغات للرحلات
          </h1>
          <p className="text-muted-foreground mt-2">
            إنشاء تبليغات مجمّعة حسب userSearchTitle، مع مطابقة دقيقة لرقم
            الرحلة والروت وشركة الطيران والتاريخ.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 items-start">
          <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>معالجة البيانات والرحلات</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettingsDialog(true)}
                title="الإعدادات"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* القسم العلوي: النصوص والترجمة جنباً إلى جنب */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* العمود الأيمن: نص التبليغ */}
                <div className="space-y-2">
                  <Label htmlFor="aiText">نص التبليغ (الأصلي)</Label>
                  <Textarea
                    id="aiText"
                    ref={aiTextRef} // 👈 ربط المرجع
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    className="min-h-[150px] resize-none overflow-hidden" // إخفاء شريط التمرير
                    placeholder="ألصق نص التبليغ هنا بأي لغة"
                  />
                </div>

                {/* العمود الأيسر: الترجمة */}
                <div className="space-y-2 flex flex-col h-full">
                  <Label htmlFor="translatedText">الترجمة إلى العربية</Label>
                  <Textarea
                    id="translatedText"
                    ref={translatedTextRef} // 👈 ربط المرجع
                    value={translatedText}
                    readOnly
                    // تمت إزالة onChange لأن الحقل للقراءة فقط، والـ useEffect سيقوم بالمهمة
                    className="min-h-[150px] bg-muted resize-none overflow-hidden"
                    placeholder="الترجمة ستظهر هنا عند الاستخراج"
                  />
                  {/* عرض الوسوم (Badges) */}
                  {aiTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-50 rounded-md border border-dashed">
                      {aiTags.map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant={
                            tag.includes("إلغاء") ? "destructive" :
                              tag.includes("تأخير") ? "default" :
                                "secondary"
                          }
                          className="px-2 py-1 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t my-4" /> {/* خط فاصل جمالي */}
              {/* القسم السفلي: تفاصيل الرحلة ومدخلات API */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depFrom">تاريخ الرحلة</Label>
                  <Input
                    id="depFrom"
                    type="text"
                    placeholder="dd/MM/yyyy"
                    value={convertToDisplayFormat(apiDepartureFrom)}
                    onChange={(e) =>
                      setApiDepartureFrom(
                        convertFromDisplayFormat(e.target.value),
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiFlight">رقم الرحلة</Label>
                  <Input
                    id="apiFlight"
                    value={apiFlightNumber}
                    onChange={(e) => setApiFlightNumber(e.target.value)}
                    placeholder={flightNumber}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiPnr">PNR</Label>
                  <Input
                    id="apiPnr"
                    value={apiPnr}
                    onChange={(e) => setApiPnr(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perPage">Per Page</Label>
                  <Input
                    id="perPage"
                    type="number"
                    min={1}
                    max={500}
                    value={apiPerPage}
                    onChange={(e) =>
                      setApiPerPage(Number(e.target.value || 100))
                    }
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50 p-4 rounded-b-lg">
              {/* أزرار الإجراءات */}
              <Button
                onClick={parseWithGemini}
                disabled={aiLoading}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {aiLoading ? "جاري التحليل..." : "تحليل التبليغ (AI)"}
              </Button>

              <Button
                onClick={fetchFromApi}
                disabled={!apiFlightNumber.trim() || !apiDepartureFrom.trim()}
                className="w-full sm:w-auto"
              >
                تحميل الرحلات من (API)
              </Button>
            </CardFooter>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-end gap-4">
                <div>
                  <Label htmlFor="origin">الروت - من</Label>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 25 24"
                    class="w-[20px] h-[20px] md:w-[24px] md:h-[24px] ltr:scale-x-[-1] "
                  >
                    <g
                      fill="currentColor"
                      clip-path="url(#flight-departure_svg__clip0_7958_25077)"
                    >
                      <path d="M2.25 20h21a.75.75 0 0 0 0-1.5h-21a.75.75 0 0 0 0 1.5M5.195 4.879l4.168 1.517 5.271-2.714c.406-.208.88-.239 1.309-.082l1.402.51a.41.41 0 0 1 .14.683L13.988 8.08l5.36 1.951c.406.148.853.123 1.24-.068l.758-.374c.4-.198.864-.224 1.285-.07l1.172.426c.276.1.36.45.159.665l-.827.882a6.32 6.32 0 0 1-4.413 1.994l-.563.018a6.3 6.3 0 0 1-2.37-.38L2.25 8.175c-.599-.218-.967-.868-.77-1.475a2.87 2.87 0 0 1 3.715-1.818zM9.062 12.26l1.315 3.12c.173.422.518.747.948.903l1.402.511a.41.41 0 0 0 .549-.431l-.316-2.685z"></path>
                    </g>
                  </svg>
                  <Input
                    id="origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  />
                </div>
                <div className="pb-1 flex items-center justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="عكس الروت"
                    title="عكس الروت"
                    onClick={() => {
                      const o = origin;
                      const d = destination;
                      setOrigin(d);
                      setDestination(o);
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="destination">الروت - إلى</Label>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 25 24"
                    class="w-[20px] h-[20px] md:w-[24px] md:h-[24px] ltr:scale-x-[-1] "
                  >
                    <path
                      fill="currentColor"
                      d="M1.75 20h21a.75.75 0 0 0 0-1.5h-21a.75.75 0 0 0 0 1.5M4.165 11.175l4.168-1.518 2.293-5.467c.177-.42.52-.749.95-.905l1.402-.51a.41.41 0 0 1 .546.432l-.566 4.767 5.36-1.951c.405-.148.732-.455.906-.85l.34-.774c.18-.41.52-.727.94-.88l1.172-.426c.276-.1.565.114.548.407l-.066 1.207a6.32 6.32 0 0 1-2.099 4.365l-.42.375c-.601.538-1.3.956-2.06 1.231L4.027 15.591c-.6.218-1.299-.044-1.539-.635a2.87 2.87 0 0 1 1.678-3.781M11.872 14.344l3.012 1.545c.405.212.878.24 1.308.083l1.402-.51a.41.41 0 0 0 .143-.683l-1.968-1.854z"
                    ></path>
                  </svg>
                  <Input
                    id="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="date">تاريخ الرحلة</Label>
                  <Input
                    id="date"
                    type="text"
                    placeholder="dd/MM/yyyy"
                    value={convertToDisplayFormat(date)}
                    onChange={(e) => {
                      const isoDate = convertFromDisplayFormat(e.target.value);
                      setDate(isoDate);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="flightNumber">رقم الرحلة</Label>
                  <Input
                    id="flightNumber"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="airline">شركة الطيران</Label>
                  <Input
                    id="airline"
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newFlightNumber">رقم الرحلة الجديد</Label>
                  <Input
                    id="newFlightNumber"
                    value={newFlightNumber}
                    onChange={(e) => setNewFlightNumber(e.target.value)}
                    placeholder="أدخل الرقم الجديد إن وُجد"
                  />
                </div>
                <div>
                  <Label htmlFor="newAirline">شركة الطيران الجديدة</Label>
                  <Input
                    id="newAirline"
                    value={newAirline}
                    onChange={(e) => setNewAirline(e.target.value)}
                    placeholder="أدخل شركة الطيران الجديدة إن وُجدت"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="oldTime">الوقت القديم (24 ساعة HH:MM)</Label>
                  <Input
                    id="oldTime"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    value={oldTime}
                    onChange={(e) => setOldTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newTime">
                    الوقت الجديد (24 ساعة)
                    {isNextDay ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        (اليوم التالي)
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="newTime"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">نوع التبليغ</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">تأخير</SelectItem>
                      <SelectItem value="advance">تقديم</SelectItem>
                      <SelectItem value="cancel">إلغاء</SelectItem>
                      <SelectItem value="number_change">
                        تغيير رقم الرحلة
                      </SelectItem>
                      <SelectItem value="number_time_delay">
                        تغيير رقم ووقت (تأخير)
                      </SelectItem>
                      <SelectItem value="number_time_advance">
                        تغيير رقم ووقت (تقديم)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="supplier">
                    السبلاير / التوقيع
                    {selectedSupplierFilter && (
                      <span className="text-xs text-muted-foreground ms-2">
                        ({supplierStats.get(selectedSupplierFilter)?.pnrCount}{" "}
                        PNR)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="supplier"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder={
                      selectedSupplierFilter || "أدخل السبلاير / التوقيع"
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardContent className="space-y-2">
              <Label>المعاينة (قابلة للتعديل)</Label>
              <Textarea
                value={singleEdited}
                onChange={(e) => {
                  setSingleEdited(e.target.value);
                  setSingleDirty(true);
                }}
                className="min-h-[180px]"
              />
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  save(
                    singleEdited,
                    `${origin}-${destination} ${flightNumber} ${formatDateYMD(date)}`,
                  );
                }}
              >
                حفظ تبليغ عام
              </Button>
              <Button variant="secondary" onClick={() => copy(singleEdited)}>
                نسخ تبليغ عام
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>التبليغات حسب الشركة</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCopiedGroups({});
                  setDeliveredGroups({});
                  setHiddenGroups({});
                  setSelectedSupplierFilter(null);
                  toast({
                    title: "تمت إعادة الضبط",
                    description: "تصفير حالات التبليغ",
                  });
                }}
              >
                تصفير الحالات
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Supplier notes controls */}
            <div>
              <h3 className="font-bold mb-4">ملاحظات الموردين</h3>
              <div className="space-y-4">
                {Array.from(
                  new Set(
                    Array.from(matchedByTitle.values())
                      .flat()
                      .map((x) => x.supplier || "غير معروف"),
                  ),
                ).map((sup) => (
                  <div key={sup} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        id={`sup-${sup}`}
                        type="checkbox"
                        checked={!!selectedSuppliers[sup]}
                        onChange={(e) =>
                          setSelectedSuppliers((m) => ({
                            ...m,
                            [sup]: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor={`sup-${sup}`} className="font-semibold">
                        {sup}
                      </Label>
                    </div>
                    <Textarea
                      placeholder="أدخل ملاحظتك هنا..."
                      value={supplierNotes[sup] ?? DEFAULT_SUPPLIER_NOTE}
                      onChange={(e) =>
                        setSupplierNotes((m) => ({
                          ...m,
                          [sup]: e.target.value,
                        }))
                      }
                      className="min-h-[120px] text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier Filter Cards */}
            {groupedNotifications.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold mb-3">الموردين</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <Button
                    variant={
                      selectedSupplierFilter === null ? "default" : "outline"
                    }
                    className="h-auto flex flex-col items-center justify-center py-3 px-2"
                    onClick={() => setSelectedSupplierFilter(null)}
                  >
                    <div className="text-lg font-bold">الكل</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {groupedNotifications.length}
                    </div>
                  </Button>
                  {Array.from(supplierStats.entries()).map(([sup, stats]) => (
                    <Button
                      key={sup}
                      variant={
                        selectedSupplierFilter === sup ? "default" : "outline"
                      }
                      className="h-auto flex flex-col items-center justify-center py-3 px-2 text-center"
                      onClick={() => setSelectedSupplierFilter(sup)}
                    >
                      <div className="text-sm font-semibold line-clamp-2">
                        {sup}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {stats.pnrCount} PNR
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {filteredNotifications.length === 0 ? (
              <p className="text-muted-foreground">
                {groupedNotifications.length === 0
                  ? 'لا توجد نتائج. استخدم "جلب من API" ثم أدخل تفاصيل المطابقة.'
                  : "لا توجد تبليغات لهذا المورد"}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredNotifications.map((bn) => (
                  <Card
                    key={bn.id}
                    className={cn(
                      hiddenGroups[bn.id] && "opacity-50",
                      deliveredGroups[bn.id]
                        ? "border-green-300 bg-green-50"
                        : copiedGroups[bn.id]
                          ? "border-orange-300 bg-orange-50"
                          : "",
                    )}
                  >
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base text-xl">
                        {bn.groupName}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({bn.pnrs.length} PNR)
                        </span>
                      </CardTitle>
                      {bn.booking_status && (
                        <Badge
                          className={
                            bn.booking_status?.toUpperCase() === "CANCELED" ||
                            bn.booking_status?.toUpperCase() === "CANCELLED"
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : bn.booking_status?.toUpperCase() === "ISSUED"
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-gray-400 text-white hover:bg-gray-500"
                          }
                        >
                          {bn.booking_status}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={editedBodies[bn.id] ?? bn.body}
                        onChange={(e) =>
                          setEditedBodies((m) => ({
                            ...m,
                            [bn.id]: e.target.value,
                          }))
                        }
                        className="min-h-[260px]"
                      />
                      <div className="mt-2 text-xs text-muted-foreground text-right flex items-center justify-end gap-2">
                        <span>{bn.supplier}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setHiddenGroups((m) => ({ ...m, [bn.id]: !m[bn.id] }))
                        }
                      >
                        {hiddenGroups[bn.id] ? "إظهار" : "إخفاء"}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const msg = editedBodies[bn.id] ?? bn.body;
                            copy(msg);
                            setCopiedGroups((m) => ({ ...m, [bn.id]: true }));
                          }}
                        >
                          نسخ
                        </Button>
                        {deliveredGroups[bn.id] ? (
                          <Button
                            disabled
                            className="bg-green-600 text-white hover:bg-green-600 cursor-default"
                          >
                            تم التبليغ
                          </Button>
                        ) : copiedGroups[bn.id] ? (
                          <Button
                            className="bg-orange-600 text-white hover:bg-orange-700"
                            onClick={() =>
                              setDeliveredGroups((m) => ({
                                ...m,
                                [bn.id]: true,
                              }))
                            }
                          >
                            تم التبليغ
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const msg = editedBodies[bn.id] ?? bn.body;
                              save(
                                msg,
                                `${bn.groupName} | ${origin}-${destination} ${flightNumber} | ${bn.supplier}`,
                              );
                            }}
                          >
                            حفظ
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {history.length > 0 && (
          <div>
            <h2 className="text-xl font-extrabold mb-3">سجل التبليغات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((h) => (
                <Card key={h.id}>
                  <CardHeader>
                    <CardTitle className="text-base font-bold">
                      {h.summary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground max-h-40 overflow-y-auto">
                      {h.message}
                    </pre>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDateSafely(
                        h.createdAt,
                        "dd/MM/yyyy HH:mm",
                        "Invalid date",
                      )}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setHistory((arr) => arr.filter((x) => x.id !== h.id))
                        }
                      >
                        حذف
                      </Button>
                      <Button size="sm" onClick={() => copy(h.message)}>
                        نسخ
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>الإعدادات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settingsApiUrl">رابط API</Label>
                <Input
                  id="settingsApiUrl"
                  value={settingsApiUrl}
                  onChange={(e) => setSettingsApiUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settingsApiToken">Bearer Token</Label>
                <Input
                  id="settingsApiToken"
                  type="password"
                  value={settingsApiToken}
                  onChange={(e) => setSettingsApiToken(e.target.value)}
                  placeholder="أدخل التوكن"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settingsGeminiKey">Gemini API Key</Label>
                <Input
                  id="settingsGeminiKey"
                  type="password"
                  value={settingsGeminiKey}
                  onChange={(e) => setSettingsGeminiKey(e.target.value)}
                  placeholder="أدخل مفتاح Gemini (اختياري)"
                />
                <p className="text-xs text-muted-foreground">
                  يُحفظ محليًا في المتصفح فقط.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settingsGeminiModel">Gemini Model</Label>
                <Input
                  id="settingsGeminiModel"
                  value={settingsGeminiModel}
                  onChange={(e) => setSettingsGeminiModel(e.target.value)}
                  placeholder="مثال: gemini-2.5-flash-latest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setShowSettingsDialog(false)}
              >
                إلغاء
              </Button>
              <Button onClick={saveSettings}>حفظ الإعدادات</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>أدخل Bearer Token</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="newToken">التوكن</Label>
              <Input
                id="newToken"
                type="password"
                value={tokenCandidate}
                onChange={(e) => setTokenCandidate(e.target.value)}
                placeholder="أدخل التوكن"
              />
              <p className="text-xs text-muted-foreground">
                سيتم حفظه في المتصفح للاستخدام القادم.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setShowTokenDialog(false)}
              >
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  if (tokenCandidate.trim()) {
                    setApiToken(tokenCandidate.trim());
                    localStorage.setItem(TOKEN_KEY, tokenCandidate.trim());
                    setShowTokenDialog(false);
                    toast({ title: "تم الحفظ", description: "حُفظ التوكن" });
                  }
                }}
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
