export interface NotificationItem {
  id: string;
  createdAt: string;
  message: string;
  summary: string;
}

export interface Trip {
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

export interface PnrSupplier {
  pnr: string;
  supplier: string;
  apiAirline?: string;
  booking_status?: string;
}
