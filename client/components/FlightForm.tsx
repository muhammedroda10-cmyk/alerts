import React, { useRef, useEffect } from "react";
import { Settings } from "lucide-react";
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
import { convertToDisplayFormat, convertFromDisplayFormat } from "@/lib/date-utils";

interface FlightFormProps {
    aiText: string;
    setAiText: (text: string) => void;
    translatedText: string;
    aiTags: string[];
    aiLoading: boolean;
    parseWithGemini: () => void;
    fetchFromApi: () => void;
    setShowSettingsDialog: (show: boolean) => void;
    apiDepartureFrom: string;
    setApiDepartureFrom: (date: string) => void;
    apiFlightNumber: string;
    setApiFlightNumber: (num: string) => void;
    apiPnr: string;
    setApiPnr: (pnr: string) => void;
    apiPerPage: number;
    setApiPerPage: (num: number) => void;
    flightNumber: string;
}

export function FlightForm({
    aiText,
    setAiText,
    translatedText,
    aiTags,
    aiLoading,
    parseWithGemini,
    fetchFromApi,
    setShowSettingsDialog,
    apiDepartureFrom,
    setApiDepartureFrom,
    apiFlightNumber,
    setApiFlightNumber,
    apiPnr,
    setApiPnr,
    apiPerPage,
    setApiPerPage,
    flightNumber,
}: FlightFormProps) {
    const aiTextRef = useRef<HTMLTextAreaElement>(null);
    const translatedTextRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = (element: HTMLTextAreaElement) => {
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight + 2}px`;
    };

    useEffect(() => {
        if (aiTextRef.current) {
            adjustHeight(aiTextRef.current);
        }
    }, [aiText]);

    useEffect(() => {
        if (translatedTextRef.current) {
            adjustHeight(translatedTextRef.current);
        }
    }, [translatedText]);

    return (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="aiText">نص التبليغ (الأصلي)</Label>
                        <Textarea
                            id="aiText"
                            ref={aiTextRef}
                            value={aiText}
                            onChange={(e) => setAiText(e.target.value)}
                            className="min-h-[150px] resize-none overflow-hidden"
                            placeholder="ألصق نص التبليغ هنا بأي لغة"
                        />
                    </div>

                    <div className="space-y-2 flex flex-col h-full">
                        <Label htmlFor="translatedText">الترجمة إلى العربية</Label>
                        <Textarea
                            id="translatedText"
                            ref={translatedTextRef}
                            value={translatedText}
                            readOnly
                            className="min-h-[150px] bg-muted resize-none overflow-hidden"
                            placeholder="الترجمة ستظهر هنا عند الاستخراج"
                        />
                        {aiTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-50 rounded-md border border-dashed">
                                {aiTags.map((tag, idx) => (
                                    <Badge
                                        key={idx}
                                        variant={
                                            tag.includes("إلغاء")
                                                ? "destructive"
                                                : tag.includes("تأخير")
                                                    ? "default"
                                                    : "secondary"
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
                <div className="border-t my-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="depFrom">تاريخ الرحلة</Label>
                        <Input
                            id="depFrom"
                            type="text"
                            placeholder="dd/MM/yyyy"
                            value={convertToDisplayFormat(apiDepartureFrom)}
                            onChange={(e) =>
                                setApiDepartureFrom(convertFromDisplayFormat(e.target.value))
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
                            onChange={(e) => setApiPerPage(Number(e.target.value || 100))}
                        />
                    </div>
                </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50 p-4 rounded-b-lg">
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
    );
}
