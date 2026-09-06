import { createClient } from '@supabase/supabase-js';

// Substitua a função antiga por esta versão blindada:
function cleanSupabaseUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // Isola apenas o primeiro endereço antes de qualquer espaço ou texto colado por engano
  clean = clean.split(/\s+/)[0];

  clean = clean.replace(/\/rest\/v1\/?$/, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

const DEFAULT_SUPABASE_URL = 'https://kkvmtqthahbcobsqmugl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_JTi7Fx5HdpnNUQFZZiLktg_r_6jLOpt';

const rawUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

const rawKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

const supabaseUrl = cleanSupabaseUrl(rawUrl) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = rawKey.trim() || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

const validUrl = isSupabaseConfigured ? supabaseUrl : DEFAULT_SUPABASE_URL;
const validKey = isSupabaseConfigured ? supabaseAnonKey : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});