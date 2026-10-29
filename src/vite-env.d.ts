/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
