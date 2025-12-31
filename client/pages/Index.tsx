import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings, ArrowLeftRight, Copy, Trash2, Search, CheckCircle2, AlertTriangle, RefreshCw, Languages } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// Import extracted logic and schemas
import {
  parseTrips,
  convertJalaliToGregorian,
  formatDateSafely,
  toMinutes,
  addDays,
  isValidDate,
  equalCI,
  containsKeyword,
  normalizeDateForCompare,
  checkMatch,
  Trip,
  NotificationItem
} from "@/lib/flight-logic";
import { flightFormSchema, defaultFlightValues, FlightFormData } from "@/lib/schemas";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useAppSettings } from "@/hooks/use-app-settings";

// --- Constants ---
const DEFAULT_SUPPLIER_NOTE = "🔸 ملاحظة :\nفي حال القبول أو الرفض يرجى إبلاغنا حتى الساعة 22:22\nونود التنويه أننا غير مسؤولين عن حالة الحجز بعد هذا الوقت في حال عدم وصول تأكيد من قبلكم";

export default function Index() {
  // --- Global State (Persisted/Complex) ---
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  // UI State
  const [hiddenGroups, setHiddenGroups] = useState<Record<string, boolean>>({});
  const [copiedGroups, setCopiedGroups] = useState<Record<string, boolean>>({});
  const [deliveredGroups, setDeliveredGroups] = useState<Record<string, boolean>>({});
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});

  // Supplier Notes State
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});

  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>(null);
  const [showMismatches, setShowMismatches] = useState(false);
  const [singleEdited, setSingleEdited] = useState("");
  const [singleDirty, setSingleDirty] = useState(false);

  // AI & API State
  const [aiText, setAiText] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [translatedText, setTranslatedText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isFetchingApi, setIsFetchingApi] = useState(false);

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, updateSettings } = useAppSettings();

  // --- Form Management (Zod + React Hook Form) ---
  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightFormSchema),
    defaultValues: defaultFlightValues,
    mode: "onChange"
  });

  const { watch, setValue } = form;
  const formValues = watch(); // Real-time values for memoization

  // --- Effects ---
  useEffect(() => {
    const savedHist = localStorage.getItem("alerts-history");
    if (savedHist) setHistory(JSON.parse(savedHist));
    const savedTrips = localStorage.getItem("alerts-trips");
    if (savedTrips) setTrips(JSON.parse(savedTrips));
  }, []);

  useEffect(() => { localStorage.setItem("alerts-trips", JSON.stringify(trips)); }, [trips]);
  useEffect(() => { localStorage.setItem("alerts-history", JSON.stringify(history)); }, [history]);

  // --- Logic: Alert Generation (Preserved) ---
  const isNextDay = useMemo(() => {
    if (!formValues.oldTime || !formValues.newTime) return false;
    return toMinutes(formValues.newTime) < toMinutes(formValues.oldTime);
  }, [formValues.oldTime, formValues.newTime]);

  const isPrevDay = useMemo(() => {
    if (!formValues.oldTime || !formValues.newTime) return false;
    return toMinutes(formValues.newTime) > toMinutes(formValues.oldTime);
  }, [formValues.oldTime, formValues.newTime]);

  const basePreview = useMemo(() => {
    const { origin, destination, date, airline, flightNumber, oldTime, newTime, type, newFlightNumber, newAirline } = formValues;
    const route = `${origin} -> ${destination}`;
    const dateObj = new Date(date);
    const isDateValid = isValidDate(dateObj);
    const dateFmt = formatDateSafely(date, "dd/MM/yyyy", date);

    if (type === "delay") {
      const nextDayNote = isNextDay && isDateValid
        ? ` (اليوم التالي ${formatDateSafely(addDays(date, 1).toISOString().split("T")[0], "dd/MM/yyyy")})`
        : "";
      return [
        "🟨 تبليغ تأخير رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم تأخير",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        `على متن طيران :${airline}`,
        `رقم الرحلة :${flightNumber}`,
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${nextDayNote}`,
        "",
      ].join("\n");
    }

    if (type === "advance") {
      const prevDayNote = isPrevDay && isDateValid
        ? ` (اليوم السابق ${formatDateSafely(addDays(date, -1).toISOString().split("T")[0], "dd/MM/yyyy")})`
        : "";
      return [
        "🟩 تبليغ تقديم رحلة",
        "تحية طيبة",
        "نود إعلامكم بأنه تم تقديم",
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        `على متن طيران :${airline}`,
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

    if (type === "number_time_delay" || type === "number_time_advance") {
      const isDelay = type === "number_time_delay";
      const note = isDelay && isNextDay ? ` (اليوم التالي)` : (!isDelay && isPrevDay ? ` (اليوم السابق)` : "");
      const icon = isDelay ? "🟨" : "🟩";
      const action = isDelay ? "تأخير" : "تقديم";

      return [
        `${icon} تبليغ ${action} وتغيير رقم رحلة`,
        "تحية طيبة",
        `نود إعلامكم بأنه تم ${action} وتغيير رقم`,
        `الرحلة : ${route}`,
        `بتاريخ : *${dateFmt}*`,
        `على متن طيران :${airline}`,
        `*رقم الرحلة القديم: ${flightNumber}*`,
        newFlightNumber
          ? `*رقم الرحلة الجديد : ${newFlightNumber}* ${newAirline ? ` على طيران ${newAirline}` : ""}`
          : newAirline
            ? `شركة الطيران الجديدة: ${newAirline}`
            : "",
        `الوقت القديم : *${oldTime}*`,
        `الوقت الجديد : *${newTime}*${note}`,
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
        `على متن طيران :${airline}`,
        `رقم الرحلة :${flightNumber}`,
        "",
      ].join("\n");
    }

    return "";
  }, [formValues, isNextDay, isPrevDay]);

  const previewSingle = useMemo(() => {
    return [basePreview, `رقم الحجز (PNR) : `, "", formValues.supplier || ""].join("\n");
  }, [basePreview, formValues.supplier]);

  useEffect(() => {
    if (!singleDirty) setSingleEdited(previewSingle);
  }, [previewSingle, singleDirty]);

  // --- Logic: Grouping & Matching ---
  const matchedByTitle = useMemo(() => {
    const map = new Map<string, { pnr: string; title: string; supplier: string; apiAirline?: string; booking_status?: string; warning?: string; mismatchReason?: string; originalValue?: string; time?: string }[]>();

    for (const t of trips) {
      const matchType = checkMatch(t, {
        flightNumber: formValues.flightNumber,
        date: formValues.date,
        origin: formValues.origin,
        destination: formValues.destination
      });

      if (matchType === "NONE") continue;

      let warning = undefined;
      let mismatchReason = undefined;
      let originalValue = undefined;

      if (matchType === "DATE_MISMATCH") {
        warning = "⚠️ اختلاف تاريخ";
        mismatchReason = "اختلاف تاريخ";
        originalValue = t.date ? formatDateSafely(t.date, "dd/MM/yyyy", t.date) : "تاريخ غير متوفر";
      }
      if (matchType === "FLIGHT_NO_MISMATCH") {
        warning = "⚠️ اختلاف رقم رحلة";
        mismatchReason = "اختلاف رقم رحلة";
        originalValue = t.flightNumber || "رقم غير متوفر";
      }

      if (formValues.airline && t.airline && !containsKeyword(t.airline, formValues.airline)) continue;

      // Logic: Group by PNR to ensure 1 alert per PNR (ignoring buyer/title)
      let key = t.pnr;

      // Logic: Separate by time if available
      if (t.time) {
        key = `${key}__${t.time}`;
      }

      const list = map.get(key) ?? [];

      if (!list.find((ps) => ps.pnr === t.pnr)) {
        list.push({
          pnr: t.pnr,
          title: t.title || "بدون عنوان",
          supplier: String(t.supplier || "غير معروف"),
          apiAirline: t.airline,
          booking_status: t.booking_status,
          warning,
          mismatchReason,
          originalValue,
          time: t.time
        });
      }
      map.set(key, list);
    }
    return map;
  }, [trips, formValues]);

  // Extract unique suppliers for the current match for the notes UI
  const activeSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    for (const list of matchedByTitle.values()) {
      for (const item of list) {
        suppliers.add(item.supplier);
      }
    }
    return Array.from(suppliers);
  }, [matchedByTitle]);

  const groupedNotifications = useMemo(() => {
    const items: any[] = [];
    for (const [groupKey, pnrsSuppliers] of matchedByTitle.entries()) {
      const bySupplier = new Map<string, { pnrs: string[]; title: string; apiAirline?: string; booking_status?: string; warnings: Set<string>; mismatchDetails: { reason: string; value: string }[]; time?: string }>();
      const supplierOrder: string[] = [];

      for (const { pnr, title, supplier: s, apiAirline, booking_status, warning, mismatchReason, originalValue, time } of pnrsSuppliers) {
        // Filter out mismatches if showMismatches is false
        if (!showMismatches && warning) continue;

        const sup = s || "غير معروف";
        if (!bySupplier.has(sup)) {
          bySupplier.set(sup, { pnrs: [], title, apiAirline, booking_status, warnings: new Set(), mismatchDetails: [], time });
          supplierOrder.push(sup);
        }
        const entry = bySupplier.get(sup)!;
        entry.pnrs.push(pnr);
        if (warning) entry.warnings.add(warning);
        if (mismatchReason && originalValue) {
          entry.mismatchDetails.push({ reason: mismatchReason, value: originalValue });
        }
      }

      for (const sup of supplierOrder) {
        const { pnrs: list, title, apiAirline, booking_status, warnings, mismatchDetails, time } = bySupplier.get(sup)!;

        // If all PNRs were filtered out for this supplier, skip
        if (list.length === 0) continue;

        const actualAirline = apiAirline || formValues.airline;
        const previewLines = basePreview.split("\n");
        const updatedPreview = previewLines
          .map((line) => line.includes("على متن طيران :") ? ` على متن طيران :${actualAirline}` : line)
          .join("\n");

        const lines: string[] = [updatedPreview];
        // Logic: Add note if the checkbox for this supplier is checked
        const note = (supplierNotes[sup] || DEFAULT_SUPPLIER_NOTE).trim();

        for (const p of list) lines.push(`*رقم الحجز (PNR) : ${p}*`);

        // Add warnings if any
        if (warnings.size > 0) {
          lines.push("");
          lines.push(Array.from(warnings).join(" | "));
        }

        lines.push("");

        // Only append note if selected
        if (selectedSuppliers[sup] && note) {
          lines.push(note);
        }

        // Signature: Use the form value (user input) if available, otherwise fallback to supplier name
        lines.push("", formValues.supplier || sup);

        // Construct display title: Title__Time
        const displayTitle = time ? `${title}__${time}` : title;

        items.push({
          id: `${groupKey}__${sup}`,
          groupName: displayTitle,
          supplier: sup,
          pnrs: list,
          body: lines.join("\n"),
          booking_status: booking_status,
          hasMismatch: warnings.size > 0,
          mismatchDetails: mismatchDetails.length > 0 ? mismatchDetails[0] : null, // Take the first mismatch detail for display
          time
        });
      }
    }
    return items;
  }, [matchedByTitle, basePreview, selectedSuppliers, supplierNotes, formValues.supplier, showMismatches]);

  const supplierStats = useMemo(() => {
    const stats = new Map<string, { pnrCount: number; notifications: number }>();
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
    let result = groupedNotifications;
    if (selectedSupplierFilter) {
      result = result.filter((item) => item.supplier === selectedSupplierFilter);
    }
    if (selectedTimeFilter) {
      result = result.filter((item) => item.time === selectedTimeFilter);
    }
    return result;
  }, [groupedNotifications, selectedSupplierFilter, selectedTimeFilter]);

  const availableTimes = useMemo(() => {
    const times = new Set<string>();
    for (const item of groupedNotifications) {
      if (item.time) times.add(item.time);
    }
    return Array.from(times).sort();
  }, [groupedNotifications]);

  // --- Actions ---
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ", description: "النص في الحافظة" });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast({ title: "تم النسخ", description: "تم النسخ (طريقة بديلة)" });
    }
  };

  const saveToHistory = (message: string, summary: string) => {
    const item: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      message,
      summary,
    };
    setHistory((prev) => [item, ...prev].slice(0, 100));
    toast({ title: "تم الحفظ", description: "أُضيف إلى السجل" });
  };

  // AI Parse
  const parseWithGemini = async () => {
    if (!aiText.trim()) {
      toast({ title: "نص مفقود", description: "أدخل نص التبليغ أولًا" });
      return;
    }
    try {
      setAiLoading(true);
      setValue("airline", "");
      setValue("flightNumber", "");
      setValue("date", "");
      setValue("origin", "");
      setValue("destination", "");
      setValue("oldTime", "");
      setValue("newTime", "");
      setValue("type", "delay");
      setValue("newFlightNumber", "");
      setValue("newAirline", "");
      setAiTags([]);
      setTranslatedText("");

      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          apiKey: settings.geminiKey || undefined,
          model: settings.geminiModel || undefined,
          includeTranslation: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.message || "فشل التحليل");

      const d = data.data || {};

      if (d.airline) setValue("airline", d.airline);
      if (d.flightNumber) {
        const num = String(d.flightNumber).match(/(\d{2,})/);
        setValue("flightNumber", num ? num[1] : String(d.flightNumber));
      }
      if (d.date) {
        const uiDate = String(d.date).slice(0, 10).replace(/\//g, "-");
        setValue("date", convertJalaliToGregorian(uiDate));
      }
      if (d.origin) setValue("origin", String(d.origin));
      if (d.destination) setValue("destination", String(d.destination));
      if (d.oldTime) setValue("oldTime", String(d.oldTime));
      if (d.newTime) setValue("newTime", String(d.newTime));
      if (d.newFlightNumber) setValue("newFlightNumber", String(d.newFlightNumber));
      if (d.newAirline) setValue("newAirline", String(d.newAirline));
      if (d.type) setValue("type", String(d.type) as any);

      if (d.translated) setTranslatedText(String(d.translated));
      if (Array.isArray(d.tags)) setAiTags(d.tags);

      toast({ title: "تم الاستخراج", description: "تم تعبئة الحقول من النص" });
    } catch (e: any) {
      toast({ title: "خطأ في التحليل", description: e?.message || "تعذر الاتصال", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // API Fetch
  const fetchFromApi = async () => {
    if (!settings.apiToken) {
      setSettingsOpen(true);
      toast({ title: "مطلوب التوكن", description: "أدخل Bearer Token في الإعدادات" });
      return;
    }
    setIsFetchingApi(true);
    try {
      const payload = {
        url: settings.apiUrl,
        token: settings.apiToken,
        params: {
          pagination: { page: 1, perpage: 100 },
          query: {
            bookingStatus: "all",
            paymentStatus: "default",
            seller: 0,
            departureFrom: formValues.date,
            departureTo: formValues.date,
            flightNumber: formValues.flightNumber,
            pnr: "",
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
      if (!res.ok || data.error) throw new Error(data?.message || "فشل الطلب");

      const parsed = parseTrips(JSON.stringify(data));
      setTrips(parsed);

      // Reset
      setHiddenGroups({});
      setCopiedGroups({});
      setDeliveredGroups({});
      setEditedBodies({});

      toast({ title: "تم الجلب", description: `${parsed.length} رحلة` });
    } catch (e: any) {
      toast({ title: "خطأ في الجلب", description: e?.message, variant: "destructive" });
    } finally {
      setIsFetchingApi(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20" dir="rtl">
      {/* Main Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">نظام التبليغات</h1>
          <p className="text-sm text-slate-500">إنشاء تبليغات ذكية ومجمّعة للرحلات</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Badge variant="secondary" className="hidden sm:flex">
              {history.length} تبليغ محفوظ
            </Badge>
          )}
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-4 h-4" />
          </Button>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            currentSettings={settings}
            onSave={updateSettings}
          />
        </div>
      </div>

      <div className="container mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Configuration & Input */}
        <div className="xl:col-span-4 space-y-6">
          {/* AI Parsing Card */}
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                التحليل الذكي
              </CardTitle>
              <CardDescription>الصق النص لاستخراج البيانات تلقائياً</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Textarea
                className="min-h-[100px] resize-none text-sm"
                placeholder="ألصق نص التبليغ هنا (فارسي، إنجليزي...)"
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                dir="auto"
              />

              {/* Translation Display */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  الترجمة (تلقائية)
                </Label>
                <div
                  className="min-h-[80px] w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm whitespace-pre-wrap"
                  dir="rtl"
                >
                  {translatedText || "الترجمة ستظهر هنا..."}
                </div>
              </div>

              {aiTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiTags.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-sm px-2 py-1 bg-white border-indigo-200 text-indigo-700 shadow-sm">{t}</Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={parseWithGemini}
                  disabled={aiLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  size="sm"
                >
                  {aiLoading ? "جاري التحليل..." : "تحليل واستخراج"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4">
                  {/* Row 1: Origin & Dest & Date & Flight & Airline (Merged) */}
                  <div className="flex items-end gap-2">
                    <FormField control={form.control} name="origin" render={({ field }) => (
                      <FormItem className="w-24 flex-none">
                        <FormLabel className="text-xs">من</FormLabel>
                        <FormControl><Input {...field} className="uppercase text-center font-bold tracking-wider shadow-sm" maxLength={3} dir="ltr" /></FormControl>
                      </FormItem>
                    )} />
                    <Button type="button" variant="ghost" size="icon" className="mb-1 shrink-0 text-muted-foreground" onClick={() => {
                      const o = formValues.origin;
                      setValue("origin", formValues.destination);
                      setValue("destination", o);
                    }}>
                      <ArrowLeftRight className="w-4 h-4" />
                    </Button>
                    <FormField control={form.control} name="destination" render={({ field }) => (
                      <FormItem className="w-24 flex-none">
                        <FormLabel className="text-xs">إلى</FormLabel>
                        <FormControl><Input {...field} className="uppercase text-center font-bold tracking-wider shadow-sm" maxLength={3} dir="ltr" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">التاريخ (ميلادي)</FormLabel>
                        <FormControl><Input type="date" {...field} dir="ltr" className="text-center shadow-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="flightNumber" render={({ field }) => (
                      <FormItem className="w-32 flex-none">
                        <FormLabel className="text-xs">رقم الرحلة</FormLabel>
                        <FormControl><Input {...field} dir="ltr" className="font-mono shadow-sm" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="airline" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">شركة الطيران</FormLabel>
                        <FormControl><Input {...field} dir="auto" className="shadow-sm" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {/* Row 3: Times */}
                  <div className="flex gap-3 bg-slate-50 p-3 rounded-lg border items-end">
                    <FormField control={form.control} name="oldTime" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">الوقت القديم</FormLabel>
                        <FormControl><Input {...field} placeholder="HH:MM" dir="ltr" className="text-center font-mono shadow-sm" /></FormControl>
                      </FormItem>
                    )} />
                    <ArrowLeftRight className="w-4 h-4 mb-3 text-slate-400" />
                    <FormField control={form.control} name="newTime" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">الوقت الجديد</FormLabel>
                        <FormControl><Input {...field} placeholder="HH:MM" dir="ltr" className="text-center font-mono shadow-sm" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {/* Row 4: Type & Signature */}
                  <div className="flex gap-3">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>نوع التبليغ</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right shadow-sm" dir="rtl">
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent dir="rtl">
                            <SelectItem value="delay">تأخير (Delay)</SelectItem>
                            <SelectItem value="advance">تقديم (Advance)</SelectItem>
                            <SelectItem value="cancel">إلغاء (Cancel)</SelectItem>
                            <SelectItem value="number_change">تغيير رقم (Num Change)</SelectItem>
                            <SelectItem value="number_time_delay">رقم + وقت (تأخير)</SelectItem>
                            <SelectItem value="number_time_advance">رقم + وقت (تقديم)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="supplier" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">التوقيع</FormLabel>
                        <FormControl><Input {...field} dir="auto" className="shadow-sm" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {/* Conditional Fields */}
                  {(formValues.type.includes("number") || formValues.type === "cancel") && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in duration-300">
                      <FormField control={form.control} name="newFlightNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">رقم الرحلة الجديد</FormLabel>
                          <FormControl><Input {...field} dir="ltr" className="shadow-sm" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="newAirline" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">الطيران الجديد</FormLabel>
                          <FormControl><Input {...field} dir="auto" className="shadow-sm" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button
                onClick={fetchFromApi}
                disabled={isFetchingApi || !formValues.flightNumber || !formValues.date}
                variant="secondary"
                className="w-full shadow-sm"
              >
                {isFetchingApi ? "جاري البحث..." : "بحث ومطابقة الرحلات (API)"}
              </Button>
              <div className="text-xs text-muted-foreground text-center" dir="rtl">
                سيقوم بالبحث عن {formValues.flightNumber} بتاريخ {formValues.date}
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* RIGHT COLUMN: Results & Preview */}
        <div className="xl:col-span-8 space-y-6">
          <Tabs defaultValue="grouped" className="w-full" dir="rtl">
            <TabsList className="w-full justify-start h-auto p-1 bg-slate-100">
              <TabsTrigger value="grouped" className="flex-1 py-2">التبليغات المجمعة ({filteredNotifications.length})</TabsTrigger>
              <TabsTrigger value="single" className="flex-1 py-2">تبليغ مفرد (عام)</TabsTrigger>
              <TabsTrigger value="history" className="flex-1 py-2">السجل ({history.length})</TabsTrigger>
            </TabsList>

            {/* GROUPED NOTIFICATIONS */}
            <TabsContent value="grouped" className="space-y-4 mt-4">

              {/* 1. SUPPLIER NOTES SECTION */}
              {activeSuppliers.length > 0 && (
                <Card className="border-dashed border-slate-300 bg-slate-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-slate-700">إضافة ملاحظات للموردين</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeSuppliers.map((sup) => (
                      <div key={sup} className="flex flex-col gap-2 p-3 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`sup-${sup}`}
                            checked={!!selectedSuppliers[sup]}
                            onCheckedChange={(checked) => setSelectedSuppliers(prev => ({ ...prev, [sup]: !!checked }))}
                          />
                          <Label htmlFor={`sup-${sup}`} className="font-semibold cursor-pointer">{sup}</Label>
                        </div>
                        {selectedSuppliers[sup] && (
                          <Textarea
                            placeholder="اكتب ملاحظة لهذا المورد (ستضاف للتبليغ)..."
                            value={supplierNotes[sup] ?? DEFAULT_SUPPLIER_NOTE}
                            onChange={e => setSupplierNotes(prev => ({ ...prev, [sup]: e.target.value }))}
                            className="text-xs min-h-[60px]"
                            dir="rtl"
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 2. FILTERS */}
              <div className="flex flex-col gap-3 pb-2">
                <div className="flex items-center gap-2 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                  <Checkbox
                    id="show-mismatches"
                    checked={showMismatches}
                    onCheckedChange={(c) => setShowMismatches(!!c)}
                  />
                  <Label htmlFor="show-mismatches" className="text-sm cursor-pointer select-none">
                    عرض الرحلات غير المطابقة (اختلاف تاريخ / رقم رحلة)
                  </Label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedSupplierFilter === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSupplierFilter(null)}
                  >
                    الكل
                  </Button>
                  {availableTimes.length > 0 && (
                    <div className="h-8 w-px bg-slate-300 mx-1" />
                  )}
                  {availableTimes.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTimeFilter === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTimeFilter(selectedTimeFilter === time ? null : time)}
                      className="gap-2"
                    >
                      🕒 {time}
                    </Button>
                  ))}
                  <div className="h-8 w-px bg-slate-300 mx-1" />
                  {Array.from(supplierStats.entries()).map(([sup, stats]) => (
                    <Button
                      key={sup}
                      variant={selectedSupplierFilter === sup ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSupplierFilter(sup)}
                      className="gap-2"
                    >
                      {sup}
                      <Badge variant="secondary" className="text-[10px] h-5 px-1">{stats.pnrCount}</Badge>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 3. NOTIFICATION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotifications.map((bn) => (
                  <Card
                    key={bn.id}
                    className={cn(
                      "transition-all duration-200",
                      hiddenGroups[bn.id] && "opacity-40 grayscale",
                      bn.hasMismatch ? "bg-red-50 border-red-200" :
                        deliveredGroups[bn.id] ? "ring-2 ring-green-500 bg-green-50/30" :
                          copiedGroups[bn.id] ? "ring-1 ring-orange-300 bg-orange-50/20" : ""
                    )}
                  >
                    <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-base font-bold">{bn.groupName}</CardTitle>
                        <CardDescription className="text-xs mt-1 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {bn.supplier}
                            <Badge variant="outline">{bn.pnrs.length} PNR</Badge>
                            {bn.time && <Badge variant="secondary" className="font-mono">{bn.time}</Badge>}
                          </div>
                          {bn.hasMismatch && bn.mismatchDetails && (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {bn.mismatchDetails.reason}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {bn.booking_status && (
                        <Badge className={cn(
                          "text-[10px]",
                          bn.booking_status.includes("CANCEL") ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        )}>
                          {bn.booking_status}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pb-2">
                      <Textarea
                        className={cn(
                          "min-h-[180px] text-xs font-mono bg-white text-right",
                          bn.hasMismatch && "border-red-200 bg-red-50/50"
                        )}
                        value={editedBodies[bn.id] ?? bn.body}
                        onChange={e => setEditedBodies(prev => ({ ...prev, [bn.id]: e.target.value }))}
                        dir="rtl"
                      />
                    </CardContent>
                    <CardFooter className="pt-2 flex flex-col gap-2">
                      {bn.hasMismatch && bn.mismatchDetails && (
                        <div className="w-full text-xs text-red-600 bg-red-100/50 p-2 rounded flex items-center justify-between">
                          <span>القيمة الأصلية:</span>
                          <span className="font-mono font-bold" dir="ltr">{bn.mismatchDetails.value}</span>
                        </div>
                      )}
                      <div className="flex justify-between w-full gap-2">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400"
                            onClick={() => setHiddenGroups(prev => ({ ...prev, [bn.id]: !prev[bn.id] }))}
                          >
                            {hiddenGroups[bn.id] ? <Search className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const msg = editedBodies[bn.id] ?? bn.body;
                              copy(msg);
                              setCopiedGroups(prev => ({ ...prev, [bn.id]: true }));
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" /> نسخ
                          </Button>

                          {deliveredGroups[bn.id] ? (
                            <Button
                              size="sm"
                              disabled
                              className="bg-green-600 text-white hover:bg-green-600 opacity-100"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> تم
                            </Button>
                          ) : copiedGroups[bn.id] ? (
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => {
                                saveToHistory(editedBodies[bn.id] ?? bn.body, `${bn.groupName} | ${bn.supplier}`);
                                setDeliveredGroups(prev => ({ ...prev, [bn.id]: true }));
                              }}
                            >
                              تم التبليغ
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                saveToHistory(editedBodies[bn.id] ?? bn.body, `${bn.groupName} | ${bn.supplier}`);
                              }}
                            >
                              حفظ
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              {filteredNotifications.length === 0 && (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد رحلات مطابقة. تأكد من إدخال رقم الرحلة والتاريخ وجلب البيانات.</p>
                </div>
              )}
            </TabsContent>

            {/* SINGLE PREVIEW */}
            <TabsContent value="single" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>معاينة التبليغ العام</CardTitle>
                  <CardDescription>يستخدم للنسخ السريع دون تجميع PNR</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="min-h-[300px] font-mono text-right"
                    value={singleEdited}
                    onChange={e => {
                      setSingleEdited(e.target.value);
                      setSingleDirty(true);
                    }}
                    dir="rtl"
                  />
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button variant="outline" onClick={() => setSingleDirty(false)}>إعادة تعيين</Button>
                  <Button onClick={() => copy(singleEdited)}>نسخ النص</Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* HISTORY */}
            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.map(h => (
                    <Card key={h.id} className="bg-slate-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium leading-tight">{h.summary}</CardTitle>
                        <CardDescription className="text-[10px]">{formatDateSafely(h.createdAt, "dd/MM/yyyy HH:mm")}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs whitespace-pre-wrap text-slate-600 text-right font-sans" dir="rtl">{h.message}</pre>
                      </CardContent>
                      <CardFooter className="justify-end pt-0">
                        <Button variant="ghost" size="sm" className="text-red-500 h-6" onClick={() => setHistory(prev => prev.filter(x => x.id !== h.id))}>حذف</Button>
                        <Button variant="ghost" size="sm" className="h-6" onClick={() => copy(h.message)}>نسخ</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}