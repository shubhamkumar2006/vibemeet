import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GLOBAL_BROWSER_CLIENT_KEY = "__vibemeet_supabase_browser__" as const;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseBrowser() {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_BROWSER_CLIENT_KEY]?: SupabaseClient;
  };

  if (typeof window === "undefined") {
    throw new Error("Supabase browser client can only be used in the browser.");
  }

  if (!globalStore[GLOBAL_BROWSER_CLIENT_KEY]) {
    globalStore[GLOBAL_BROWSER_CLIENT_KEY] = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }

  return globalStore[GLOBAL_BROWSER_CLIENT_KEY];
}
