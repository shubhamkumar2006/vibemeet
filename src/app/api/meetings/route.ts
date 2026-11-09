import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest-session";
import { ensureUserInDb } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { meetingInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

function makeRoomCode() {
  return `RAJ-${String(randomInt(0, 1000)).padStart(3, "0")}-${String(randomInt(0, 1000)).padStart(3, "0")}`;
}

export async function GET(request: Request) {
  try {
    const guest = await getGuestSession();
    if (!guest)
      return NextResponse.json(
        { error: "Start a guest session to view your meetings." },
        { status: 401 },
      );
    const kind =
      new URL(request.url).searchParams.get("kind") === "recent"
        ? "recent"
        : "upcoming";
    let query = getSupabaseAdmin()
      .from("meetings")
      .select(
        "id, room_code, title, description, scheduled_at, started_at, ended_at, status",
      )
      .eq("host_id", guest.id)
      .order(kind === "recent" ? "started_at" : "scheduled_at", {
        ascending: kind !== "recent",
        nullsFirst: false,
      })
      .limit(10);
    query =
      kind === "recent"
        ? query.in("status", ["ended", "active"])
        : query.eq("status", "scheduled");
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ meetings: data ?? [] });
  } catch (error) {
    console.error("Meeting list failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load meetings.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit(request, "meeting-create", 8, 60))) {
      return NextResponse.json(
        {
          error:
            "You’ve created several meetings recently. Please wait a minute.",
        },
        { status: 429 },
      );
    }
    const guest = await getGuestSession();
    if (!guest)
      return NextResponse.json(
        { error: "Start a guest session before creating a meeting." },
        { status: 401 },
      );
    const parsed = meetingInputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a meeting title under 100 characters." },
        { status: 400 },
      );
    const supabase = getSupabaseAdmin();
    await ensureUserInDb({ id: guest.id, name: guest.displayName });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const roomCode = makeRoomCode();
      const scheduledAt = parsed.data.scheduledAt ?? null;
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          room_code: roomCode,
          title: parsed.data.title,
          description: parsed.data.description,
          host_id: guest.id,
          scheduled_at: scheduledAt,
          started_at: scheduledAt ? null : new Date().toISOString(),
          status: scheduledAt ? "scheduled" : "active",
        })
        .select("id, room_code, title, scheduled_at, status")
        .single();
      if (!error) return NextResponse.json({ meeting: data }, { status: 201 });
      if (error.code !== "23505") throw new Error(error.message);
    }
    return NextResponse.json(
      { error: "Could not generate a unique meeting code. Please try again." },
      { status: 503 },
    );
  } catch (error) {
    console.error("Meeting creation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create meeting.",
      },
      { status: 503 },
    );
  }
}
