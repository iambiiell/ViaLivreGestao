/**
 * Legacy Client Compatibility Shim
 * Redireciona todas as chamadas legadas para o adaptador PostgreSQL / Aiven (/api/db/*).
 * O SDK @supabase/supabase-js foi completamente removido.
 */

import { postgresClient, isPostgresConfigured } from './postgresClient';

export function getCleanSupabaseConfig() {
  return {
    supabaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    supabaseAnonKey: 'aiven-postgresql-backend'
  };
}

export const SUPABASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
export const SUPABASE_ANON_KEY = 'aiven-postgresql-backend';
export const isSupabaseConfigured = isPostgresConfigured;
export const supabase = postgresClient;

export default postgresClient;
