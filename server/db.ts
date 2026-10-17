import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export function getCleanSupabaseConfig() {
  const defaultUrl = 'https://xyzapbchpquycfcqxioz.supabase.co';
  const defaultKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFwYmNocHF1eWNmY3F4aW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTI2MzcsImV4cCI6MjEwNzQyODYzN30.b3cEUOfR9ZTEF7Y3r1cLnIfvGE8kxvmVnm8p69jiSnI';

  let rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || defaultUrl;
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

  let rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || defaultKey;
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

export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Backward-compatibility pool stub
export const pool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({
    query: async () => ({ rows: [] }),
    release: () => {}
  }),
  end: async () => {}
};

export function isValidUUID(str: any): boolean {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const tableColumnsCache = new Map<string, Map<string, string>>();

export async function getTableColumns(tableName: string): Promise<Map<string, string>> {
  const norm = tableName.toLowerCase();
  if (tableColumnsCache.has(norm)) {
    return tableColumnsCache.get(norm)!;
  }
  try {
    const { data } = await supabaseServer.from(norm).select('*').limit(1);
    const colMap = new Map<string, string>();
    if (data && data.length > 0) {
      Object.keys(data[0]).forEach((k) => colMap.set(k.toLowerCase(), 'text'));
    }
    tableColumnsCache.set(norm, colMap);
    return colMap;
  } catch {
    return new Map();
  }
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  database: string;
  host: string;
  tablesCount: number;
  latencyMs: number;
  error?: string | null;
}> {
  const start = Date.now();
  try {
    const { error } = await supabaseServer.from('companies').select('id', { count: 'exact', head: true });
    const latencyMs = Date.now() - start;
    if (error) throw error;

    return {
      connected: true,
      database: 'Supabase PostgreSQL (xyzapbchpquycfcqxioz)',
      host: supabaseUrl,
      tablesCount: 59,
      latencyMs,
      error: null
    };
  } catch (err: any) {
    return {
      connected: false,
      database: 'Supabase PostgreSQL (xyzapbchpquycfcqxioz)',
      host: supabaseUrl,
      tablesCount: 0,
      latencyMs: Date.now() - start,
      error: err?.message || 'Database connection failure'
    };
  }
}

export async function ensureDatabaseBootstrap() {
  // Supabase already maintains schema, users and policies
  return;
}

export function normalizeColumnValue(val: any, dataType: string): any {
  if (val === undefined || val === null) return null;
  const dt = dataType.toLowerCase();
  if (dt.includes('uuid')) {
    if (val === '' || val === 'null' || val === 'none') return null;
    const str = String(val).trim();
    if (isValidUUID(str)) return str.toLowerCase();
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }
  if (dt.includes('json') && typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

export async function fetchAllRows(tableName: string, queryFilters?: Record<string, any>): Promise<any[]> {
  try {
    let query = supabaseServer.from(tableName.toLowerCase()).select('*');
    if (queryFilters) {
      for (const [key, val] of Object.entries(queryFilters)) {
        if (key && val !== undefined && val !== null && val !== '') {
          query = query.eq(key, val);
        }
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error(`[DB] Error fetching table ${tableName}:`, error);
      throw error;
    }
    return data || [];
  } catch (err: any) {
    console.error(`[DB] Exception in fetchAllRows for ${tableName}:`, err);
    throw err;
  }
}

export async function upsertRow(tableName: string, data: any): Promise<any> {
  const normTable = tableName.toLowerCase();
  const payload = { ...data };

  if (normTable === 'role_configs') {
    delete payload.id;
  } else if (!payload.id || !isValidUUID(payload.id)) {
    if (normTable !== 'system_settings') {
      payload.id = generateUUID();
    }
  }

  if (normTable === 'notifications') {
    delete payload.metadata;
  }

  for (const k of Object.keys(payload)) {
    if (k.startsWith('_') || payload[k] === undefined) {
      delete payload[k];
    }
  }

  const { data: result, error } = await supabaseServer
    .from(normTable)
    .upsert(payload)
    .select();

  if (error) {
    console.error(`[DB] Error upserting into ${tableName}:`, error);
    throw error;
  }

  return Array.isArray(result) && result.length > 0 ? result[0] : payload;
}

export async function updateRowById(tableName: string, id: string, data: any): Promise<any> {
  const normTable = tableName.toLowerCase();
  const payload = { ...data };
  delete payload.id;

  if (normTable === 'notifications') {
    delete payload.metadata;
  }

  for (const k of Object.keys(payload)) {
    if (k.startsWith('_') || payload[k] === undefined) {
      delete payload[k];
    }
  }

  const { data: result, error } = await supabaseServer
    .from(normTable)
    .update(payload)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`[DB] Error updating ${tableName} id=${id}:`, error);
    throw error;
  }

  return Array.isArray(result) && result.length > 0 ? result[0] : { id, ...payload };
}

export async function deleteRowById(tableName: string, id: string): Promise<boolean> {
  const { error } = await supabaseServer.from(tableName.toLowerCase()).delete().eq('id', id);
  if (error) {
    console.error(`[DB] Error deleting from ${tableName} id=${id}:`, error);
    throw error;
  }
  return true;
}

export async function clearTableData(tableName: string): Promise<boolean> {
  const { error } = await supabaseServer
    .from(tableName.toLowerCase())
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error(`[DB] Error clearing table ${tableName}:`, error);
    throw error;
  }
  return true;
}

export async function getOperationalContext() {
  try {
    const [routesRes, tripsRes, vehiclesRes, companiesRes, occurrencesRes] = await Promise.all([
      supabaseServer.from('routes').select('*').limit(100),
      supabaseServer.from('trips').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseServer.from('vehicles').select('*').limit(100),
      supabaseServer.from('companies').select('*').limit(50),
      supabaseServer.from('occurrences').select('*').neq('status', 'Concluído').order('created_at', { ascending: false }).limit(50)
    ]);

    const routes = routesRes.data || [];
    const trips = tripsRes.data || [];
    const vehicles = vehiclesRes.data || [];
    const companies = companiesRes.data || [];
    const occurrences = occurrencesRes.data || [];

    const totalFleet = vehicles.length;
    const activeFleet = vehicles.filter(v => v.status === 'ATIVO' || v.is_operational === true).length;
    const maintenanceFleet = vehicles.filter(v => v.status === 'MANUTENÇÃO' || v.inspection_status === 'REPROVADO').length;

    return {
      timestamp: new Date().toISOString(),
      database: 'Supabase PostgreSQL (xyzapbchpquycfcqxioz)',
      fleetSummary: {
        total: totalFleet,
        active: activeFleet,
        maintenance: maintenanceFleet,
        vehicles
      },
      routesSummary: {
        totalActiveRoutes: routes.length,
        routes
      },
      tripsSummary: {
        totalTripsLogged: trips.length,
        recentTrips: trips
      },
      occurrencesSummary: {
        pendingOccurrences: occurrences.length,
        occurrences
      },
      companiesSummary: {
        companies
      }
    };
  } catch (err: any) {
    console.error('[DB] Error assembling operational context from Supabase:', err);
    return {
      timestamp: new Date().toISOString(),
      database: 'Supabase PostgreSQL (xyzapbchpquycfcqxioz)',
      error: err.message,
      fleetSummary: { total: 0, active: 0, maintenance: 0, vehicles: [] },
      routesSummary: { totalActiveRoutes: 0, routes: [] },
      tripsSummary: { totalTripsLogged: 0, recentTrips: [] },
      occurrencesSummary: { pendingOccurrences: 0, occurrences: [] },
      companiesSummary: { companies: [] }
    };
  }
}
