import { createClient } from "@supabase/supabase-js";

// Public (browser-safe) values. On Cloudflare Pages set them under Settings → Environment variables.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://not-configured.supabase.co";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "not-configured";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
