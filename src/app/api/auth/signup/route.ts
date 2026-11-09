import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { setAuthSession, ensureUserInDb, type UserSession } from "@/lib/auth";
import { signupInputSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await enforceRateLimit(request, "auth-signup", 10, 60))) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again in a minute." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = signupInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid signup input.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    let userId: string;
    const userEmail: string = email.toLowerCase();

    // Try admin creation first (auto-confirms email so user doesn't get blocked by unconfigured SMTP)
    const { data: adminUserData, error: adminError } =
      await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (adminError) {
      const msg = adminError.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("unique") ||
        adminError.status === 422
      ) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists. Please log in instead.",
          },
          { status: 409 },
        );
      }

      // If admin API fails for other reasons, try client signUp fallback
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data: clientData, error: clientError } = await client.auth.signUp(
        {
          email: userEmail,
          password,
          options: { data: { name } },
        },
      );

      if (clientError) {
        throw new Error(clientError.message);
      }
      if (!clientData.user) {
        throw new Error("Unable to create account. Please try again.");
      }
      userId = clientData.user.id;
    } else {
      userId = adminUserData.user.id;
    }

    // Save user in public.users table
    await ensureUserInDb({
      id: userId,
      name,
      email: userEmail,
    });

    const session: UserSession = {
      id: userId,
      name,
      email: userEmail,
      avatar: null,
      isGuest: false,
      expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
    };

    await setAuthSession(session);

    return NextResponse.json({ user: session }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Signup failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
