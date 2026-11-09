import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthSession } from "@/lib/auth";

const COOKIE_NAME = "vibemeet_guest";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type GuestSession = {
  id: string;
  displayName: string;
  expiresAt: number;
};

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret)
    throw new Error("Guest sessions are not configured. Add SESSION_SECRET.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGuestSession(displayName: string): GuestSession {
  return {
    id: randomUUID(),
    displayName,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
}

export async function setGuestSession(session: GuestSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const authSession = await getAuthSession();
  if (authSession) {
    return {
      id: authSession.id,
      displayName: authSession.name,
      expiresAt: authSession.expiresAt,
    };
  }
  return null;
}
