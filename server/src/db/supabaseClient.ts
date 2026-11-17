import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || url.includes('your-project-id')) {
    missing.push('SUPABASE_URL');
  }
  if (!key || key.includes('your-supabase-service-role-key')) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    configured: missing.length === 0,
    missing,
  };
}

export function getSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    throw new Error(
      `Supabase is not configured. Missing environment variable(s): ${status.missing.join(', ')}. Copy server/.env.example to server/.env and add your Supabase credentials.`
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return cachedClient;
}
