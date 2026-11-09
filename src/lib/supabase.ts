
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GLOBAL_ADMIN_CLIENT_KEY = "__vibemeet_supabase_admin__" as const;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin() {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_ADMIN_CLIENT_KEY]?: SupabaseClient;
  };

  if (!globalStore[GLOBAL_ADMIN_CLIENT_KEY]) {
    globalStore[GLOBAL_ADMIN_CLIENT_KEY] = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return globalStore[GLOBAL_ADMIN_CLIENT_KEY];
}

