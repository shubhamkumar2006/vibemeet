import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const secret = process.env.SESSION_SECRET;
  if (!secret)
    throw new Error("Rate limiting is not configured. Add SESSION_SECRET.");
  const key = createHmac("sha256", secret)
    .update(`${bucket}:${ip}`)
    .digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Rate limiting failed: ${error.message}`);
  return data === true;
}
