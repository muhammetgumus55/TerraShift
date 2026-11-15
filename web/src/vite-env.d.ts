/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (Vercel env, web/.env.local). Without it the site keeps the device-only trial sign-in. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key: safe in the browser, access is limited by row-level security. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
