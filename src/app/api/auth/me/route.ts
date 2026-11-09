import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, setAuthSession, ensureUserInDb } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthSession();
  return NextResponse.json({ user: session });
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100),
});

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.isGuest) {
      return NextResponse.json(
        { error: "Must be signed in to update your profile." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const updatedSession = {
      ...session,
      name: parsed.data.name,
    };

    await ensureUserInDb({
      id: updatedSession.id,
      name: updatedSession.name,
      email: updatedSession.email,
    });

    await setAuthSession(updatedSession);

    return NextResponse.json({ user: updatedSession });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update profile.",
      },
      { status: 500 },
    );
  }
}
