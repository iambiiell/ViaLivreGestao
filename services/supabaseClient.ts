/**
 * Supabase Client Configuration
 * Single Source of Truth for ViaLivre Supabase Database and Storage.
 */

import { createClient } from '@supabase/supabase-js';

export function getCleanSupabaseConfig() {
  const defaultUrl = 'https://kkvmtqthahbcobsqmugl.supabase.co';
  const defaultKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrdm10cXRoYWhiY29ic3FtdWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MDM0MDUsImV4cCI6MjA4NDI3OTQwNX0.cYc8Qx8bpZFoxZ6RR-kgrE12l-4wDQx2MGcWBPvd24g';

  let rawUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    defaultUrl;

  // Ignore broken database URL if present (xyzapbchpquycfcqxioz has infinite recursion error 42P17)
  if (typeof rawUrl === 'string' && rawUrl.includes('xyzapbchpquycfcqxioz')) {
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

  // Ignore broken key from old project if present
  if (
    typeof rawKey === 'string' &&
    rawKey.includes('b3cEUOfR9ZTEF7Y3r1cLnIfvGE8kxvmVnm8p69jiSnI')
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
