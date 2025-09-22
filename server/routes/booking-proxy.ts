import { RequestHandler } from "express";
import { z } from "zod";

const RequestSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  params: z.record(z.any()).default({}),
});

function toFormParams(obj: any, parent?: string, out: URLSearchParams = new URLSearchParams()): URLSearchParams {
  if (obj == null) return out;
  if (typeof obj !== "object") {
    if (parent) out.append(parent, String(obj));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = parent ? `${parent}[${k}]` : k;
    if (typeof v === "object" && v !== null) toFormParams(v, key, out);
    else out.append(key, String(v ?? ""));
  }
  return out;
}

export const handleBookingProxy: RequestHandler = async (req, res) => {
  try {
    const parsed = RequestSchema.parse(req.body);
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Authorization: `Bearer ${parsed.token}`,
      "X-Requested-With": "XMLHttpRequest",
    };

    const body = toFormParams(parsed.params);

    const response = await fetch(parsed.url, {
      method: "POST",
      headers,
      body,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: true, status: response.status, message: text });
    }
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    }
    const text = await response.text();
    return res.json({ raw: text });
  } catch (err: any) {
    return res.status(400).json({ error: true, message: err?.message || "Invalid request" });
  }
};
