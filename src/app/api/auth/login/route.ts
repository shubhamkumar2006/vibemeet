import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { setAuthSession, ensureUserInDb, type UserSession } from "@/lib/auth";
import { loginInputSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit(request, "auth-login", 15, 60))) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = loginInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid login credentials.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const userEmail = email.toLowerCase().trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Invalid email or password." },
        { status: 401 },
      );
    }

    const authUser = data.user;

    // Check if user has an existing record in public.users
    const supabaseAdmin = getSupabaseAdmin();
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, name, email, avatar")
      .eq("id", authUser.id)
      .maybeSingle();

    const name =
      dbUser?.name ||
      (authUser.user_metadata?.name as string | undefined)?.trim() ||
      userEmail.split("@")[0];

    const avatar =
      dbUser?.avatar ||
      (authUser.user_metadata?.avatar_url as string | null) ||
      null;

    // Ensure public.users is up to date
    await ensureUserInDb({
      id: authUser.id,
      name,
      email: authUser.email ?? userEmail,
      avatar,
    });

    const session: UserSession = {
      id: authUser.id,
      name,
      email: authUser.email ?? userEmail,
      avatar,
      isGuest: false,
      expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
    };

    await setAuthSession(session);

    return NextResponse.json({ user: session });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Login failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
