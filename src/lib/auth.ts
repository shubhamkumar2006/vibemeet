import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

export const AUTH_COOKIE_NAME = "vibemeet_session";
export const GUEST_COOKIE_NAME = "vibemeet_guest";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type UserSession = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  isGuest: boolean;
  expiresAt: number;
};

const DEV_SESSION_SECRET = "dev-session-secret-change-me";

function getSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_SESSION_SECRET;
  }

  throw new Error("Authentication is not configured. Add SESSION_SECRET.");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function verifySignedValue(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  return payload;
}

export async function setAuthSession(session: UserSession): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(GUEST_COOKIE_NAME);
}

export async function getAuthSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();

  // 1. Try logged-in user session
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const authPayload = verifySignedValue(authCookie);
  if (authPayload) {
    try {
      const session = JSON.parse(
        Buffer.from(authPayload, "base64url").toString("utf8"),
      ) as UserSession;
      if (
        typeof session.id === "string" &&
        typeof session.name === "string" &&
        session.expiresAt > Date.now()
      ) {
        return session;
      }
    } catch {
      // malformed payload
    }
  }

  // 2. Try guest session fallback
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const guestPayload = verifySignedValue(guestCookie);
  if (guestPayload) {
    try {
      const guest = JSON.parse(
        Buffer.from(guestPayload, "base64url").toString("utf8"),
      ) as { id: string; displayName: string; expiresAt: number };
      if (
        typeof guest.id === "string" &&
        typeof guest.displayName === "string" &&
        guest.expiresAt > Date.now()
      ) {
        return {
          id: guest.id,
          name: guest.displayName,
          email: null,
          avatar: null,
          isGuest: true,
          expiresAt: guest.expiresAt,
        };
      }
    } catch {
      // malformed guest payload
    }
  }

  return null;
}

export async function ensureUserInDb(user: {
  id: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("users").upsert(
      {
        id: user.id,
        name: user.name,
        email: user.email || null,
        avatar: user.avatar || null,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn("Could not upsert user row in public.users:", error.message);
    }
  } catch (err) {
    console.warn("Error ensuring user exists in DB:", err);
  }
}
