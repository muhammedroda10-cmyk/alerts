import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function periodLabel(hhmm: string) {
  const h = Number(hhmm.split(":" )[0]);
  return h < 12 ? "صباحا" : "مساءً";
}

function formatDateYMD(dateStr: string) {
  try { return format(new Date(dateStr), "yyyy/MM/dd"); } catch { return dateStr; }
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
        const buyer = String(
          r.lp_reference ?? r.userSearchTitle ?? (r.usersName && r.usersName[0]) ?? r.buyer ?? r.customer ?? r.client ?? ""
        ).trim();
        const pnr = String(r.pnr ?? r.PNR ?? r.booking ?? "").trim();
        const supplier = r.supplier;

        const legs: any[] = r.serviceDetails?.legsInfo ?? [];
        if (legs.length > 0) {
          for (const leg of legs) {
            const t: Trip = {
              buyer,
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
    const trip: Trip = {
      buyer: get(row, "buyer", "customer", "client"),
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
  const [date, setDate] = useState("2025-09-21");
  const [origin, setOrigin] = useState("IKA");
  const [destination, setDestination] = useState("BGW");
  const [oldTime, setOldTime] = useState("19:30");
  const [newTime, setNewTime] = useState("01:00");
  const [supplier, setSupplier] = useState("FLY4ALL");
  const [type, setType] = useState("delay");

  const [rawTrips, setRawTrips] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [hiddenBuyers, setHiddenBuyers] = useState<Record<string, boolean>>({});

  const isNextDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) < toMinutes(oldTime);
  }, [oldTime, newTime]);

  const basePreview = useMemo(() => {
    const route = `${origin} ${destination}`.trim();
    const dateStr = formatDateYMD(date);
    const newDateStr = isNextDay ? format(addDays(date, 1), "yyyy/MM/dd") : undefined;

    if (type === "delay") {
      return [
        "تحية طيبة..",
        `تم تأخير رحلة ${route} بتاريخ ${dateStr} على طيران ${airline}`,
        `رقم الرحلة ${flightNumber}`,
        `الوقت القديم: ${oldTime}`,
        `الوقت الجديد: ${newTime} ${periodLabel(newTime)}${isNextDay ? ` (في اليوم التالي ${newDateStr})` : ""}`,
        "يرجى ابلاغ المسافرين لطفا",
        "",
      ].join("\n");
    }

    if (type === "cancel") {
      return [
        "تحية طيبة..",
        `نأسف لإبلاغكم بأنه تم إلغاء رحلة ${route} بتاريخ ${dateStr} على طيران ${airline}`,
        `رقم الرحلة ${flightNumber}`,
        "يرجى التواصل لترتيب البدائل المناسبة",
        "",
      ].join("\n");
    }

    return "";
  }, [airline, date, destination, flightNumber, isNextDay, newTime, oldTime, origin, type]);

  const previewSingle = useMemo(() => {
    return [basePreview, supplier].filter(Boolean).join("\n");
  }, [basePreview, supplier]);

  useEffect(() => {
    const raw = localStorage.getItem("alerts-history");
    if (raw) setHistory(JSON.parse(raw));
    const savedTrips = localStorage.getItem("alerts-trips");
    if (savedTrips) setTrips(JSON.parse(savedTrips));
  }, []);

  useEffect(() => {
    localStorage.setItem("alerts-trips", JSON.stringify(trips));
  }, [trips]);

  const [history, setHistory] = useState<NotificationItem[]>([]);

  useEffect(() => {
    localStorage.setItem("alerts-history", JSON.stringify(history));
  }, [history]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ", description: "النص في الحافظة" });
    } catch {
      toast({ title: "تعذر النسخ", description: "يرجى النسخ يدويًا" });
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
    setHiddenBuyers({});
    toast({ title: "تم الاستيراد", description: `${parsed.length} رحلة` });
  };

  const matchedByBuyer = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of trips) {
      if (!t.flightNumber) continue;
      if (t.flightNumber.toString().trim() !== flightNumber.toString().trim()) continue;
      const buyerKey = t.buyer.trim();
      const list = map.get(buyerKey) ?? [];
      if (!list.includes(t.pnr)) list.push(t.pnr);
      map.set(buyerKey, list);
    }
    return map;
  }, [trips, flightNumber]);

  const buyerNotifications = useMemo(() => {
    return Array.from(matchedByBuyer.entries()).map(([buyerName, pnrs]) => {
      const body = [
        basePreview,
        ...pnrs.map((p) => `PNR: ${p}`),
        supplier,
      ].join("\n");
      return { buyerName, pnrs, body };
    });
  }, [matchedByBuyer, basePreview, supplier]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">نظام التبليغات للرحلات</h1>
          <p className="text-muted-foreground mt-2">إنشاء تبليغات مجمّعة حسب المشتري اعتمادًا على PNR المطابقة لرقم الرحلة.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">الروت - من</Label>
                  <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
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
                      <SelectItem value="cancel">إلغاء</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="oldTime">الوقت القديم</Label>
                  <Input id="oldTime" type="time" value={oldTime} onChange={(e) => setOldTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newTime">الوقت الجديد {isNextDay ? <span className="text-xs text-muted-foreground">(اليوم التالي)</span> : null}</Label>
                  <Input id="newTime" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">السبلاير / التوقيع</Label>
                  <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button onClick={() => { save(previewSingle, `${origin}-${destination} ${flightNumber} ${formatDateYMD(date)}`); }}>حفظ تبليغ عام</Button>
              <Button variant="secondary" onClick={() => copy(previewSingle)}>نسخ تبليغ عام</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>استيراد بيانات الرحلات (CSV/JSON)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={rawTrips} onChange={(e) => setRawTrips(e.target.value)} className="min-h-[220px]" placeholder='يدعم الصيغ: CSV أو JSON.\nمثال CSV:\nbuyer,pnr,flightNumber\nAhmed,ABC123,6568\nAhmed,DEF456,6568\n\nمثال JSON API:\n{ "data": [ { "lp_reference": "Ahmed", "pnr": "ABC123", "serviceDetails": { "legsInfo": [ { "airlineAndflightNumber": "EP 6568" } ] } } ] }' />
              <div className="text-xs text-muted-foreground">سيتم التجميع حسب المشتري مع مطابقة رقم الرحلة المدخل أعلاه.</div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
              <Button onClick={importTrips}>استيراد</Button>
              <Button variant="secondary" onClick={() => { setRawTrips(""); setTrips([]); }}>إزالة البيانات</Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>التبليغات حسب المشتري</CardTitle>
          </CardHeader>
          <CardContent>
            {buyerNotifications.length === 0 ? (
              <p className="text-muted-foreground">لا توجد نتائج. قم باستيراد بيانات رحلات ثم أدخل رقم الرحلة للمطابقة.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {buyerNotifications.map((bn) => (
                  <Card key={bn.buyerName} className={hiddenBuyers[bn.buyerName] ? "opacity-50" : undefined}>
                    <CardHeader>
                      <CardTitle className="text-base">{bn.buyerName} <span className="text-xs text-muted-foreground">({bn.pnrs.length} PNR)</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea readOnly value={bn.body} className="min-h-[220px]" />
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                      <Button variant="secondary" onClick={() => setHiddenBuyers((m) => ({ ...m, [bn.buyerName]: !m[bn.buyerName] }))}>
                        {hiddenBuyers[bn.buyerName] ? "إظهار" : "إخفاء"}
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => copy(bn.body)}>نسخ</Button>
                        <Button variant="outline" onClick={() => save(bn.body, `${bn.buyerName} | ${origin}-${destination} ${flightNumber}`)}>حفظ</Button>
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
                    <Button size="sm" onClick={() => navigator.clipboard.writeText(h.message)}>نسخ</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
