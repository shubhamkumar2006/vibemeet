import { NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest-session";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const guest = await getGuestSession();
    if (!guest)
      return NextResponse.json(
        { error: "Start a guest session to view recordings." },
        { status: 401 },
      );
    const { data, error } = await getSupabaseAdmin()
      .from("recordings")
      .select(
        "id, meeting_id, url, duration, created_at, meetings!inner(room_code, title, host_id)",
      )
      .eq("meetings.host_id", guest.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ recordings: data ?? [] });
  } catch (error) {
    console.error("Recording list failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load recordings.",
      },
      { status: 503 },
    );
  }
}
