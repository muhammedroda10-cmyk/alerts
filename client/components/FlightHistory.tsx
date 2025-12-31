import React from "react";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateSafely } from "@/lib/date-utils";
import { NotificationItem } from "@/types";

interface FlightHistoryProps {
    history: NotificationItem[];
    setHistory: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
    copy: (text: string) => void;
}

export function FlightHistory({ history, setHistory, copy }: FlightHistoryProps) {
    if (history.length === 0) return null;

    return (
        <div>
            <h2 className="text-xl font-extrabold mb-3">سجل التبليغات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((h) => (
                    <Card key={h.id}>
                        <CardHeader>
                            <CardTitle className="text-base font-bold">{h.summary}</CardTitle>
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
    );
}
