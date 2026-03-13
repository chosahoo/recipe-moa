import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s/g, "");

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 .env.local에 설정하세요."
    );
  }

  client = createSupabaseClient(url, key, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
    },
  });
  return client;
}
