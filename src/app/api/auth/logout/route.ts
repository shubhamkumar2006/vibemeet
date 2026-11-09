import { NextResponse } from "next/server";
import { clearAuthSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearAuthSession();
  return NextResponse.json({ success: true });
}

