import { NextResponse } from "next/server";
import {
  createGuestSession,
  getGuestSession,
  setGuestSession,
} from "@/lib/guest-session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { guestInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const guest = await getGuestSession();
  return NextResponse.json({
    guest: guest ? { displayName: guest.displayName } : null,
  });
}

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit(request, "guest-session", 12, 60))) {
      return NextResponse.json(
        { error: "Too many session requests. Please try again in a minute." },
        { status: 429 },
      );
    }
    const parsed = guestInputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a display name between 1 and 60 characters." },
        { status: 400 },
      );
    await setGuestSession(createGuestSession(parsed.data.displayName));
    return NextResponse.json({ displayName: parsed.data.displayName });
  } catch (error) {
    console.error("Guest session creation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start a guest session.",
      },
      { status: 503 },
    );
  }
}
