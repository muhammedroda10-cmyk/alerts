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

export default function Index() {
  const [airline, setAirline] = useState("Aseman Airlines");
  const [flightNumber, setFlightNumber] = useState("6568");
  const [date, setDate] = useState("2025-09-21");
  const [origin, setOrigin] = useState("IKA");
  const [destination, setDestination] = useState("BGW");
  const [oldTime, setOldTime] = useState("19:30");
  const [newTime, setNewTime] = useState("01:00");
  const [pnr, setPnr] = useState("J5MI43");
  const [supplier, setSupplier] = useState("FLY4ALL");
  const [buyer, setBuyer] = useState("");
  const [type, setType] = useState("delay");

  const isNextDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) < toMinutes(oldTime);
  }, [oldTime, newTime]);

  const preview = useMemo(() => {
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
        pnr ? `PNR: ${pnr}` : "",
        supplier,
      ].filter(Boolean).join("\n");
    }

    if (type === "cancel") {
      return [
        "تحية طيبة..",
        `نأسف لإبلاغكم بأنه تم إلغاء رحلة ${route} بتاريخ ${dateStr} على طيران ${airline}`,
        `رقم الرحلة ${flightNumber}`,
        "يرجى التواصل لترتيب البدائل المناسبة",
        "",
        pnr ? `PNR: ${pnr}` : "",
        supplier,
      ].filter(Boolean).join("\n");
    }

    return "";
  }, [airline, buyer, date, destination, flightNumber, isNextDay, newTime, oldTime, origin, pnr, supplier, type]);

  const [history, setHistory] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("alerts-history");
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem("alerts-history", JSON.stringify(history));
  }, [history]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast({ title: "تم النسخ", description: "نص التبليغ في الحافظة" });
    } catch {
      toast({ title: "تعذر النسخ", description: "يرجى النسخ يدويًا" });
    }
  };

  const save = () => {
    const item: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      message: preview,
      summary: `${origin}-${destination} ${flightNumber} ${formatDateYMD(date)}`,
    };
    setHistory((prev) => [item, ...prev].slice(0, 50));
    toast({ title: "تم الحفظ", description: "أُضيف التبليغ إلى السجل" });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">نظام التبليغات للرحلات</h1>
          <p className="text-muted-foreground mt-2">أنشئ تبليغات دقيقة بحسب بيانات الرحلة والتغييرات.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">الروت - من</Label>
                  <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="مثال: IKA" />
                </div>
                <div>
                  <Label htmlFor="destination">الروت - إلى</Label>
                  <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="مثال: BGW" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="airline">شركة الطيران</Label>
                  <Input id="airline" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="مثال: Aseman Airlines" />
                </div>
                <div>
                  <Label htmlFor="flightNumber">رقم الرحلة</Label>
                  <Input id="flightNumber" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="مثال: 6568" />
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
                  <Label htmlFor="pnr">PNR</Label>
                  <Input id="pnr" value={pnr} onChange={(e) => setPnr(e.target.value)} placeholder="مثال: J5MI43" />
                </div>
                <div>
                  <Label htmlFor="buyer">المشتري</Label>
                  <Input id="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="اختياري" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">السبلاير / التوقيع</Label>
                  <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="مثال: FLY4ALL" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button onClick={save} variant="secondary">حفظ في السجل</Button>
              <Button onClick={copy}>نسخ النص</Button>
            </CardFooter>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>معاي��ة التبليغ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea className="min-h-[320px] leading-8" value={preview} readOnly />
              <div className="text-xs text-muted-foreground">
                تتم إضافة عبارة "(في اليوم التالي YYYY/MM/DD)" تلقائيًا إذا كان الوقت الجديد قبل القديم.
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button onClick={copy}>نسخ</Button>
            </CardFooter>
          </Card>
        </div>

        {history.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-extrabold mb-3">سجل التبليغات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((h) => (
                <Card key={h.id}>
                  <CardHeader>
                    <CardTitle className="text-base font-bold">{h.summary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">{h.message}</pre>
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
