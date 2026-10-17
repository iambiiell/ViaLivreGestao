/**
 * Supabase Client Configuration
 * Single Source of Truth for ViaLivre Supabase Database and Storage.
 */

import { createClient } from '@supabase/supabase-js';

export function getCleanSupabaseConfig() {
  const defaultUrl = 'https://xyzapbchpquycfcqxioz.supabase.co';
  const defaultKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFwYmNocHF1eWNmY3F4aW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTI2MzcsImV4cCI6MjEwNzQyODYzN30.b3cEUOfR9ZTEF7Y3r1cLnIfvGE8kxvmVnm8p69jiSnI';

  let rawUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    defaultUrl;

  // Ignore previous obsolete database URL if present in container env
  if (typeof rawUrl === 'string' && rawUrl.includes('kkvmtqthahbcobsqmugl')) {
    rawUrl = defaultUrl;
  }

  let supabaseUrl = defaultUrl;
  if (typeof rawUrl === 'string' && rawUrl.trim()) {
    const match = rawUrl.match(/https:\/\/[a-zA-Z0-9_-]+\.supabase\.co/);
    if (match) {
      supabaseUrl = match[0];
    } else {
      const urlMatch = rawUrl.match(/https:\/\/[^\s"'`]+/);
      if (urlMatch) {
        supabaseUrl = urlMatch[0].replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
      } else {
        supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') || defaultUrl;
      }
    }
  }

  let rawKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    defaultKey;

  // Ignore previous obsolete key from old project if present in container env
  if (
    typeof rawKey === 'string' &&
    (rawKey.includes('kkvmtqthahbcobsqmugl') ||
      rawKey.includes('cYc8Qx8bpZFoxZ6RR-kgrE12l-4wDQx2MGcWBPvd24g'))
  ) {
    rawKey = defaultKey;
  }

  let supabaseAnonKey = defaultKey;
  if (typeof rawKey === 'string' && rawKey.trim()) {
    const jwtMatch = rawKey.match(/eyJ[A-Za-z0-9._-]+/);
    const sbMatch = rawKey.match(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/);
    if (jwtMatch) {
      supabaseAnonKey = jwtMatch[0];
    } else if (sbMatch) {
      supabaseAnonKey = sbMatch[0];
    } else {
      supabaseAnonKey = rawKey.trim().split(/[\s"'`]+/)[0] || defaultKey;
    }
  }

  return { supabaseUrl, supabaseAnonKey };
}

const { supabaseUrl, supabaseAnonKey } = getCleanSupabaseConfig();

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export default supabase;
