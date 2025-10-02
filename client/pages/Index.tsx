import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function toMinutes(t: string) {
  const [hh, mm] = t.split(":" ).map(Number);
  return hh * 60 + mm;
}


function formatDateYMD(dateStr: string) {
  try { return format(new Date(dateStr), "yyyy/MM/dd"); } catch { return dateStr; }
}

function normalizeDateForCompare(s?: string) {
  if (!s) return "";
  const m = String(s).match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : String(s);
}

function equalCI(a?: string, b?: string) {
  return String(a ?? "").trim().toUpperCase() === String(b ?? "").trim().toUpperCase();
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
    const arr = Array.isArray(json) ? json : Array.isArray((json as any)?.data) ? (json as any).data : null;
    if (arr) {
      const out: Trip[] = [];
      for (const r of arr) {
        const status = String(r.booking_status ?? r.bookingStatus ?? "").toUpperCase();
        if (status === "CANCELED" || status === "CANCELLED") continue;
        const title = String(
          r.userSearchTitle ?? r.lp_reference ?? (r.usersName && r.usersName[0]) ?? r.buyer ?? r.customer ?? r.client ?? ""
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
            };
            if (t.buyer && t.pnr && t.flightNumber) out.push(t);
          }
        } else {
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
  const get = (row: Record<string,string>, ...keys: string[]) => {
    for (const k of keys) if (row[k] != null) return row[k];
    return "";
  };
  const out: Trip[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string,string> = {};
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
  const [oldTime, setOldTime] = useState("19:30");
  const [newTime, setNewTime] = useState("01:00");
  const [supplier, setSupplier] = useState("FLY4ALL");
  const [type, setType] = useState("delay"); // delay | advance | cancel

  const [rawTrips, setRawTrips] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<Record<string, boolean>>({});

  // API fetch states
  const [apiUrl, setApiUrl] = useState("https://accounts.fly4all.com/api/booking/flight");
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

  // Notification/history and editable state
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [singleEdited, setSingleEdited] = useState("");
  const [singleDirty, setSingleDirty] = useState(false);

  const isNextDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) < toMinutes(oldTime);
  }, [oldTime, newTime]);
  const isPrevDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) > toMinutes(oldTime);
  }, [oldTime, newTime]);

  const basePreview = useMemo(() => {
    const route = `(*${origin} -> ${destination}*)`;
    const dateFmt = (() => {
      try { return format(new Date(date), "d/M/yyyy"); } catch { return date; }
    })();

    if (type === "delay") {
      const nextDayNote = isNextDay ? ` (اليوم التالي ${format(addDays(date, 1), "yyyy/MM/dd")})` : "";
      return [
        "تحية طيبة ...",
        `تم تأخير رحلة   ${route}  بتاريخ *${dateFmt}*`,
        `رقم الرحلة ( *${flightNumber}* ) على طيران ${airline}`,
        "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${nextDayNote}`,
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "advance") {
      const prevDayNote = isPrevDay ? ` (اليوم السابق ${format(addDays(date, -1), "yyyy/MM/dd")})` : "";
      return [
        "تحية طيبة ...",
        `تم تعجيل رحلة   ${route}  بتاريخ *${dateFmt}*`,
        `رقم الرحلة ( *${flightNumber}* ) على طيران ${airline}`,
        "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${prevDayNote}`,
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "number_change") {
      return [
        "تحية طيبة ...",
        `تم تغيير رقم الرحلة   ${route}  بتاريخ *${dateFmt}*`,
        "",
        `رقم الرحلة القديم ( *${flightNumber}* ) على طيران ${airline}`,
        newFlightNumber ? `رقم الرحلة الجديد ( *${newFlightNumber}* )${newAirline ? ` على طيران ${newAirline}` : ""}` : (newAirline ? `شركة الطيران الجديدة: ${newAirline}` : ""),
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "number_time_delay") {
      const nextDayNote = isNextDay ? ` (اليوم التالي ${format(addDays(date, 1), "yyyy/MM/dd")})` : "";
      return [
        "تحية طيبة ...",
        `تم تغيير رقم ووقت الرحلة   ${route}  بتاريخ *${dateFmt}* (تأخير)`,
        `رقم الرحلة القديم ( *${flightNumber}* ) على طيران ${airline}`,
        newFlightNumber ? `رقم الرحلة الجديد ( *${newFlightNumber}* )${newAirline ? ` على طيران ${newAirline}` : ""}` : (newAirline ? `شركة الطيران الجديدة: ${newAirline}` : ""),
        "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${nextDayNote}`,
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "number_time_advance") {
      const prevDayNote = isPrevDay ? ` (اليوم السابق ${format(addDays(date, -1), "yyyy/MM/dd")})` : "";
      return [
        "تحية طيبة ...",
        `تم تغيير رقم ووقت الرحلة   ${route}  بتاريخ *${dateFmt}* (تعجيل)`,
        `رقم الرحلة القديم ( *${flightNumber}* ) على طيران ${airline}`,
        newFlightNumber ? `رقم الرحلة الجديد ( *${newFlightNumber}* )${newAirline ? ` على طيران ${newAirline}` : ""}` : (newAirline ? `شركة الطيران الجديدة: ${newAirline}` : ""),
        "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${prevDayNote}`,
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    if (type === "cancel") {
      return [
        "تحية طيبة ...",
        `نأسف لإبلاغكم بأنه تم إلغاء رحلة   ${route}  بتاريخ *${dateFmt}*`,
        `رقم الرحلة ( *${flightNumber}* ) على طيران ${airline}`,
        "",
        "يرجى إبلاغ المسافرين لطفًا ",
        "",
      ].join("\n");
    }

    return "";
  }, [airline, newAirline, date, destination, flightNumber, newFlightNumber, isNextDay, isPrevDay, newTime, oldTime, origin, type]);

  const previewSingle = useMemo(() => {
    return [basePreview, `PNR : `, "", supplier].join("\n");
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
    localStorage.setItem("alerts-trips", JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem("alerts-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (apiToken) localStorage.setItem(TOKEN_KEY, apiToken);
  }, [apiToken]);

  const copy = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast({ title: "ت�� النسخ", description: "النص في الحافظة" });
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
    toast({ title: "تم الاستيراد", description: `${parsed.length} رح��ة` });
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
            departureTo: apiDepartureTo || date,
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
        if (res.status === 401 || /unauth|token|bearer/i.test(String(data?.message || ""))) {
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
      toast({ title: "خطأ في الجلب", description: e?.message || "تعذر الا��صال" });
    }
  };

  type PnrSupplier = { pnr: string; supplier: string };
  const matchedByTitle = useMemo(() => {
    const map = new Map<string, PnrSupplier[]>();
    const wantDate = normalizeDateForCompare(date);
    for (const t of trips) {
      if (!t.flightNumber) continue;
      if (String(t.flightNumber).trim() !== String(flightNumber).trim()) continue;
      if (origin && destination) {
        if (!equalCI(t.origin, origin) || !equalCI(t.destination, destination)) continue;
      }
      if (airline && t.airline && !equalCI(t.airline, airline)) continue;
      if (t.date) {
        const legDate = normalizeDateForCompare(t.date);
        if (legDate && wantDate && legDate !== wantDate) continue;
      }
      const key = String(t.title || "غي�� معروف").trim();
      const list = map.get(key) ?? [];
      if (!list.find((ps) => ps.pnr === t.pnr)) list.push({ pnr: t.pnr, supplier: String(t.supplier || "غير معروف") });
      map.set(key, list);
    }
    return map;
  }, [trips, flightNumber, origin, destination, airline, date]);

  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>({});
  const [copiedGroups, setCopiedGroups] = useState<Record<string, boolean>>({});
  const [deliveredGroups, setDeliveredGroups] = useState<Record<string, boolean>>({});

  const groupedNotifications = useMemo(() => {
    const items: { id: string; groupName: string; supplier: string; pnrs: string[]; body: string }[] = [];
    for (const [groupName, pnrsSuppliers] of matchedByTitle.entries()) {
      const bySupplier = new Map<string, string[]>();
      const supplierOrder: string[] = [];
      for (const { pnr, supplier: s } of pnrsSuppliers) {
        const sup = s || "غير معروف";
        if (!bySupplier.has(sup)) { bySupplier.set(sup, []); supplierOrder.push(sup); }
        bySupplier.get(sup)!.push(pnr);
      }
      for (const sup of supplierOrder) {
        const list = bySupplier.get(sup)!;
        const lines: string[] = [basePreview];
        if (selectedSuppliers[sup] && (supplierNotes[sup] || "").trim()) {
          lines.push(supplierNotes[sup].trim());
        }
        for (const p of list) lines.push(`PNR : ${p}`);
        lines.push("", supplier);
        items.push({ id: `${groupName}__${sup}`, groupName, supplier: sup, pnrs: list, body: lines.join("\n") });
      }
    }
    return items;
  }, [matchedByTitle, basePreview, selectedSuppliers, supplierNotes]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">نظام التبليغات للرحلات</h1>
          <p className="text-muted-foreground mt-2">إنشاء تبليغات مجمّعة حسب userSearchTitle، مع مطابقة دقيقة لرقم الرحلة والروت وشركة الطيران والتاريخ.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>جلب مباشر من API (Proxy)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">الرابط</Label>
                <Input id="apiUrl" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiToken">Bearer Token</Label>
                <Input id="apiToken" type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="أدخل التوكن" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="depFrom">من تاريخ</Label>
                  <Input id="depFrom" type="date" value={apiDepartureFrom} onChange={(e) => setApiDepartureFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="depTo">إلى تاريخ</Label>
                  <Input id="depTo" type="date" value={apiDepartureTo} onChange={(e) => setApiDepartureTo(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="apiFlight">رقم الرحلة</Label>
                  <Input id="apiFlight" value={apiFlightNumber} onChange={(e) => setApiFlightNumber(e.target.value)} placeholder={flightNumber} />
                </div>
                <div>
                  <Label htmlFor="apiPnr">PNR</Label>
                  <Input id="apiPnr" value={apiPnr} onChange={(e) => setApiPnr(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="perPage">Per Page</Label>
                  <Input id="perPage" type="number" min={1} max={500} value={apiPerPage} onChange={(e) => setApiPerPage(Number(e.target.value || 100))} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button onClick={fetchFromApi}>جلب من API</Button>
            </CardFooter>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <div>
                  <Label htmlFor="origin">الروت - من</Label>
                  <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </div>
                <div className="pb-1 flex items-center justify-center">
                  <Button type="button" variant="outline" size="icon" aria-label="عكس الروت" title="عكس الروت" onClick={() => { const o = origin; const d = destination; setOrigin(d); setDestination(o); }}>
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="destination">الروت - إلى</Label>
                  <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="airline">شركة الطيران</Label>
                  <Input id="airline" value={airline} onChange={(e) => setAirline(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="flightNumber">رقم الرحلة</Label>
                  <Input id="flightNumber" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">تاريخ الرحلة</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="type">نوع التبليغ</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">تأخير</SelectItem>
                      <SelectItem value="advance">تعجيل</SelectItem>
                      <SelectItem value="cancel">إلغاء</SelectItem>
                      <SelectItem value="number_change">تغيير رقم الرحلة</SelectItem>
                      <SelectItem value="number_time_delay">تغيير رقم ووقت (تأخير)</SelectItem>
                      <SelectItem value="number_time_advance">تغيير رقم ووقت (تعجيل)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="oldTime">الوقت القديم (24 ساعة HH:MM)</Label>
                  <Input id="oldTime" inputMode="numeric" placeholder="HH:MM" value={oldTime} onChange={(e) => setOldTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newTime">الوقت الجديد (24 ساعة){isNextDay ? <span className="text-xs text-muted-foreground"> (اليوم التالي)</span> : null}</Label>
                  <Input id="newTime" inputMode="numeric" placeholder="HH:MM" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newFlightNumber">رقم الرحلة الجديد</Label>
                  <Input id="newFlightNumber" value={newFlightNumber} onChange={(e) => setNewFlightNumber(e.target.value)} placeholder="أدخل الرقم الجديد إن وُجد" />
                </div>
                <div>
                  <Label htmlFor="newAirline">شركة الطيران الجديدة</Label>
                  <Input id="newAirline" value={newAirline} onChange={(e) => setNewAirline(e.target.value)} placeholder="أدخل شركة الطيران الجديدة إن وُجدت" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">السبلاير / التوقيع</Label>
                  <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardContent className="space-y-2">
              <Label>المعاينة (قابلة للتعديل)</Label>
              <Textarea value={singleEdited} onChange={(e) => { setSingleEdited(e.target.value); setSingleDirty(true); }} className="min-h-[180px]" />
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button onClick={() => { save(singleEdited, `${origin}-${destination} ${flightNumber} ${formatDateYMD(date)}`); }}>حفظ تبليغ عام</Button>
              <Button variant="secondary" onClick={() => copy(singleEdited)}>نسخ تبليغ عام</Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>التبليغات حسب userSearchTitle</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setCopiedGroups({}); setDeliveredGroups({}); setHiddenGroups({}); toast({ title: "تمت إعادة الضبط", description: "تصفير حالات التبليغ" }); }}>تصفير الحالات</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Supplier notes controls */}
            <div>
              <h3 className="font-bold mb-2">ملاحظات الموردين</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from(new Set(Array.from(matchedByTitle.values()).flat().map((x) => x.supplier || "غير معروف"))).map((sup) => (
                  <div key={sup} className="flex items-center gap-2">
                    <input id={`sup-${sup}`} type="checkbox" checked={!!selectedSuppliers[sup]} onChange={(e) => setSelectedSuppliers((m) => ({ ...m, [sup]: e.target.checked }))} />
                    <Label htmlFor={`sup-${sup}`} className="min-w-24">{sup}</Label>
                    <Input placeholder="ملاحظة لهذا المورد" value={supplierNotes[sup] || ""} onChange={(e) => setSupplierNotes((m) => ({ ...m, [sup]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            {groupedNotifications.length === 0 ? (
              <p className="text-muted-foreground">لا توجد نتائج. استخدم "جلب من API" ثم أدخل تفاصيل المطابقة.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {groupedNotifications.map((bn) => (
                  <Card key={bn.id} className={cn(
                      hiddenGroups[bn.id] && "opacity-50",
                      deliveredGroups[bn.id] ? "border-green-300 bg-green-50" : (copiedGroups[bn.id] ? "border-orange-300 bg-orange-50" : "")
                    )}>
                    <CardHeader>
                      <CardTitle className="text-base">{bn.groupName} <span className="text-xs text-muted-foreground">({bn.pnrs.length} PNR)</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea value={editedBodies[bn.id] ?? bn.body} onChange={(e) => setEditedBodies((m) => ({ ...m, [bn.id]: e.target.value }))} className="min-h-[260px]" />
                      <div className="mt-2 text-xs text-muted-foreground text-right">{bn.supplier}</div>
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                      <Button variant="secondary" onClick={() => setHiddenGroups((m) => ({ ...m, [bn.id]: !m[bn.id] }))}>
                        {hiddenGroups[bn.id] ? "إظهار" : "إخفاء"}
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => { const msg = editedBodies[bn.id] ?? bn.body; copy(msg); setCopiedGroups((m) => ({ ...m, [bn.id]: true })); }}>نسخ</Button>
                        {deliveredGroups[bn.id] ? (
                          <Button disabled className="bg-green-600 text-white hover:bg-green-600 cursor-default">تم التبليغ</Button>
                        ) : copiedGroups[bn.id] ? (
                          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => setDeliveredGroups((m) => ({ ...m, [bn.id]: true }))}>تم التبليغ</Button>
                        ) : (
                          <Button variant="outline" onClick={() => { const msg = editedBodies[bn.id] ?? bn.body; save(msg, `${bn.groupName} | ${origin}-${destination} ${flightNumber} | ${bn.supplier}`); }}>حفظ</Button>
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
                    <CardTitle className="text-base font-bold">{h.summary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground max-h-40 overflow-y-auto">{h.message}</pre>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(h.createdAt), "yyyy/MM/dd HH:mm")}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => setHistory((arr) => arr.filter((x) => x.id !== h.id))}>حذف</Button>
                      <Button size="sm" onClick={() => copy(h.message)}>نسخ</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>أدخل Bearer Token</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="newToken">التوكن</Label>
              <Input id="newToken" type="password" value={tokenCandidate} onChange={(e) => setTokenCandidate(e.target.value)} placeholder="أدخل التوكن" />
              <p className="text-xs text-muted-foreground">سيتم حفظه في المتصفح للاستخدام القادم.</p>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowTokenDialog(false)}>إلغاء</Button>
              <Button onClick={() => { if (tokenCandidate.trim()) { setApiToken(tokenCandidate.trim()); localStorage.setItem(TOKEN_KEY, tokenCandidate.trim()); setShowTokenDialog(false); toast({ title: "تم الحفظ", description: "حُفظ التوكن" }); } }}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
