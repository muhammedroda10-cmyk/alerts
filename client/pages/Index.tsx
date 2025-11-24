import React, { useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeftRight, Settings, Loader2, Copy, Save, RefreshCw, Trash2 } from "lucide-react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import moment from "jalali-moment";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

import { flightFormSchema, FlightFormValues, defaultFlightValues } from "@/schemas/flight";
import { useAppSettings } from "@/hooks/use-app-settings";
import { SettingsDialog } from "@/components/SettingsDialog";

// --- Helper Functions ---

function convertFromDisplayFormat(displayStr: string): string {
  if (!displayStr) return "";
  const m = displayStr.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  if (!m) return displayStr;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function convertToDisplayFormat(dateStr: string): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function toMinutes(t: string) {
  if (!t) return 0;
  const [hh, mm] = t.split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function convertJalaliToGregorian(dateStr: string): string {
  if (!dateStr) return dateStr;
  try {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dateStr;
    const year = parseInt(m[1], 10);
    if (year >= 1300 && year <= 1499) {
      const jDate = moment(dateStr, "jYYYY-jMM-jDD");
      return jDate.isValid() ? jDate.format("YYYY-MM-DD") : dateStr;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// --- Types ---

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

// --- Components ---

const FlightFormFields = ({ form }: { form: UseFormReturn<FlightFormValues> }) => {
  const { watch, setValue } = form;
  const [oldTime, newTime, date] = watch(["oldTime", "newTime", "date"]);

  const isNextDay = useMemo(() => {
    if (!oldTime || !newTime) return false;
    return toMinutes(newTime) < toMinutes(oldTime);
  }, [oldTime, newTime]);

  const swapRoute = () => {
    const org = watch("origin");
    const dst = watch("destination");
    setValue("origin", dst);
    setValue("destination", org);
  };

  return (
    <div className="space-y-4">
      {/* Route & Date Row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_1.5fr] gap-4 items-end">
        <FormField
          control={form.control}
          name="origin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>من (Origin)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input {...field} className="ltr font-mono text-center uppercase" maxLength={3} />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">🛫</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pb-2 flex justify-center">
          <Button type="button" variant="ghost" size="icon" onClick={swapRoute} className="rounded-full hover:bg-secondary">
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>

        <FormField
          control={form.control}
          name="destination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>إلى (Destination)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input {...field} className="ltr font-mono text-center uppercase" maxLength={3} />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">🛬</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>التاريخ (YYYY-MM-DD)</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  className="ltr font-mono text-center"
                  type="date" // Using native date picker for better UX
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Flight Info Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="flightNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رقم الرحلة</FormLabel>
              <FormControl>
                <Input {...field} className="ltr font-mono" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="airline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>شركة الطيران</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* New Info Row (Optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="newFlightNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">رقم الرحلة الجديد (اختياري)</FormLabel>
              <FormControl>
                <Input {...field} className="ltr font-mono" placeholder="اتركه فارغاً إذا لم يتغير" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newAirline"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">شركة الطيران الجديدة (اختياري)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="اتركه فارغاً إذا لم تتغير" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Times Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="oldTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الوقت القديم (HH:MM)</FormLabel>
              <FormControl>
                <Input {...field} className="ltr font-mono text-center" type="time" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                الوقت الجديد (HH:MM)
                {isNextDay && <span className="text-xs text-red-500 ms-2 font-bold">(اليوم التالي +1)</span>}
              </FormLabel>
              <FormControl>
                <Input {...field} className="ltr font-mono text-center" type="time" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Type and Supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نوع التبليغ</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="delay">تأخير</SelectItem>
                  <SelectItem value="advance">تقديم</SelectItem>
                  <SelectItem value="cancel">إلغاء</SelectItem>
                  <SelectItem value="number_change">تغيير رقم الرحلة</SelectItem>
                  <SelectItem value="number_time_delay">تغيير رقم ووقت (تأخير)</SelectItem>
                  <SelectItem value="number_time_advance">تغيير رقم ووقت (تقديم)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="supplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>السبلاير / التوقيع</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default function Index() {
  // State
  const [aiText, setAiText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);

  // Hooks
  const { settings, updateSettings, isLoaded } = useAppSettings();
  
  // Form
  const form = useForm<FlightFormValues>({
    resolver: zodResolver(flightFormSchema),
    defaultValues: defaultFlightValues,
    mode: "onChange",
  });

  const { watch, setValue } = form;
  const formValues = watch();

  // Initial Load
  useEffect(() => {
    const savedHistory = localStorage.getItem("alerts-history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedTrips = localStorage.getItem("alerts-trips");
    if (savedTrips) setTrips(JSON.parse(savedTrips));
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem("alerts-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("alerts-trips", JSON.stringify(trips));
  }, [trips]);

  // --- Logic: Preview Generation ---
  const previewText = useMemo(() => {
    const { type, origin, destination, date, airline, flightNumber, oldTime, newTime, newFlightNumber, newAirline, supplier } = formValues;
    const route = `${origin} -> ${destination}`;
    const dateFmt = date ? format(new Date(date), "dd/MM/yyyy") : "";
    const isNextDay = toMinutes(newTime || "") < toMinutes(oldTime || "");
    const isPrevDay = toMinutes(newTime || "") > toMinutes(oldTime || "");

    let lines: string[] = [];

    switch (type) {
      case "delay":
        lines = [
          "🟨 تبليغ تأخير رحلة",
          "تحية طيبة",
          "نود إعلامكم بأنه تم تأخير",
          `الرحلة : ${route}`,
          `بتاريخ : *${dateFmt}*`,
          `على متن طيران :${airline}`,
          `رقم الرحلة :${flightNumber}`,
          `الوقت القديم : *${oldTime}*`,
          `الوقت الجديد : *${newTime}*${isNextDay ? " (اليوم التالي)" : ""}`,
        ];
        break;
      case "advance":
        lines = [
          "🟩 تبليغ تقديم رحلة",
          "تحية طيبة",
          "نود إعلامكم بأنه تم تقديم",
          `الرحلة : ${route}`,
          `بتاريخ : *${dateFmt}*`,
          `على متن طيران :${airline}`,
          `رقم الرحلة :${flightNumber}`,
          `الوقت القديم : *${oldTime}*`,
          `الوقت الجديد : *${newTime}*${isPrevDay ? " (اليوم السابق)" : ""}`,
        ];
        break;
      case "cancel":
        lines = [
          "🟥 تبليغ إلغاء رحلة",
          "تحية طيبة",
          "نود إعلامكم بأنه تم الغاء",
          `الرحلة : ${route}`,
          `بتاريخ : *${dateFmt}*`,
          `على متن طيران :${airline}`,
          `رقم الرحلة :${flightNumber}`,
        ];
        break;
      case "number_change":
        lines = [
          "تحية طيبة ...",
          `تم تغيير رقم الرحلة ${route} بتاريخ *${dateFmt}*`,
          "",
          `رقم الرحلة القديم ( *${flightNumber}* ) على طيران ${airline}`,
          newFlightNumber ? `رقم الرحلة الجديد ( *${newFlightNumber}* )${newAirline ? ` على طيران ${newAirline}` : ""}` : "",
          "يرجى إبلاغ المسافرين لطفًا",
        ];
        break;
      case "number_time_delay":
      case "number_time_advance":
        const emoji = type === "number_time_delay" ? "🟨" : "🟩";
        const typeText = type === "number_time_delay" ? "تأخير" : "تقديم";
        lines = [
          `${emoji} تبليغ ${typeText} وتغيير رقم رحلة`,
          "تحية طيبة",
          `نود إعلامكم بأنه تم ${typeText} وتغيير رقم`,
          `الرحلة : ${route}`,
          `بتاريخ : *${dateFmt}*`,
          `على متن طيران :${airline}`,
          `*رقم الرحلة القديم: ${flightNumber}*`,
          newFlightNumber ? `*رقم الرحلة الجديد : ${newFlightNumber}* ${newAirline ? ` على طيران ${newAirline}` : ""}` : "",
          `الوقت القديم : *${oldTime}*`,
          `الوقت الجديد : *${newTime}*${(type === "number_time_delay" && isNextDay) ? " (اليوم التالي)" : ""}`,
        ];
        break;
    }

    lines.push("");
    lines.push(`رقم الحجز (PNR) : `);
    lines.push("");
    lines.push(supplier || "");

    return lines.join("\n");
  }, [formValues]);

  // --- Logic: AI Parsing ---
  const parseWithGemini = async () => {
    if (!aiText.trim()) {
      toast({ variant: "destructive", title: "خطأ", description: "أدخل نص التبليغ أولاً" });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          apiKey: settings.geminiKey,
          model: settings.geminiModel,
          includeTranslation: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "فشل التحليل");

      const data = json.data;
      
      // Batch updates to form
      if (data.airline) setValue("airline", data.airline);
      if (data.flightNumber) setValue("flightNumber", String(data.flightNumber));
      if (data.date) setValue("date", convertJalaliToGregorian(data.date));
      if (data.origin) setValue("origin", data.origin);
      if (data.destination) setValue("destination", data.destination);
      if (data.oldTime) setValue("oldTime", data.oldTime);
      if (data.newTime) setValue("newTime", data.newTime);
      if (data.type) setValue("type", data.type);
      if (data.newFlightNumber) setValue("newFlightNumber", String(data.newFlightNumber));
      if (data.newAirline) setValue("newAirline", data.newAirline);

      setTranslatedText(data.translated || "");
      setAiTags(data.tags || []);
      toast({ title: "نجاح", description: "تم استخراج البيانات بنجاح" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل", description: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  // --- Logic: API Fetching ---
  const fetchTrips = async () => {
    if (!settings.apiToken) {
      toast({ variant: "destructive", title: "توكن مفقود", description: "يرجى ضبط إعدادات API" });
      setShowSettings(true);
      return;
    }
    setApiLoading(true);
    try {
      // console.log("Fetching with:", { date: formValues.date, flightNumber: formValues.flightNumber });
      const payload = {
        url: settings.apiUrl,
        token: settings.apiToken,
        params: {
          pagination: { page: 1, perpage: 100 },
          query: {
            bookingStatus: "all",
            departureFrom: formValues.date,
            departureTo: formValues.date,
            flightNumber: formValues.flightNumber,
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
      
      if (!res.ok) throw new Error(data.message || "فشل جلب الرحلات");
      
      // --- Enhanced Response Parsing ---
      // We handle multiple response shapes to be more robust.
      let rawList = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (data && Array.isArray(data.data)) {
        rawList = data.data;
      } else if (data && data.data && Array.isArray(data.data.data)) {
        // Some APIs wrap twice
        rawList = data.data.data;
      }

      console.log("Raw API Data:", rawList); // For debugging

      const parsedTrips: Trip[] = rawList.map((r: any) => {
        // Fallback for buyer name if missing
        const buyerName = r.buyer || r.customer || r.userSearchTitle || "عميل غير محدد";
        
        // Normalize PNR
        const pnr = (r.pnr || r.PNR || r.booking || "").trim();

        // Normalize Flight Number
        const flightNo = (r.flightNumber || r.flight_no || r.flight || "").trim();

        return {
          buyer: buyerName,
          title: r.userSearchTitle || "",
          pnr: pnr,
          flightNumber: flightNo,
          date: r.date || r.flightDate,
          origin: r.origin || r.from,
          destination: r.destination || r.to,
          airline: r.airline || r.flight_airline,
          supplier: r.supplier,
          booking_status: r.booking_status || r.bookingStatus,
        };
      }).filter((t: Trip) => {
        // Relaxed filtering: Accept even if flight number is missing, as long as we have a PNR
        // This helps when API returns slightly different fields
        return t.pnr && t.pnr.length > 0;
      });

      setTrips(parsedTrips);
      if (parsedTrips.length === 0) {
        toast({ variant: "warning", title: "تنبيه", description: "لم يتم العثور على رحلات مطابقة. تأكد من التاريخ ورقم الرحلة في API." });
      } else {
        toast({ title: "تم الجلب", description: `تم العثور على ${parsedTrips.length} رحلة` });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل", description: e.message });
    } finally {
      setApiLoading(false);
    }
  };

  // --- Logic: Copy & Save ---
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "تم النسخ", description: "تم نسخ النص للحافظة" });
    }).catch(() => toast({ title: "فشل", description: "تعذر النسخ" }));
  };

  const handleSave = (msg: string) => {
    const newItem: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      message: msg,
      summary: `${formValues.origin}-${formValues.destination} ${formValues.flightNumber}`,
    };
    setHistory(prev => [newItem, ...prev]);
    toast({ title: "تم الحفظ", description: "تمت الإضافة للسجل" });
  };

  if (!isLoaded) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">نظام التبليغات</h1>
            <p className="text-slate-500 mt-1">إدارة ومعالجة تبليغات الطيران الذكية</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4 ms-2" />
              الإعدادات
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: AI & Form */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. AI Parser Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  المحلل الذكي
                </CardTitle>
                <CardDescription>ألصق نص التبليغ ليقوم النظام باستخراج البيانات تلقائياً</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="مثال: Flight 6568 from IKA to BGW on 2025-09-21 has been delayed..."
                  className="min-h-[120px] resize-none text-sm"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                />
                {translatedText && (
                  <div className="p-3 bg-slate-50 rounded-md text-sm border text-slate-700">
                    <span className="font-bold block mb-1 text-xs text-slate-400">الترجمة المقترحة:</span>
                    {translatedText}
                  </div>
                )}
                {aiTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {aiTags.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t p-3 flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setAiText(""); setTranslatedText(""); setAiTags([]); }}
                  className="text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4 ms-1" />
                  مسح
                </Button>
                <Button onClick={parseWithGemini} disabled={aiLoading} className="gap-2">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تحليل واستخراج"}
                </Button>
              </CardFooter>
            </Card>

            {/* 2. Main Form Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4 border-b bg-slate-50/30">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">تفاصيل الرحلة</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchTrips} disabled={apiLoading} className="gap-2 h-8">
                    {apiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    جلب PNRs
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form className="space-y-6">
                    <FlightFormFields form={form} />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Preview & History */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 3. Live Preview Card */}
            <Card className="border-slate-200 shadow-md bg-amber-50/30 border-amber-100 sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-amber-900">معاينة التبليغ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm min-h-[200px] whitespace-pre-wrap text-sm leading-relaxed">
                  {previewText}
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 pt-0">
                <Button className="flex-1 gap-2" onClick={() => handleCopy(previewText)}>
                  <Copy className="w-4 h-4" />
                  نسخ
                </Button>
                <Button variant="secondary" className="flex-1 gap-2" onClick={() => handleSave(previewText)}>
                  <Save className="w-4 h-4" />
                  حفظ
                </Button>
              </CardFooter>
            </Card>

            {/* 4. PNRs List (If fetched) */}
            {trips.length > 0 && (
              <Card className="max-h-[400px] flex flex-col">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-sm font-medium">
                    الحجوزات المتأثرة ({trips.length})
                  </CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {trips.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded text-sm border border-transparent hover:border-slate-100 transition-colors">
                      <div>
                        <span className="font-mono font-bold text-blue-600">{t.pnr}</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span className="text-slate-700">{t.buyer}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-normal">{t.supplier}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 5. History */}
            {history.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 px-1">آخر التبليغات المحفوظة</h3>
                <div className="space-y-2">
                  {history.slice(0, 3).map(h => (
                    <div key={h.id} className="bg-white p-3 rounded border text-sm shadow-sm group relative hover:shadow-md transition-all">
                      <p className="font-semibold truncate mb-1 text-slate-800">{h.summary}</p>
                      <p className="text-xs text-slate-400">{format(new Date(h.createdAt), "HH:mm dd/MM")}</p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute left-2 top-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleCopy(h.message)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog 
        open={showSettings} 
        onOpenChange={setShowSettings}
        currentSettings={settings}
        onSave={updateSettings}
      />
    </main>
  );
}