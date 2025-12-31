import React from "react";
import { ArrowLeftRight } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { convertToDisplayFormat, convertFromDisplayFormat, formatDateYMD } from "@/lib/date-utils";

interface FlightPreviewProps {
    origin: string;
    setOrigin: (val: string) => void;
    destination: string;
    setDestination: (val: string) => void;
    date: string;
    setDate: (val: string) => void;
    flightNumber: string;
    setFlightNumber: (val: string) => void;
    airline: string;
    setAirline: (val: string) => void;
    newFlightNumber: string;
    setNewFlightNumber: (val: string) => void;
    newAirline: string;
    setNewAirline: (val: string) => void;
    oldTime: string;
    setOldTime: (val: string) => void;
    newTime: string;
    setNewTime: (val: string) => void;
    isNextDay: boolean;
    type: string;
    setType: (val: string) => void;
    supplier: string;
    setSupplier: (val: string) => void;
    selectedSupplierFilter: string | null;
    supplierStats: Map<string, { pnrCount: number; notifications: number }>;
    singleEdited: string;
    setSingleEdited: (val: string) => void;
    setSingleDirty: (val: boolean) => void;
    save: (message: string, summary: string) => void;
    copy: (text: string) => void;
}

export function FlightPreview({
    origin,
    setOrigin,
    destination,
    setDestination,
    date,
    setDate,
    flightNumber,
    setFlightNumber,
    airline,
    setAirline,
    newFlightNumber,
    setNewFlightNumber,
    newAirline,
    setNewAirline,
    oldTime,
    setOldTime,
    newTime,
    setNewTime,
    isNextDay,
    type,
    setType,
    supplier,
    setSupplier,
    selectedSupplierFilter,
    supplierStats,
    singleEdited,
    setSingleEdited,
    setSingleDirty,
    save,
    copy,
}: FlightPreviewProps) {
    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>بيانات الرحلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-end gap-4">
                    <div>
                        <Label htmlFor="origin">الروت - من</Label>
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
                                <SelectItem value="number_change">تغيير رقم الرحلة</SelectItem>
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
                                    ({supplierStats.get(selectedSupplierFilter)?.pnrCount} PNR)
                                </span>
                            )}
                        </Label>
                        <Input
                            id="supplier"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder={selectedSupplierFilter || "أدخل السبلاير / التوقيع"}
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
    );
}
