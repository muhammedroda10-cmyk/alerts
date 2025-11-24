import { z } from "zod";

export const flightFormSchema = z.object({
  // Flight Details
  airline: z.string().min(1, "Airline is required"),
  flightNumber: z.string().min(1, "Flight number is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"), // ISO format in state
  origin: z.string().length(3, "Origin must be 3 letters").toUpperCase(),
  destination: z.string().length(3, "Destination must be 3 letters").toUpperCase(),
  
  // Modification Details
  oldTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time (HH:MM)").optional().or(z.literal("")),
  newTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time (HH:MM)").optional().or(z.literal("")),
  newFlightNumber: z.string().optional(),
  newAirline: z.string().optional(),
  
  // Metadata
  type: z.enum(["delay", "advance", "cancel", "number_change", "number_time_delay", "number_time_advance"]),
  supplier: z.string().optional(), // Filter/Signature
});

export type FlightFormData = z.infer<typeof flightFormSchema>;

export const defaultFlightValues: FlightFormData = {
  airline: "Aseman Airlines",
  flightNumber: "6568",
  date: new Date().toISOString().split('T')[0],
  origin: "IKA",
  destination: "BGW",
  oldTime: "19:30",
  newTime: "01:00",
  type: "delay",
  supplier: "فريق FLY4ALL",
  newFlightNumber: "",
  newAirline: "",
};

export const apiSettingsSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1, "Token is required"),
  perPage: z.number().min(1).max(500).default(100),
});

export type ApiSettingsData = z.infer<typeof apiSettingsSchema>;
