import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest-session";
import { ensureUserInDb } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { tokenInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit(request, "livekit-token", 15, 60))) {
      return NextResponse.json(
        { error: "Too many join attempts. Please wait a minute." },
        { status: 429 },
      );
    }
    const guest = await getGuestSession();
    if (!guest)
      return NextResponse.json(
        { error: "Enter your name before joining." },
        { status: 401 },
      );
    const parsed = tokenInputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid meeting code." },
        { status: 400 },
      );

    const supabase = getSupabaseAdmin();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, room_code, host_id, status, is_locked, started_at")
      .eq("room_code", parsed.data.roomCode)
      .maybeSingle();
    if (meetingError) throw new Error(meetingError.message);
    if (!meeting || meeting.status === "ended") {
      return NextResponse.json(
        { error: "This meeting is invalid or has ended." },
        { status: 404 },
      );
    }
    if (meeting.is_locked && meeting.host_id !== guest.id) {
      return NextResponse.json(
        { error: "This meeting is locked by its host." },
        { status: 423 },
      );
    }
    const { data: previousParticipation, error: participationError } =
      await supabase
        .from("participants")
        .select("is_removed")
        .eq("meeting_id", meeting.id)
        .eq("user_id", guest.id)
        .maybeSingle();
    if (participationError) throw new Error(participationError.message);
    if (previousParticipation?.is_removed && meeting.host_id !== guest.id) {
      return NextResponse.json(
        { error: "The host removed you from this meeting." },
        { status: 403 },
      );
    }
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        {
          error:
            "Video meetings are not configured. Add the LiveKit URL, API key, and API secret.",
        },
        { status: 503 },
      );
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: guest.id,
      name: guest.displayName,
      ttl: "2h",
      metadata: JSON.stringify({
        displayName: guest.displayName,
        isHost: meeting.host_id === guest.id,
      }),
    });
    token.addGrant({
      roomJoin: true,
      room: meeting.room_code,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const accessToken = await token.toJwt();
    if (meeting.status === "scheduled") {
      const { error: startError } = await supabase
        .from("meetings")
        .update({
          status: "active",
          started_at: meeting.started_at ?? new Date().toISOString(),
        })
        .eq("id", meeting.id)
        .eq("status", "scheduled");
      if (startError) throw new Error(startError.message);
    }
    await ensureUserInDb({ id: guest.id, name: guest.displayName });

    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id")
      .eq("meeting_id", meeting.id)
      .eq("user_id", guest.id)
      .maybeSingle();

    if (existingParticipant) {
      const { error: updateError } = await supabase
        .from("participants")
        .update({
          guest_name: guest.displayName,
          joined_at: new Date().toISOString(),
          left_at: null,
        })
        .eq("id", existingParticipant.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from("participants")
        .insert({
          meeting_id: meeting.id,
          user_id: guest.id,
          guest_name: guest.displayName,
          joined_at: new Date().toISOString(),
          left_at: null,
        });
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({
      accessToken,
      serverUrl: livekitUrl,
      isHost: meeting.host_id === guest.id,
      isLocked: meeting.is_locked,
      roomCode: meeting.room_code,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not join this meeting.";
    console.error("LiveKit token generation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
