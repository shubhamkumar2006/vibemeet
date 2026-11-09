import { RoomServiceClient, TrackType } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getGuestSession } from "@/lib/guest-session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isRoomCode } from "@/lib/validation";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("lock"), locked: z.boolean() }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("mute"), identity: z.string().uuid() }),
  z.object({ action: z.literal("remove"), identity: z.string().uuid() }),
  z.object({ action: z.literal("mute-all") }),
  z.object({ action: z.literal("transfer-host"), identity: z.string().uuid() }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ roomCode: string }> },
) {
  try {
    if (!(await enforceRateLimit(request, "meeting-host-action", 30, 60))) {
      return NextResponse.json(
        { error: "Too many control requests. Please slow down." },
        { status: 429 },
      );
    }
    const guest = await getGuestSession();
    const { roomCode } = await context.params;
    if (!guest)
      return NextResponse.json(
        { error: "A guest session is required." },
        { status: 401 },
      );
    if (!isRoomCode(roomCode))
      return NextResponse.json(
        { error: "Invalid meeting code." },
        { status: 400 },
      );
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid host action." },
        { status: 400 },
      );
    const action = parsed.data;
    const supabase = getSupabaseAdmin();
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("id, host_id, status, room_code")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!meeting)
      return NextResponse.json(
        { error: "Meeting not found." },
        { status: 404 },
      );
    if (action.action === "leave") {
      const { error: leaveError } = await supabase
        .from("participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meeting.id)
        .eq("user_id", guest.id);
      if (leaveError) throw new Error(leaveError.message);
      return NextResponse.json({ ok: true });
    }
    if (meeting.status === "ended")
      return NextResponse.json(
        { error: "Meeting has ended." },
        { status: 404 },
      );
    if (meeting.host_id !== guest.id)
      return NextResponse.json(
        { error: "Only the host can use this control." },
        { status: 403 },
      );

    if (action.action === "lock") {
      const { error: updateError } = await supabase
        .from("meetings")
        .update({ is_locked: action.locked })
        .eq("id", meeting.id);
      if (updateError) throw new Error(updateError.message);
    } else if (action.action === "transfer-host") {
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .select("user_id")
        .eq("meeting_id", meeting.id)
        .eq("user_id", action.identity)
        .is("left_at", null)
        .maybeSingle();
      if (participantError) throw new Error(participantError.message);
      if (!participant)
        return NextResponse.json(
          { error: "That person is no longer in the meeting." },
          { status: 404 },
        );
      const { error: updateError } = await supabase
        .from("meetings")
        .update({ host_id: action.identity })
        .eq("id", meeting.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const livekitUrl = process.env.LIVEKIT_URL;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      if (!livekitUrl || !apiKey || !apiSecret) {
        return NextResponse.json(
          { error: "LiveKit host controls are not configured." },
          { status: 503 },
        );
      }
      const serviceUrl =
        process.env.LIVEKIT_API_URL ??
        livekitUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      const service = new RoomServiceClient(serviceUrl, apiKey, apiSecret);
      if (action.action === "remove") {
        await service.removeParticipant(roomCode, action.identity);
        const { error: removeError } = await supabase
          .from("participants")
          .update({ left_at: new Date().toISOString(), is_removed: true })
          .eq("meeting_id", meeting.id)
          .eq("user_id", action.identity);
        if (removeError) throw new Error(removeError.message);
      } else if (action.action === "mute") {
        const participants = await service.listParticipants(roomCode);
        const participant = participants.find(
          (entry) => entry.identity === action.identity,
        );
        if (!participant) {
          return NextResponse.json(
            { error: "That person is no longer in the meeting." },
            { status: 404 },
          );
        }
        await Promise.all(
          participant.tracks
            .filter((track) => track.type === TrackType.AUDIO)
            .map((track) =>
              service.mutePublishedTrack(
                roomCode,
                participant.identity,
                track.sid,
                true,
              ),
            ),
        );
      } else if (action.action === "mute-all") {
        const participants = await service.listParticipants(roomCode);
        await Promise.all(
          participants.flatMap((participant) =>
            participant.tracks
              .filter((track) => track.type === TrackType.AUDIO)
              .map((track) =>
                service.mutePublishedTrack(
                  roomCode,
                  participant.identity,
                  track.sid,
                  true,
                ),
              ),
          ),
        );
      } else {
        const participants = await service.listParticipants(roomCode);
        await Promise.all(
          participants.map((participant) =>
            service.removeParticipant(roomCode, participant.identity),
          ),
        );
        const { error: updateError } = await supabase
          .from("meetings")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("id", meeting.id);
        if (updateError) throw new Error(updateError.message);
        const { error: participantUpdateError } = await supabase
          .from("participants")
          .update({ left_at: new Date().toISOString() })
          .eq("meeting_id", meeting.id)
          .is("left_at", null);
        if (participantUpdateError)
          throw new Error(participantUpdateError.message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Host action failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the host action.",
      },
      { status: 503 },
    );
  }
}
