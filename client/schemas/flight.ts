import { z } from "zod";

// Helper regex for time HH:MM
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const flightFormSchema = z.object({
  origin: z.string().min(3, "كود المطار مطلوب (3 أحرف)"),
  destination: z.string().min(3, "كود المطار مطلوب (3 أحرف)"),
  date: z.string().min(1, "تاريخ الرحلة مطلوب"),
  flightNumber: z.string().min(1, "رقم الرحلة مطلوب"),
  airline: z.string().min(1, "شركة الطيران مطلوبة"),

  // Optional/Conditional fields
  newFlightNumber: z.string().optional(),
  newAirline: z.string().optional(),

  oldTime: z.string().regex(timeRegex, "صيغة الوقت غير صحيحة (HH:MM)").optional().or(z.literal("")),
  newTime: z.string().regex(timeRegex, "صيغة الوقت غير صحيحة (HH:MM)").optional().or(z.literal("")),

  type: z.enum(["delay", "advance", "cancel", "number_change", "number_time_delay", "number_time_advance"], {
    required_error: "يرجى اختيار نوع التبليغ",
  }),

  supplier: z.string().optional(),
});

export type FlightFormValues = z.infer<typeof flightFormSchema>;

export const defaultFlightValues: FlightFormValues = {
  origin: "IKA",
  destination: "BGW",
  date: new Date().toISOString().split("T")[0], // Default to today YYYY-MM-DD
  flightNumber: "6568",
  airline: "Aseman Airlines",
  newFlightNumber: "",
  newAirline: "",
  oldTime: "19:30",
  newTime: "01:00",
  type: "delay",
  supplier: "فريق FLY4ALL",
};
