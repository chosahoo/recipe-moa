import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 .env.local에 설정하세요."
    );
  }

  client = createSupabaseClient(url, key);
  return client;
}
