import {
  BusRoute,
  Company,
  Trip,
  User,
  Vehicle,
  IssueReport,
  City,
  Notice,
  TicketSale,
  Inspection,
  TicketingConfig,
  PayrollRubric,
  RoleConfig,
  AppNotification,
  Shift,
  SystemSettings,
  TimeEntry
} from '../types';
import { postgresClient, isPostgresConfigured, initSSE } from './postgresClient';
import { safeLocalStorage } from '../utils/storage';
import { pontoIndexedDB } from './pontoIndexedDB';

export { pontoIndexedDB, postgresClient, isPostgresConfigured };
export const dbClient = postgresClient;
// Aliases mantidos apenas para compatibilidade transitória — backend usa 100% Aiven PostgreSQL via Express (/api/*)
export const supabase = postgresClient;
export const isSupabaseConfigured = isPostgresConfigured;
export type RealtimeChannel = any;

export type TableName =
  | 'routes'
  | 'trips'
  | 'users'
  | 'companies'
  | 'vehicles'
  | 'occurrences'
  | 'cities'
  | 'notices'
  | 'push_subscriptions'
  | 'ticket_sales'
  | 'bilhetes_passagem'
  | 'schedules'
  | 'timetables'
  | 'maintenance'
  | 'maintenance_logs'
  | 'inspections'
  | 'ticketing_config'
  | 'payroll_rubrics'
  | 'payroll'
  | 'payroll_details'
  | 'salary_items'
  | 'role_configs'
  | 'notifications'
  | 'shifts'
  | 'daily_schedules'
  | 'time_tracking'
  | 'drivers'
  | 'driver_logs'
  | 'conductor_logs'
  | 'dispatcher_logs'
  | 'routes_logs'
  | 'system_settings'
  | 'system_versions'
  | 'imp_cards'
  | 'imp_card_recharges'
  | 'user_occurrences'
  | 'traffic_violations'
  | 'user_fines'
  | 'job_applications'
  | 'job_vacancies'
  | 'skins'
  | 'trips_audit'
  | 'activation_keys'
  | 'subscriptions'
  | 'ticket_booths'
  | 'bus_stations'
  | 'bus_terminals'
  | 'itineraries'
  | 'itinerary_sections'
  | 'route_sections'
  | 'passengers'
  | 'cashier_logs'
  | 'uploads';

export const ALL_BACKUP_TABLES: TableName[] = [
  'system_settings',
  'subscriptions',
  'activation_keys',
  'role_configs',
  'payroll_rubrics',
  'ticketing_config',
  'companies',
  'cities',
  'bus_stations',
  'bus_terminals',
  'users',
  'drivers',
  'vehicles',
  'skins',
  'routes',
  'itineraries',
  'itinerary_sections',
  'route_sections',
  'timetables',
  'ticket_booths',
  'schedules',
  'daily_schedules',
  'shifts',
  'trips',
  'ticket_sales',
  'bilhetes_passagem',
  'imp_cards',
  'imp_card_recharges',
  'notices',
  'occurrences',
  'user_occurrences',
  'maintenance',
  'maintenance_logs',
  'inspections',
  'time_tracking',
  'driver_logs',
  'conductor_logs',
  'dispatcher_logs',
  'routes_logs',
  'trips_audit',
  'cashier_logs',
  'traffic_violations',
  'user_fines',
  'payroll',
  'payroll_details',
  'salary_items',
  'job_vacancies',
  'job_applications',
  'passengers',
  'notifications'
];

const SUPPORTED_RESTORE_TABLES = new Set<string>([
  ...ALL_BACKUP_TABLES,
  'push_subscriptions',
  'system_versions',
  'uploads'
]);

export const extractNormalizedBackupTables = (rawInput: any): Record<string, any[]> => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return {};
  }
  const aliases: Record<string, string> = {
    empresas: 'companies',
    company: 'companies',
    cidades: 'cities',
    city: 'cities',
    municipios: 'cities',
    usuarios: 'users',
    user: 'users',
    colaboradores: 'users',
    motoristas: 'drivers',
    driver: 'drivers',
    veiculos: 'vehicles',
    onibus: 'vehicles',
    vehicle: 'vehicles',
    linhas: 'routes',
    rotas: 'routes',
    route: 'routes',
    viagens: 'trips',
    trip: 'trips',
    escalas: 'schedules',
    schedule: 'schedules',
    escalas_diarias: 'daily_schedules',
    rodoviarias: 'bus_stations',
    terminais: 'bus_terminals',
    avisos: 'notices',
    notice: 'notices',
    ocorrencias: 'occurrences',
    occurrence: 'occurrences',
    notificacoes: 'notifications',
    notification: 'notifications',
    passagens: 'ticket_sales',
    bilhetes: 'bilhetes_passagem',
    manutencoes: 'maintenance',
    vistorias: 'inspections',
    cargos: 'role_configs',
    rubricas: 'payroll_rubrics',
    guiches: 'ticket_booths',
    turnos: 'shifts',
    ponto: 'time_tracking',
    configuracoes: 'system_settings',
    cartoes_vt: 'imp_cards'
  };

  let source: Record<string, any> = rawInput;
  for (const wrapperKey of ['data', 'tables', 'backup', 'snapshot', 'records']) {
    const candidate = rawInput[wrapperKey];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      if (Object.values(candidate).some((v) => Array.isArray(v))) {
        source = candidate;
        break;
      }
    }
  }

  const out: Record<string, any[]> = {};
  for (const [k, v] of Object.entries(source)) {
    if (!Array.isArray(v)) continue;
    const lowered = k.trim().toLowerCase();
    const mapped = aliases[lowered] || lowered;
    if (!SUPPORTED_RESTORE_TABLES.has(mapped)) continue;
    if (!out[mapped]) out[mapped] = [];
    out[mapped].push(...v);
  }
  return out;
};

export interface PendingAction {
  id: string;
  table: TableName;
  action: 'create' | 'update' | 'delete';
  payload?: any;
  recordId: string;
  timestamp: number;
}

export interface DbStatus {
  isOffline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  provider?: string;
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const isValidUUID = (str: any): boolean => {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const DEFAULT_SYSTEM_UUID = '44d472ca-9311-45e1-9297-c442e016e1a6';

export const getStoredSystemId = (): string | null => {
  try {
    if (typeof window !== 'undefined') {
      const explicit = safeLocalStorage.getItem('vialivre_system_id');
      if (explicit && (isValidUUID(explicit) || explicit.length > 5)) {
        return explicit;
      }
      const u = safeLocalStorage.getItem('fluxo_session_user') || safeLocalStorage.getItem('@vialivre_user');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed?.system_id) {
          return String(parsed.system_id);
        }
      }
    }
  } catch {}
  return null;
};

export let currentSystemId: string | null = getStoredSystemId();

const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export const safeJsonStringify = (data: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify(data ?? {}, (_key, value) => {
    if (typeof value === 'string') {
      return value.replace(/\u0000/g, '');
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return null;
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    }
    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }
    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      return undefined;
    }
    if (typeof Event !== 'undefined' && value instanceof Event) {
      return undefined;
    }
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  });
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: externalSignal, ...fetchInit } = options;
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timerId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchInit,
      signal: controller.signal
    });
  } catch (err: any) {
    if (timedOut || err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      const timeoutErr = new Error(`Timeout de conexão após ${timeoutMs}ms ao acessar ${url}`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timerId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

const isRetryableHttpStatus = (status: number, errText: string): boolean => {
  if (status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (status >= 500) {
    const lower = (errText || '').toLowerCase();
    return (
      lower.includes('too many clients') ||
      lower.includes('remaining connection slots') ||
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('terminat') ||
      lower.includes('connection') ||
      lower.includes('econnreset') ||
      lower.includes('etimedout') ||
      lower.includes('57014') ||
      lower.includes('53300')
    );
  }
  return false;
};

const isRetryableNetworkException = (err: any, externalSignal?: AbortSignal): boolean => {
  if (externalSignal?.aborted && err?.name === 'AbortError') {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  const name = String(err?.name || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    name === 'timeouterror' ||
    name === 'aborterror' ||
    name === 'typeerror' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection reset') ||
    msg.includes('connection refused')
  );
};

export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 250, signal: externalSignal, ...rest } = options;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    try {
      const res = await fetchWithTimeout(url, { ...rest, signal: externalSignal });
      if (res.ok) {
        return res;
      }

      const errText = await res.clone().text().catch(() => '');
      if (attempt < retries && isRetryableHttpStatus(res.status, errText)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries && isRetryableNetworkException(err, externalSignal)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function buildHeaders(extra?: Record<string, string>, overrideSystemId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(extra || {})
  };
  const sysId = overrideSystemId ?? currentSystemId ?? getStoredSystemId();
  if (sysId) {
    headers['x-system-id'] = String(sysId);
  }
  return headers;
}

export const fetchRootAdminSystemId = async (user?: Partial<User> | null): Promise<string> => {
  try {
    const isUserAdmin =
      (user?.role || '').toUpperCase() === 'ADMIN' ||
      user?.is_full_admin === true ||
      (user?.job_title || '').toUpperCase().includes('ADMINISTRADOR');

    if (isUserAdmin && user?.system_id && isValidUUID(user.system_id)) {
      currentSystemId = user.system_id;
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('vialivre_system_id', user.system_id);
      }
      return user.system_id;
    }

    if (user?.system_id && isValidUUID(user.system_id)) {
      currentSystemId = user.system_id;
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('vialivre_system_id', user.system_id);
      }
      return user.system_id;
    }

    const res = await fetchWithRetry('/api/auth/resolve-system-id', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: safeJsonStringify(user || {}),
      timeoutMs: 8000,
      retries: 2
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.system_id) {
        currentSystemId = data.system_id;
        if (typeof window !== 'undefined') {
          safeLocalStorage.setItem('vialivre_system_id', data.system_id);
        }
        return data.system_id;
      }
    }
  } catch (err) {
    console.warn('[AUTH] Erro ao resolver system_id via backend Aiven PostgreSQL:', err);
  }

  const fallback = DEFAULT_SYSTEM_UUID;
  currentSystemId = fallback;
  if (typeof window !== 'undefined') {
    safeLocalStorage.setItem('vialivre_system_id', fallback);
  }
  return fallback;
};

export const KNOWN_TABLE_COLUMNS: Partial<Record<TableName, Set<string>>> = {
  companies: new Set([
    'id', 'name', 'created_at', 'active', 'cnpj', 'contactPhone', 'contact_email', 'contact_phone',
    'address_city', 'address_state', 'address_street', 'address_zip_code', 'address_neighborhood',
    'address_number', 'cep', 'telefone', 'logradouro', 'bairro', 'cidade', 'uf', 'email', 'numero',
    'complemento', 'phone', 'ie', 'system_id', 'nome_fantasia', 'razao_social', 'logo_url'
  ]),
  routes: new Set([
    'id', 'created_at', 'active', 'company_id', 'name', 'origin', 'destination', 'price', 'letreiro_principal',
    'route_number', 'schedule', 'sections', 'status', 'stops', 'via1', 'via2', 'via3', 'prefixo_linha',
    'lightdot_code', 'via_1', 'via_2', 'via_3', 'tarifa_integral', 'route_type', 'service_number', 'service_type',
    'prefix_code', 'duration_minutes', 'distance_km', 'letreiro_principal_modo', 'letreiro_principal_texto',
    'letreiro_secundario_modo', 'letreiro_secundario_texto', 'via1_modo', 'via1_texto', 'via2_modo',
    'via2_texto', 'via3_modo', 'via3_texto', 'boarding_fee', 'toll', 'origin_lat', 'origin_lng',
    'destination_lat', 'destination_lng', 'origin_cep', 'destination_cep', 'origin_number',
    'destination_number', 'origin_city', 'destination_city', 'origin_neighborhood',
    'destination_neighborhood', 'departure_point', 'arrival_point', 'fees', 'line_prefix',
    'display_main_color', 'display_main_mode', 'display_main_speed', 'via1_mode', 'via2_mode',
    'via3_mode', 'letreiro_cor', 'letreiro_principal_cor', 'letreiro_principal_velocidade', 'system_id',
    'payment_type', 'full_fare', 'municipality_id', 'line_code', 'schedule_weekdays', 'schedule_saturdays',
    'schedule_sundays', 'estimated_travel_time_text', 'payment_methods_accepted', 'service_class',
    'origin_station_id', 'origin_station_platform', 'destination_station_id',
    'destination_station_platform', 'via1_cor', 'via2_cor', 'via3_cor', 'exibir_codigo_letreiro',
    'empresa_autuante', 'empresa_autuante_id', 'created_by', 'updated_by', 'is_active'
  ]),
  users: new Set([
    'id', 'full_name', 'email', 'created_at', 'active', 'admission_date', 'job_title', 'registration_id',
    'name', 'company_id', 'org_name', 'org_phone', 'org_address', 'company_type', 'org_trading_name',
    'metadata', 'permissions', 'status', 'phone', 'mobile_phone', 'address_zip_code', 'username',
    'raw_meta_data', 'cpf', 'zip_code', 'address_street', 'address_number', 'imperial_email', 'login',
    'password_hash', 'is_active', 'address_city', 'address_state', 'address_zip', 'address_neighborhood',
    'badge_id', 'address_complement', 'phone_number', 'department', 'cep', 'logradouro', 'numero',
    'license_type', 'license_expiry', 'license_number', 'work_municipality_id', 'work_municipality',
    'license_validity', 'resignation_date', 'blood_type', 'login_acesso', 'senha_acesso', 'unidade',
    'bairro', 'cidade', 'uf', 'complemento', 'data_admissao', 'data_demissao', 'tipo_sanguineo',
    'birth_date', 'tipo_cnh', 'validade_cnh', 'telefone', 'login_usuario', 'login_senha', 'foto_url',
    'photo_url', 'base_salary', 'working_hours_per_day', 'weekly_scale', 'work_start_time', 'work_end_time',
    'standard_clock_in', 'standard_clock_out', 'pjs_pis', 'cbo', 'work_shift_type', 'daily_hours_target',
    'system_id', 'activation_key', 'is_full_admin', 'registration_number', 'role', 'cnh_limit',
    'standard_interval', 'CPF', 'Cep', 'saturday_clock_in', 'saturday_clock_out', 'saturday_interval',
    'sunday_clock_in', 'sunday_clock_out', 'sunday_interval', 'occurrences', 'created_by', 'updated_by',
    'updated_at', 'pis', 'rg', 'ctps', 'cnh', 'cnh_category', 'cnh_expiration', 'address', 'salary',
    'pix_key', 'bank_details', 'avatar_url', 'user_id', 'auth_id', 'cargo', 'departamento', 'password', 'senha'
  ]),
  system_settings: new Set([
    'id', 'key', 'value', 'description', 'updated_at', 'system_id', 'company_name', 'system_name',
    'nome_da_empresa', 'registration_pattern', 'theme_color', 'high_contrast', 'glass_effect'
  ]),
  activation_keys: new Set([
    'id', 'key_code', 'system_id', 'is_used', 'activated_at', 'created_at', 'owner_email', 'company_name',
    'plan_type', 'expires_at', 'activated_by_name', 'activated_by_user_id', 'activated_by_system_id',
    'duration_months', 'price', 'currency', 'key_type', 'duration_days', 'duration_type'
  ]),
  subscriptions: new Set([
    'id', 'system_id', 'plan_type', 'status', 'activated_at', 'expires_at', 'created_at', 'updated_at'
  ]),
  vehicles: new Set([
    'id', 'plate', 'model', 'company_id', 'created_at', 'active', 'base_city', 'chassis', 'company_name',
    'is_accessible', 'prefix', 'status', 'vehicle_type', 'empresa', 'cidade_atuacao', 'last_inspection',
    'year_fab', 'chassi', 'is_operational', 'capacity', 'brand', 'vehicle_class', 'year', 'color',
    'system_id', 'skin_id', 'nome_da_empresa', 'current_turnstile_count', 'image_url', 'cep',
    'address_street', 'address_neighborhood', 'address_city', 'address_state', 'address_number',
    'inspection_status', 'route_id', 'default_route_id', 'conductor_id', 'conductor_name',
    'default_conductor_id', 'default_conductor_name', 'driver_id', 'driver_name', 'has_conductor'
  ]),
  trips: new Set([
    'id', 'route_id', 'vehicle_id', 'driver_id', 'departure_time', 'status', 'created_at', 'active',
    'observation', 'company_id', 'bus_number', 'driver_name', 'revenue', 'trip_date', 'arrival_time',
    'passengers', 'finished', 'end_time', 'passengers_count', 'cash_value', 'vt_value', 'card_value',
    'actual_end_time', 'cash_amount', 'vt_amount', 'card_amount', 'free_passengers', 'actual_start_time',
    'occupied_seats', 'fiscal_id', 'maintenance_alert', 'fiscal_name', 'vehicle_prefix', 'end_date',
    'inspector_id', 'direção', 'direction', 'replacement_bus_number', 'occurrence_type', 'occurrence_note',
    'passenger_count', 'notas', 'actual_departure', 'actual_arrival', 'delay_minutes', 'system_id',
    'scheduled_start', 'sections_data', 'trip_type', 'occurrences_count', 'origin_terminal',
    'destination_terminal', 'conductor_id', 'conductor_name', 'has_conductor', 'ignore_company_filter',
    'odometer_start', 'odometer_end', 'fuel_level_end', 'tickets_sold', 'electronic_payments', 'selectedTimes',
    'checklist_ok', 'fuel_level', 'initial_turnstile', 'cash_total', 'card_total', 'vt_total',
    'final_turnstile', 'initial_odometer', 'schedule_id', 'arrival_time_planned', 'updated_at'
  ]),
  schedules: new Set([
    'id', 'system_id', 'route_id', 'vehicle_id', 'driver_id', 'driver_name', 'conductor_id', 'conductor_name',
    'fiscal_id', 'fiscal_name', 'bus_number', 'trip_date', 'departure_time', 'arrival_time', 'direction',
    'trip_type', 'status', 'metadata', 'created_at'
  ]),
  itineraries: new Set([
    'id', 'via_1', 'via_2', 'via_3', 'nome_itinerario', 'full_fare', 'stops_list', 'sections_data',
    'schedule_week', 'schedule_sat', 'schedule_sun', 'system_id', 'created_at'
  ]),
  imp_cards: new Set([
    'id', 'type', 'card_number', 'balance', 'name', 'surname', 'cpf', 'rg', 'birth_date', 'email', 'phone',
    'cep', 'address_street', 'address_number', 'address_complement', 'address_neighborhood', 'address_city',
    'address_state', 'created_at', 'senha', 'zip_code', 'password', 'generated_image_url', 'card_logo_left_url',
    'card_logo_right_url', 'left_logo_url', 'right_logo_url', 'ai_art_url', 'photo_url', 'system_id',
    'is_passenger_buyer', 'seat_number'
  ]),
  ticket_sales: new Set([
    'id', 'trip_id', 'driver_id', 'section_name', 'payment_method', 'amount', 'passengers_count', 'created_at',
    'address_cep', 'address_city', 'address_state', 'passenger_name', 'passenger_document', 'address_neighborhood',
    'address_number', 'address_complement', 'pdf_url', 'timestamp', 'address_street', 'passenger_birth',
    'passenger_gender', 'passenger_cpf', 'passenger_rg', 'passenger_phone', 'passenger_email', 'seat_number',
    'total_price', 'company_data', 'coupon_applied', 'chave_acesso', 'protocolo_autorizacao', 'data_autorizacao',
    'serie_documento', 'numero_documento', 'qr_code_url', 'tipo_documento_passageiro', 'base_calculo_icms',
    'aliquota_icms', 'valor_icms', 'qr_code_base64', 'plataforma', 'servico_tipo', 'icms_valor', 'relationship',
    'responsible_name', 'responsible_birth', 'price_base', 'price_toll', 'price_boarding_fee', 'price_fees',
    'discount_value', 'vehicle_model', 'vehicle_prefix', 'system_id', 'departure_time', 'direction', 'is_presale',
    'route_id', 'trip_date', 'booth_data', 'booth_id', 'section_origin', 'section_destination', 'status'
  ]),
  bilhetes_passagem: new Set([
    'id', 'trip_id', 'driver_id', 'section_name', 'payment_method', 'amount', 'passengers_count', 'created_at',
    'passenger_name', 'passenger_document', 'passenger_cpf', 'passenger_rg', 'passenger_phone', 'passenger_email',
    'seat_number', 'total_price', 'company_data', 'chave_acesso', 'protocolo_autorizacao', 'serie_documento',
    'numero_documento', 'qr_code_url', 'qr_code_base64', 'pdf_url', 'price_base', 'price_toll',
    'price_boarding_fee', 'price_fees', 'discount_value', 'system_id', 'departure_time', 'direction',
    'route_id', 'trip_date', 'booth_data', 'booth_id', 'section_origin', 'section_destination', 'status'
  ]),
  occurrences: new Set([
    'id', 'trip_id', 'vehicle_id', 'driver_id', 'occurrence_type', 'description', 'severity', 'status',
    'technician_report', 'estimated_cost_web', 'created_at', 'updated_at', 'category', 'service_description',
    'maintenance_start_at', 'maintenance_end_at', 'suggested_action', 'parts_replaced', 'technician_name',
    'timestamp', 'type', 'resolved_at', 'resolved_by', 'technician_name_manual', 'technician_name_text', 'system_id'
  ]),
  shifts: new Set([
    'id', 'date', 'driver_id', 'route_id', 'start_time', 'end_time', 'status', 'created_at', 'system_id'
  ]),
  notices: new Set([
    'id', 'createdAt', 'title', 'content', 'is_active', 'user_id', 'protocol', 'category', 'company_id',
    'created_at', 'created_by', 'attachment_info', 'target_role', 'target_audience', 'system_id'
  ]),
  notifications: new Set([
    'id', 'created_at', 'user_id', 'title', 'message', 'read', 'type', 'is_read', 'priority', 'category',
    'system_id', 'target_role', 'metadata'
  ]),
  maintenance: new Set([
    'id', 'vehicle_id', 'description', 'maintenance_date', 'next_inspection', 'status', 'created_at',
    'system_id', 'cost', 'performed_by', 'date', 'service_type'
  ]),
  ticketing_config: new Set([
    'id', 'updated_at', 'company_name', 'ticket_prefix', 'next_ticket_number', 'tax_rate', 'active_coupons',
    'boarding_box', 'credit_installments', 'min_installment_value', 'credit_surcharge', 'class_seats',
    'payment_methods', 'cnpj', 'state_registration', 'address', 'inscricao_municipal', 'cnae', 'logo_url',
    'logo_base64', 'ie_empresa', 'sac_telefone', 'system_id', 'custom_vehicle_classes', 'payment_methods_config'
  ]),
  payroll_rubrics: new Set([
    'id', 'type', 'code', 'name', 'system_id', 'updated_at', 'created_at', 'has_conditions', 'condition_value', 'condition_symbol'
  ]),
  role_configs: new Set([
    'id', 'name', 'permissions', 'base_salary', 'standard_shift', 'access_driver_guide', 'access_sales',
    'access_maintenance', 'access_global_management', 'access_monitoring', 'system_id', 'base_role', 'can_access_checkin', 'can_access_diary'
  ]),
  skins: new Set([
    'id', 'system_id', 'vehicle_id', 'name', 'image_url', 'version', 'created_at', 'bus_model', 'company_id', 'skin_name', 'file_url'
  ]),
  bus_stations: new Set([
    'id', 'created_at', 'updated_at', 'name', 'postal_code', 'state', 'street', 'number', 'complement',
    'neighborhood', 'city', 'platforms', 'address', 'created_by', 'updated_by', 'is_active', 'active',
    'status', 'deleted', 'deleted_at', 'system_id', 'company_id', 'enterprise_id', 'user_id', 'cep', 'uf',
    'logradouro', 'numero', 'complemento', 'bairro', 'cidade'
  ]),
  cities: new Set([
    'id', 'name', 'state', 'created_at', 'code', 'user_id', 'company_id', 'system_id', 'created_by', 'updated_by',
    'is_active', 'active', 'status'
  ]),
  time_tracking: new Set([
    'id', 'user_id', 'date', 'clock_in', 'break_start', 'break_end', 'clock_out', 'gps_location', 'notes',
    'created_at', 'total_daily_hours', 'system_id'
  ]),
  drivers: new Set([
    'id', 'full_name', 'cpf', 'cnh_number', 'cnh_category', 'cnh_expiration', 'phone', 'status', 'created_at', 'system_id'
  ]),
  inspections: new Set([
    'id', 'created_at', 'vehicle_id', 'inspector_name', 'items_checked', 'status', 'notes', 'agency', 'checklist', 'date', 'inspector_id', 'location', 'type', 'photo_url', 'system_id'
  ]),
  routes_logs: new Set([
    'id', 'system_id', 'route_id', 'trip_id', 'user_id', 'action', 'description', 'details', 'created_at'
  ])
};

export const cleanPayload = (table: TableName, obj: any, isUpdate = false) => {
  if (!obj || typeof obj !== 'object') return {};

  const cleaned: Record<string, any> = {};
  for (const [key, v] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (key === 'id' && !isUpdate && typeof v === 'undefined') continue;
    if (v === undefined) continue;

    if (v === '' || v === 'none' || v === 'null') {
      cleaned[key] = null;
      continue;
    }

    if (table === 'trips' && key === 'passengers' && typeof v === 'object' && v !== null) {
      cleaned[key] = safeJsonStringify(v);
      continue;
    }

    cleaned[key] = v;
  }

  if (table === 'companies') {
    if (obj.city && !cleaned.cidade) cleaned.cidade = obj.city;
    if (obj.city && !cleaned.address_city) cleaned.address_city = obj.city;
    if (obj.state && !cleaned.uf) cleaned.uf = obj.state;
    if (obj.state && !cleaned.address_state) cleaned.address_state = obj.state;
    if (obj.trade_name && !cleaned.nome_fantasia) cleaned.nome_fantasia = obj.trade_name;
    if (obj.corporate_name && !cleaned.razao_social) cleaned.razao_social = obj.corporate_name;
    if (obj.street && !cleaned.logradouro) cleaned.logradouro = obj.street;
    if (obj.neighborhood && !cleaned.bairro) cleaned.bairro = obj.neighborhood;
    if (obj.zip && !cleaned.cep) cleaned.cep = obj.zip;
    if (obj.zip_code && !cleaned.cep) cleaned.cep = obj.zip_code;
    if (obj.number && !cleaned.numero) cleaned.numero = obj.number;
    if (obj.phone && !cleaned.telefone) cleaned.telefone = obj.phone;
    if (!cleaned.name) cleaned.name = cleaned.nome_fantasia || cleaned.razao_social || 'Nova Empresa';
    if (cleaned.active === undefined) cleaned.active = true;
  }

  if (table === 'routes') {
    if (obj.route_code && !cleaned.line_code) cleaned.line_code = obj.route_code;
    if (obj.route_code && !cleaned.route_number) cleaned.route_number = obj.route_code;
    if (obj.route_code && !cleaned.prefixo_linha) cleaned.prefixo_linha = obj.route_code;
    if (obj.route_name && !cleaned.letreiro_principal) cleaned.letreiro_principal = obj.route_name;
    if (!cleaned.origin) cleaned.origin = (obj.name ? obj.name.split(' - ')[0] : null) || 'Origem';
    if (!cleaned.destination) cleaned.destination = (obj.name ? obj.name.split(' - ')[1] : null) || 'Destino';
    if (!cleaned.route_number) cleaned.route_number = cleaned.code || cleaned.prefixo_linha || '001';
    if (!cleaned.price && cleaned.tarifa_integral) cleaned.price = Number(cleaned.tarifa_integral);
    if (!cleaned.tarifa_integral && cleaned.price) cleaned.tarifa_integral = Number(cleaned.price);
    if (cleaned.active === undefined) cleaned.active = true;

    // Preserva todas as colunas de letreiro no Aiven PostgreSQL
    const chosenColor = obj.letreiro_cor || obj.display_main_color || obj.letreiro_principal_cor || '#ffaa00';
    cleaned.letreiro_cor = chosenColor;
    cleaned.display_main_color = chosenColor;
    cleaned.letreiro_principal_cor = chosenColor;
    cleaned.via1_cor = obj.via1_cor || chosenColor;
    cleaned.via2_cor = obj.via2_cor || chosenColor;
    cleaned.via3_cor = obj.via3_cor || chosenColor;

    const autuanteName = obj.empresa_autuante || '';
    const autuanteId = obj.empresa_autuante_id || '';

    let cleanSections: any[] = [];
    if (Array.isArray(cleaned.sections)) {
      cleanSections = cleaned.sections.filter((s: any) => s && !s.__route_meta__ && (s.name || s.origin || s.destination));
    } else if (typeof cleaned.sections === 'string') {
      try {
        const parsed = JSON.parse(cleaned.sections);
        if (Array.isArray(parsed)) {
          cleanSections = parsed.filter((s: any) => s && !s.__route_meta__ && (s.name || s.origin || s.destination));
        }
      } catch {}
    }

    cleanSections.push({
      __route_meta__: true,
      letreiro_cor: chosenColor,
      empresa_autuante: autuanteName,
      empresa_autuante_id: autuanteId
    });
    cleaned.sections = cleanSections;
  }

  if (table === 'drivers') {
    if (obj.name && !cleaned.full_name) cleaned.full_name = obj.name;
    if (!cleaned.full_name) cleaned.full_name = 'Motorista';
    if (!cleaned.cpf) cleaned.cpf = '00000000000';
    if (!cleaned.cnh_number) cleaned.cnh_number = cleaned.cnh || '00000000000';
    if (!cleaned.cnh_category) cleaned.cnh_category = cleaned.tipo_cnh || 'D';
    if (!cleaned.cnh_expiration) cleaned.cnh_expiration = cleaned.validade_cnh || '2029-12-31';
    if (!cleaned.status) cleaned.status = 'Ativo';
    delete cleaned.active;
    delete cleaned.name;
    delete cleaned.email;
    delete cleaned.photo_url;
  }

  if (table === 'vehicles') {
    if (!cleaned.plate) cleaned.plate = 'ABC-' + Math.floor(1000 + Math.random() * 9000);
    if (!cleaned.prefix) cleaned.prefix = cleaned.plate || '0000';
    if (!cleaned.model) cleaned.model = 'Ônibus Executivo';
    if (!cleaned.chassis) cleaned.chassis = cleaned.chassi || ('9BW' + Math.random().toString(36).substring(2, 9).toUpperCase() + '0001');
    if (!cleaned.status) cleaned.status = 'Ativo';
    if (cleaned.is_operational === undefined) cleaned.is_operational = true;
    if (cleaned.is_accessible === undefined) cleaned.is_accessible = false;
    if (cleaned.active === undefined) cleaned.active = true;
  }

  if (table === 'trips') {
    if (!cleaned.departure_time) cleaned.departure_time = cleaned.scheduled_start || cleaned.departure || '08:00';
    if (!cleaned.status) cleaned.status = 'agendado';
    if (cleaned.finished === undefined) cleaned.finished = false;
    if (cleaned.active === undefined) cleaned.active = true;
  }

  if (table === 'cities') {
    if (!cleaned.name) cleaned.name = 'Novo Município';
    if (!cleaned.state) cleaned.state = 'SP';
    if (cleaned.active === undefined) cleaned.active = true;
    if (cleaned.is_active === undefined) cleaned.is_active = true;
  }

  if (table === 'bus_stations') {
    if (!cleaned.name) cleaned.name = 'Terminal Rodoviário';
    if (cleaned.active === undefined) cleaned.active = true;
    if (cleaned.is_active === undefined) cleaned.is_active = true;
  }

  if (table === 'shifts') {
    if (!cleaned.date) cleaned.date = new Date().toISOString().substring(0, 10);
    if (!cleaned.start_time) cleaned.start_time = '08:00';
    if (!cleaned.end_time) cleaned.end_time = '16:00';
    if (!cleaned.status) cleaned.status = 'AGENDADO';
    if (!cleaned.driver_id) {
      cleaned.driver_id = cleaned.user_id || '00000000-0000-4000-a000-000000000001';
    }
    if (!cleaned.route_id) {
      cleaned.route_id = '00000000-0000-4000-a000-000000000001';
    }
  }

  if (table === 'system_settings') {
    if (!cleaned.key) {
      cleaned.key = obj.key || 'config_default';
    }
    const extraSettings: Record<string, any> = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!KNOWN_TABLE_COLUMNS.system_settings?.has(k)) {
        extraSettings[k] = val;
      }
    }
    if (Object.keys(extraSettings).length > 0) {
      let existingVal: Record<string, any> = {};
      try {
        if (typeof cleaned.value === 'string') existingVal = JSON.parse(cleaned.value);
        else if (typeof cleaned.value === 'object' && cleaned.value !== null) existingVal = cleaned.value;
      } catch {}
      cleaned.value = safeJsonStringify({ ...existingVal, ...extraSettings });
    }
  }

  if (table === 'imp_cards') {
    const metaObj: Record<string, any> = {};
    if (obj.abbreviation && typeof obj.abbreviation === 'string' && obj.abbreviation.trim()) {
      metaObj.abbreviation = obj.abbreviation.trim().toUpperCase();
    }
    if (obj.company_id) {
      metaObj.company_id = obj.company_id;
      cleaned.card_logo_left_url = String(obj.company_id);
    }
    if (obj.company_name) {
      metaObj.company_name = obj.company_name;
      cleaned.card_logo_right_url = String(obj.company_name);
    }
    if (obj.company_logo) {
      metaObj.company_logo = obj.company_logo;
      cleaned.left_logo_url = String(obj.company_logo);
    }
    if (obj.internal_code) {
      metaObj.internal_code = obj.internal_code;
      cleaned.right_logo_url = String(obj.internal_code);
    }
    if (Object.keys(metaObj).length > 0) {
      cleaned.ai_art_url = safeJsonStringify(metaObj);
    }
  }

  if (table === 'users') {
    if (cleaned.login_acesso && !cleaned.login) cleaned.login = cleaned.login_acesso;
    if (cleaned.login_acesso && !cleaned.username) cleaned.username = cleaned.login_acesso;
    if (cleaned.login_acesso && !cleaned.login_usuario) cleaned.login_usuario = cleaned.login_acesso;
    if (cleaned.full_name && !cleaned.name) cleaned.name = String(cleaned.full_name).split(' ')[0];
    if (cleaned.name && !cleaned.full_name) cleaned.full_name = cleaned.name;
    if (!isUpdate && !cleaned.email) cleaned.email = `${cleaned.login || 'usuario'}_${Date.now()}@vialivre.com.br`;
    if (cleaned.is_active === undefined && !isUpdate) cleaned.is_active = true;
    if (cleaned.active === undefined && !isUpdate) cleaned.active = true;
    if (!cleaned.status && !isUpdate) cleaned.status = 'active';
  }

  const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
  if (!cleaned.system_id || cleaned.system_id === 'sys-vialivre-default' || cleaned.system_id === 'default-sys' || cleaned.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb') {
    cleaned.system_id = activeSys;
  }

  const allowed = KNOWN_TABLE_COLUMNS[table];
  if (allowed) {
    for (const k of Object.keys(cleaned)) {
      if (!allowed.has(k)) {
        delete cleaned[k];
      }
    }
  }

  return cleaned;
};

export const isNetworkError = (error: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;

  const msg = (typeof error === 'string' ? error : (error.message || error.error || error.details || '')).toLowerCase();
  const name = (error.name || '').toLowerCase();

  return (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('net::err') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('esgotado') ||
    msg.includes('offline') ||
    msg.includes('load failed') ||
    msg.includes('http 503') ||
    msg.includes('não configurado')
  );
};

export const PUBLIC_PASSENGER_TABLES: TableName[] = [
  'routes',
  'itineraries',
  'bus_stations',
  'bus_terminals',
  'itinerary_sections',
  'route_sections',
  'cities'
];

const getDeletedIds = (table: TableName): Set<string> => {
  try {
    const raw = safeLocalStorage.getItem(`vialivre_deleted_${table}`);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
};

const addDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    set.add(id);
    safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
  } catch {}
};

const removeDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    if (set.has(id)) {
      set.delete(id);
      safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
    }
  } catch {}
};

const getLocalData = <T>(table: TableName): T[] => {
  const deleted = getDeletedIds(table);
  const isPublicPassenger = PUBLIC_PASSENGER_TABLES.includes(table);
  const activeSysId = currentSystemId || getStoredSystemId();

  try {
    let rawList: any[] = [];
    const raw = safeLocalStorage.getItem(`vialivre_db_${table}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rawList = parsed;
    }
    if ((table === 'bus_stations' || table === 'bus_terminals') && rawList.length === 0) {
      const bsRaw = safeLocalStorage.getItem('vialivre_bus_stations');
      if (bsRaw !== null) {
        const bsParsed = JSON.parse(bsRaw);
        if (Array.isArray(bsParsed)) rawList = bsParsed;
      }
    }

    if (rawList.length > 0) {
      return rawList.filter((x: any) => {
        if (!x || !x.id || deleted.has(x.id)) return false;
        if (isPublicPassenger || table === 'activation_keys' || !activeSysId) {
          return true;
        }
        if (!x.system_id) return true;
        if (activeSysId === DEFAULT_SYSTEM_UUID) {
          return x.system_id === DEFAULT_SYSTEM_UUID || x.system_id === 'sys-vialivre-default';
        }
        return x.system_id === activeSysId;
      }) as T[];
    }
  } catch {}

  return [];
};

const setLocalData = <T>(table: TableName, data: T[]): void => {
  try {
    safeLocalStorage.setItem(`vialivre_db_${table}`, JSON.stringify(data));
    if (table === 'bus_stations' || table === 'bus_terminals') {
      safeLocalStorage.setItem('vialivre_bus_stations', JSON.stringify(data));
    }
  } catch {}
};

const SYNC_QUEUE_KEY = 'vialivre_sync_queue';

const getSyncQueue = (): PendingAction[] => {
  try {
    const raw = safeLocalStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveSyncQueue = (queue: PendingAction[]): void => {
  try {
    safeLocalStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifyStatusChange();
  } catch {}
};

const addToSyncQueue = (item: Omit<PendingAction, 'id' | 'timestamp'>): PendingAction => {
  const queue = getSyncQueue();
  const newAction: PendingAction = {
    ...item,
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };

  const existingIdx = queue.findIndex((q) => q.table === item.table && q.recordId === item.recordId);
  if (existingIdx !== -1) {
    if (item.action === 'delete') {
      if (queue[existingIdx].action === 'create') {
        queue.splice(existingIdx, 1);
        saveSyncQueue(queue);
        return newAction;
      }
      queue[existingIdx] = newAction;
    } else if (item.action === 'update') {
      if (queue[existingIdx].action === 'create') {
        queue[existingIdx].payload = { ...queue[existingIdx].payload, ...item.payload };
      } else {
        queue[existingIdx] = newAction;
      }
    }
  } else {
    queue.push(newAction);
  }

  saveSyncQueue(queue);
  return newAction;
};

let dbStatus: DbStatus = {
  isOffline: false,
  pendingSyncCount: getSyncQueue().length,
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
  provider: 'Aiven PostgreSQL'
};

const statusListeners = new Set<(status: DbStatus) => void>();

const dispatchSystemToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vialivre-show-toast', { detail: { message, type } }));
  }
};

const notifyStatusChange = () => {
  dbStatus.pendingSyncCount = getSyncQueue().length;
  statusListeners.forEach((cb) => {
    try {
      cb({ ...dbStatus });
    } catch {}
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vialivre-db-status', { detail: { ...dbStatus } }));
  }
};

const updateStatus = (updates: Partial<DbStatus>) => {
  let changed = false;
  Object.entries(updates).forEach(([k, v]) => {
    if ((dbStatus as any)[k] !== v) {
      (dbStatus as any)[k] = v;
      changed = true;
    }
  });
  if (changed) {
    notifyStatusChange();
  }
};

if (typeof window !== 'undefined') {
  initSSE();

  const triggerAutoSync = async () => {
    db.checkConnection().then(async (isOnline) => {
      if (isOnline) {
        const result = await db.syncPendingActions();
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        if (result.syncedCount > 0) {
          dispatchSystemToast(`Sincronizado: ${result.syncedCount} itens salvos no Aiven PostgreSQL`, 'success');
        }
      }
    });
  };

  window.addEventListener('online', () => {
    dispatchSystemToast('Rede reconectada. Sincronizando com Aiven PostgreSQL...', 'info');
    triggerAutoSync();
  });

  window.addEventListener('offline', () => {
    updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
    dispatchSystemToast('Modo offline ativo (cache local)', 'warning');
  });

  window.addEventListener('focus', () => {
    triggerAutoSync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerAutoSync();
    }
  });

  setInterval(() => {
    if (!dbStatus.isSyncing) {
      db.syncPendingActions();
    }
  }, 25000);
}

function enrichRow<T>(table: TableName, item: any): T {
  if (!item || typeof item !== 'object') return item;

  if (table === 'system_settings' && item?.value) {
    try {
      const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      if (parsed && typeof parsed === 'object') {
        return { ...item, ...parsed } as T;
      }
    } catch {}
  }

  if (table === 'imp_cards') {
    let meta: any = null;
    if (item?.ai_art_url && typeof item.ai_art_url === 'string') {
      if (item.ai_art_url.startsWith('{')) {
        try {
          meta = JSON.parse(item.ai_art_url);
        } catch {}
      } else if (item.ai_art_url.startsWith('abbr:')) {
        meta = { abbreviation: item.ai_art_url.replace('abbr:', '') };
      }
    }
    return {
      ...item,
      company_id: meta?.company_id || item.card_logo_left_url || item.company_id || '',
      company_name: meta?.company_name || item.card_logo_right_url || item.company_name || '',
      company_logo: meta?.company_logo || item.left_logo_url || item.company_logo || '',
      internal_code: meta?.internal_code || item.right_logo_url || item.internal_code || '',
      abbreviation: meta?.abbreviation || item.abbreviation || ''
    } as T;
  }

  if (table === 'routes') {
    const rawSections = Array.isArray(item?.sections) ? item.sections : [];
    const realSections = rawSections.filter((s: any) => s && !s.__route_meta__ && (s.name || s.origin || s.destination));
    const meta = rawSections.find((s: any) => s && s.__route_meta__);
    const routeColor = item.letreiro_cor || item.display_main_color || item.letreiro_principal_cor || meta?.letreiro_cor || '#ffaa00';
    return {
      ...item,
      sections: realSections,
      letreiro_cor: routeColor,
      display_main_color: routeColor,
      letreiro_principal_cor: routeColor,
      via1_cor: item.via1_cor || routeColor,
      via2_cor: item.via2_cor || routeColor,
      via3_cor: item.via3_cor || routeColor,
      empresa_autuante: item.empresa_autuante || meta?.empresa_autuante || '',
      empresa_autuante_id: item.empresa_autuante_id || meta?.empresa_autuante_id || ''
    } as T;
  }

  if (table === 'companies') {
    return {
      ...item,
      city: item.city || item.cidade || item.address_city,
      state: item.state || item.uf || item.address_state,
      trade_name: item.trade_name || item.nome_fantasia,
      corporate_name: item.corporate_name || item.razao_social
    } as T;
  }

  return item as T;
}

export const db = {
  setSystemId: (id: string | null) => {
    currentSystemId = id;
    if (typeof window !== 'undefined' && id) {
      safeLocalStorage.setItem('vialivre_system_id', id);
    }
  },

  fetchRootAdminSystemId: (user?: Partial<User> | null) => fetchRootAdminSystemId(user),

  getSystemId: () => currentSystemId,

  getIsolatedTables: (): TableName[] => [
    'routes', 'trips', 'users', 'companies', 'vehicles', 'occurrences',
    'notices', 'ticket_sales', 'bilhetes_passagem', 'schedules', 'maintenance',
    'driver_logs', 'conductor_logs', 'dispatcher_logs', 'routes_logs',
    'ticketing_config', 'payroll_rubrics', 'payroll', 'role_configs',
    'notifications', 'shifts', 'daily_schedules', 'time_tracking',
    'system_settings', 'imp_cards', 'imp_card_recharges', 'user_occurrences',
    'traffic_violations', 'user_fines', 'job_applications', 'job_vacancies',
    'skins', 'trips_audit', 'subscriptions', 'ticket_booths', 'bus_stations',
    'bus_terminals', 'itineraries'
  ],

  getStatus: (): DbStatus => ({
    ...dbStatus,
    pendingSyncCount: getSyncQueue().length
  }),

  subscribeStatus: (callback: (status: DbStatus) => void): (() => void) => {
    statusListeners.add(callback);
    callback({ ...dbStatus, pendingSyncCount: getSyncQueue().length });
    return () => {
      statusListeners.delete(callback);
    };
  },

  checkConnection: async (): Promise<boolean> => {
    try {
      const res = await fetchWithRetry('/api/health', {
        headers: { 'Accept': 'application/json' },
        timeoutMs: 5000,
        retries: 1
      });

      if (!res.ok) {
        updateStatus({ isOffline: true, lastError: `Servidor respondeu HTTP ${res.status}` });
        return false;
      }

      const health = await res.json();
      const connected = Boolean(health?.database?.connected);
      if (!connected) {
        updateStatus({
          isOffline: true,
          lastError: health?.database?.error || 'DATABASE_URL não configurada no servidor',
          provider: 'Aiven PostgreSQL'
        });
        return false;
      }

      updateStatus({ isOffline: false, lastError: null, provider: 'Aiven PostgreSQL' });
      return true;
    } catch (e: any) {
      updateStatus({ isOffline: true, lastError: e?.message || 'Sem conexão com o servidor backend' });
      return false;
    }
  },

  syncPendingActions: async (): Promise<{ success: boolean; syncedCount: number }> => {
    const queue = getSyncQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };
    if (dbStatus.isSyncing) return { success: false, syncedCount: 0 };

    updateStatus({ isSyncing: true });
    let syncedCount = 0;
    const remainingQueue: PendingAction[] = [...queue];

    for (const item of queue) {
      try {
        if (item.action === 'create' || item.action === 'update') {
          const payload = cleanPayload(item.table, item.payload, item.action === 'update');
          const res = await fetchWithRetry(`/api/db/${item.table}`, {
            method: 'POST',
            headers: buildHeaders(undefined, payload.system_id),
            body: safeJsonStringify(payload),
            timeoutMs: 15000,
            retries: 2
          });
          if (!res.ok) {
            const msg = await res.text();
            throw new Error(`HTTP ${res.status}: ${msg}`);
          }
        } else if (item.action === 'delete') {
          const res = await fetchWithRetry(`/api/db/${item.table}/${encodeURIComponent(item.recordId)}`, {
            method: 'DELETE',
            headers: buildHeaders(),
            timeoutMs: 15000,
            retries: 2
          });
          if (!res.ok) {
            const msg = await res.text();
            throw new Error(`HTTP ${res.status}: ${msg}`);
          }
        }

        const idx = remainingQueue.findIndex((q) => q.id === item.id);
        if (idx !== -1) remainingQueue.splice(idx, 1);
        syncedCount++;
      } catch (err: any) {
        if (isNetworkError(err)) {
          updateStatus({ isOffline: true, lastError: err?.message || 'Erro de rede' });
          saveSyncQueue(remainingQueue);
          updateStatus({ isSyncing: false });
          return { success: false, syncedCount };
        } else {
          const idx = remainingQueue.findIndex((q) => q.id === item.id);
          if (idx !== -1) remainingQueue.splice(idx, 1);
        }
      }
    }

    saveSyncQueue(remainingQueue);
    updateStatus({ isSyncing: false, isOffline: false, lastSyncAt: Date.now(), lastError: null });
    return { success: true, syncedCount };
  },

  fetchAll: (() => {
    const inFlightFetches = new Map<string, Promise<any[]>>();
    let activeFetches = 0;
    const waitQueue: Array<() => void> = [];
    const MAX_CONCURRENT_FETCHES = 4;

    const acquireSlot = async () => {
      if (activeFetches < MAX_CONCURRENT_FETCHES) {
        activeFetches++;
        return;
      }
      await new Promise<void>((resolve) => waitQueue.push(resolve));
      activeFetches++;
    };

    const releaseSlot = () => {
      activeFetches = Math.max(0, activeFetches - 1);
      const next = waitQueue.shift();
      if (next) next();
    };

    return async <T>(table: TableName, options?: { bypassSystemId?: boolean; filterSystemId?: string }): Promise<T[]> => {
      const isPublicPassenger = PUBLIC_PASSENGER_TABLES.includes(table);
      const activeSysId = options?.filterSystemId || currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;

      const params = new URLSearchParams();
      let headerSysId: string | null = activeSysId;

      if (options?.bypassSystemId || (isPublicPassenger && !currentSystemId && !options?.filterSystemId)) {
        params.set('bypass_system_id', 'true');
        headerSysId = null;
      } else if (table === 'activation_keys' && options?.bypassSystemId) {
        params.set('bypass_system_id', 'true');
        headerSysId = null;
      } else if (table === 'users' && !currentSystemId && !options?.filterSystemId) {
        params.set('bypass_system_id', 'true');
        headerSysId = null;
      } else if (!activeSysId && !isPublicPassenger && table !== 'users' && table !== 'companies' && table !== 'system_settings') {
        return [];
      }

      const url = `/api/db/${table}${params.toString() ? `?${params.toString()}` : ''}`;
      const cacheKey = `${url}::${headerSysId || 'public'}`;
      const existingPromise = inFlightFetches.get(cacheKey);
      if (existingPromise) {
        return existingPromise as Promise<T[]>;
      }

      const fetchPromise = (async () => {
        await acquireSlot();
        try {
          const res = await fetchWithRetry(url, {
            headers: headerSysId ? { 'Accept': 'application/json', 'x-system-id': headerSysId } : { 'Accept': 'application/json' },
            timeoutMs: 15000,
            retries: 3
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }

          const data = await res.json();
          updateStatus({ isOffline: false, lastError: null });

          if (Array.isArray(data)) {
            let enriched = data.map((row) => enrichRow<T>(table, row));

            if (enriched.length === 0 && table === 'system_settings') {
              const globalRes = await fetchWithRetry('/api/db/system_settings?bypass_system_id=true&limit=1', {
                headers: { 'Accept': 'application/json' },
                timeoutMs: 10000,
                retries: 2
              });
              if (globalRes.ok) {
                const globalData = await globalRes.json();
                if (Array.isArray(globalData) && globalData.length > 0) {
                  enriched = [enrichRow<T>('system_settings', globalData[0])];
                }
              }
            }

            setLocalData(table, enriched);
            return enriched;
          }
          return [];
        } catch (e: any) {
          if (isNetworkError(e)) {
            updateStatus({ isOffline: true, lastError: e?.message || 'Backend Aiven indisponível, usando cache local' });
          }
          return getLocalData<T>(table);
        } finally {
          releaseSlot();
          inFlightFetches.delete(cacheKey);
        }
      })();

      inFlightFetches.set(cacheKey, fetchPromise);
      return fetchPromise;
    };
  })(),

  fetchAllGlobal: async <T>(table: TableName): Promise<T[]> => {
    return db.fetchAll<T>(table, { bypassSystemId: true });
  },

  clearLocalCache: () => {
    try {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('vialivre_db_') || key.startsWith('vialivre_deleted_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch {}
  },

  create: async <T extends { id?: string; system_id?: string }>(table: TableName, item: Partial<T>): Promise<T | null> => {
    const payload = cleanPayload(table, item, false);

    if (table === 'system_settings') {
      try {
        const res = await fetchWithRetry('/api/db/system_settings?limit=1', {
          headers: buildHeaders(),
          timeoutMs: 10000
        });
        if (res.ok) {
          const existing = await res.json();
          if (Array.isArray(existing) && existing.length > 0 && existing[0]?.id) {
            return (await db.update('system_settings', { ...item, id: existing[0].id } as any)) as T;
          }
        }
      } catch {}
    }

    if (!payload.id || String(payload.id).trim() === '') {
      payload.id = generateUUID();
    }

    const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
    if (!payload.system_id || payload.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb' || payload.system_id === 'sys-vialivre-default' || payload.system_id === 'default-sys') {
      payload.system_id = activeSys;
    }

    if (payload.id) {
      removeDeletedId(table, String(payload.id));
    }

    try {
      const res = await fetchWithRetry(`/api/db/${table}`, {
        method: 'POST',
        headers: buildHeaders(undefined, payload.system_id),
        body: safeJsonStringify(payload),
        timeoutMs: 15000
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const saved = await res.json();
      const savedResult = enrichRow<T>(table, saved || payload);

      const localList = getLocalData<any>(table);
      const updatedList = [savedResult, ...localList.filter((x: any) => x.id !== (savedResult as any).id)];
      setLocalData(table, updatedList);
      updateStatus({ isOffline: false, lastError: null });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: savedResult } }));
      }

      return savedResult;
    } catch (e: any) {
      console.warn(`[POSTGRES_CREATE_FALLBACK] Falha ao gravar em '${table}' no Aiven PostgreSQL:`, e?.message || e);

      if (isNetworkError(e)) {
        addToSyncQueue({ table, action: 'create', payload, recordId: String(payload.id) });
        const localList = getLocalData<any>(table);
        const updatedList = [payload, ...localList.filter((x: any) => x.id !== payload.id)];
        setLocalData(table, updatedList);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: payload } }));
        }
        return payload as T;
      }

      if (table === 'notifications') {
        const localList = getLocalData<any>(table);
        const updatedList = [payload, ...localList.filter((x: any) => x.id !== payload.id)];
        setLocalData(table, updatedList);
        return payload as T;
      }

      dispatchSystemToast(`Erro ao salvar no PostgreSQL (${table}): ${e?.message || 'Falha na gravação'}`, 'error');
      throw e;
    }
  },

  update: async <T extends { id: string; system_id?: string }>(table: TableName, item: T): Promise<T | null> => {
    const payload = cleanPayload(table, item, true);

    if (item.id) {
      removeDeletedId(table, item.id);
    }

    const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
    if (!payload.system_id || payload.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb' || payload.system_id === 'sys-vialivre-default') {
      payload.system_id = activeSys;
    }

    // Exclusão automática da chave antiga ao trocar a chave de acesso de um administrador
    if (table === 'users' && (payload.activation_key || (item as any).activation_key)) {
      try {
        const newKey = String(payload.activation_key || (item as any).activation_key || '').trim();
        const existingRes = await fetchWithRetry(`/api/db/users?id=${encodeURIComponent(item.id)}&bypass_system_id=true`, {
          headers: buildHeaders(),
          timeoutMs: 10000
        });
        if (existingRes.ok) {
          const rows = await existingRes.json();
          const existingUser = Array.isArray(rows) ? rows[0] : null;
          if (existingUser?.activation_key) {
            const oldKey = String(existingUser.activation_key).trim();
            if (oldKey && oldKey.toUpperCase() !== newKey.toUpperCase()) {
              await db.deleteActivationKeyByCode(oldKey);
            }
          }
        }
      } catch {}
    }

    try {
      const res = await fetchWithRetry(`/api/db/${table}/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: buildHeaders(undefined, payload.system_id),
        body: safeJsonStringify(payload),
        timeoutMs: 15000
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const updated = await res.json();
      const updatedItem = enrichRow<T>(table, updated || { ...item, ...payload });

      const localList = getLocalData<any>(table);
      const idx = localList.findIndex((x: any) => x.id === item.id);
      if (idx !== -1) localList[idx] = updatedItem;
      else localList.push(updatedItem);
      setLocalData(table, localList);
      updateStatus({ isOffline: false, lastError: null });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: updatedItem } }));
      }

      return updatedItem;
    } catch (e: any) {
      console.warn(`[POSTGRES_UPDATE_FALLBACK] Falha ao atualizar em '${table}' no Aiven PostgreSQL:`, e?.message || e);

      if (isNetworkError(e)) {
        addToSyncQueue({ table, action: 'update', payload, recordId: item.id });
        const localList = getLocalData<any>(table);
        const idx = localList.findIndex((x: any) => x.id === item.id);
        if (idx !== -1) localList[idx] = { ...localList[idx], ...payload };
        else localList.push(payload);
        setLocalData(table, localList);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: payload } }));
        }
        return item;
      }

      dispatchSystemToast(`Erro ao atualizar no PostgreSQL (${table}): ${e?.message || 'Falha na atualização'}`, 'error');
      throw e;
    }
  },

  delete: async (table: TableName, id: string): Promise<boolean> => {
    if (!id || typeof id !== 'string' || (id as any).nativeEvent || (id as any).target) {
      return false;
    }

    addDeletedId(table, id);

    const localList = getLocalData<any>(table);
    const updatedList = localList.filter((x: any) => x && x.id !== id);
    setLocalData(table, updatedList);

    try {
      const res = await fetchWithRetry(`/api/db/${table}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: buildHeaders(),
        timeoutMs: 15000
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'delete', id } }));
      }
      return true;
    } catch (e: any) {
      if (isNetworkError(e)) {
        addToSyncQueue({ table, action: 'delete', recordId: id });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'delete', id } }));
      }
      return true;
    }
  },

  clearTable: async (table: TableName): Promise<boolean> => {
    try {
      const localList = getLocalData<any>(table);
      localList.forEach((item: any) => {
        if (item && item.id) addDeletedId(table, item.id);
      });
      setLocalData(table, []);
      await fetchWithRetry(`/api/db/${table}`, {
        method: 'DELETE',
        headers: buildHeaders(),
        timeoutMs: 15000
      });
      return true;
    } catch {
      setLocalData(table, []);
      return true;
    }
  },

  initializeRealtime: (onEvent: (table: string, payload: any) => void): any => {
    if (typeof window === 'undefined') return { unsubscribe: () => {} };

    let sse: EventSource | null = null;
    try {
      sse = new EventSource('/api/events');
      sse.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.table) {
            onEvent(data.table, data);
          }
        } catch {}
      };
      sse.onerror = () => {};
    } catch (e) {
      console.warn('[Realtime] Falha ao conectar SSE:', e);
    }

    const localDataHandler = (e: any) => {
      const detail = e.detail;
      if (detail?.table && detail?.item) {
        onEvent(detail.table, {
          eventType: detail.action === 'create' ? 'INSERT' : detail.action === 'update' ? 'UPDATE' : 'DELETE',
          new: detail.item,
          old: detail.item
        });
      }
    };

    window.addEventListener('vialivre-data-changed', localDataHandler);

    return {
      unsubscribe: () => {
        if (sse) sse.close();
        window.removeEventListener('vialivre-data-changed', localDataHandler);
      }
    };
  },

  subscribeTable: (
    table: TableName,
    onEvent: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void
  ): { unsubscribe: () => void } => {
    try {
      const channelId = `rt-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = postgresClient
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (p: any) => {
          onEvent({
            eventType: (p.eventType || 'UPDATE') as any,
            new: p.new,
            old: p.old
          });
        })
        .subscribe();

      const localHandler = (e: any) => {
        const detail = e.detail;
        if (detail?.table === table) {
          onEvent({
            eventType: detail.action === 'create' ? 'INSERT' : detail.action === 'update' ? 'UPDATE' : 'DELETE',
            new: detail.item,
            old: detail.item || { id: detail.id }
          });
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('vialivre-data-changed', localHandler);
      }

      return {
        unsubscribe: () => {
          postgresClient.removeChannel(channel);
          if (typeof window !== 'undefined') {
            window.removeEventListener('vialivre-data-changed', localHandler);
          }
        }
      };
    } catch {
      return { unsubscribe: () => {} };
    }
  },

  subscribeTables: (
    tables: TableName[],
    onEvent: (table: TableName, payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void
  ): { unsubscribe: () => void } => {
    const subs = tables.map((tbl) => db.subscribeTable(tbl, (p) => onEvent(tbl, p)));
    return {
      unsubscribe: () => {
        subs.forEach((s) => s.unsubscribe());
      }
    };
  },

  // MÉTODOS DE CONSULTA
  getUsers: () => db.fetchAll<User>('users'),
  getAllUsers: () => db.fetchAll<User>('users', { bypassSystemId: true }),

  getDrivers: () => db.fetchAll<any>('drivers'),
  getAllDrivers: () => db.fetchAll<any>('drivers', { bypassSystemId: true }),

  getCities: () => db.fetchAll<City>('cities'),
  getAllCities: () => db.fetchAll<City>('cities'),
  getPublicCities: () => db.fetchAll<City>('cities', { bypassSystemId: true }),

  getRoutes: () => db.fetchAll<BusRoute>('routes'),
  getAllRoutes: () => db.fetchAll<BusRoute>('routes'),
  getPublicRoutes: () => db.fetchAll<BusRoute>('routes', { bypassSystemId: true }),

  getTrips: () => db.fetchAll<Trip>('trips'),
  getAllTrips: () => db.fetchAll<Trip>('trips'),

  getSchedules: () => db.fetchAll<any>('schedules'),
  getAllSchedules: () => db.fetchAll<any>('schedules'),

  getCompanies: () => db.fetchAll<Company>('companies'),
  getAllCompanies: () => db.fetchAll<Company>('companies'),

  getVehicles: () => db.fetchAll<Vehicle>('vehicles'),
  getAllVehicles: () => db.fetchAll<Vehicle>('vehicles'),

  getReports: () => db.fetchAll<IssueReport>('occurrences'),
  getAllReports: () => db.fetchAll<IssueReport>('occurrences'),

  getNotices: () => db.fetchAll<Notice>('notices'),
  getAllNotices: () => db.fetchAll<Notice>('notices'),

  getSales: () => db.fetchAll<TicketSale>('ticket_sales'),
  getAllSales: () => db.fetchAll<TicketSale>('ticket_sales'),

  getBilhetesPassagem: () => db.fetchAll<TicketSale>('bilhetes_passagem'),

  getInspections: () => db.fetchAll<Inspection>('inspections'),
  getAllInspections: () => db.fetchAll<Inspection>('inspections'),

  getDailySchedules: () => db.fetchAll<any>('daily_schedules'),
  getAllDailySchedules: () => db.fetchAll<any>('daily_schedules'),

  getTicketingConfig: () => db.fetchAll<TicketingConfig>('ticketing_config'),
  getRubrics: () => db.fetchAll<PayrollRubric>('payroll_rubrics'),
  getRoleConfigs: () => db.fetchAll<RoleConfig>('role_configs'),
  getNotifications: () => db.fetchAll<AppNotification>('notifications'),
  getShifts: () => db.fetchAll<Shift>('shifts'),
  getOccurrences: () => db.fetchAll<any>('user_occurrences'),
  getDriverLogs: () => db.fetchAll<any>('driver_logs'),
  getRoutesLogs: () => db.fetchAll<any>('routes_logs'),
  getSystemSettings: () => db.fetchAll<SystemSettings>('system_settings'),
  getImpCards: () => db.fetchAll<any>('imp_cards'),
  getImpCardRecharges: () => db.fetchAll<any>('imp_card_recharges'),
  getTrafficViolations: () => db.fetchAll<any>('traffic_violations'),
  getUserFines: () => db.fetchAll<any>('user_fines'),
  getJobApplications: () => db.fetchAll<any>('job_applications'),
  getJobVacancies: () => db.fetchAll<any>('job_vacancies'),
  getSkins: () => db.fetchAll<any>('skins'),
  getTripsAudit: () => db.fetchAll<any>('trips_audit'),
  getTicketBooths: () => db.fetchAll<any>('ticket_booths'),
  getBusStations: () => db.fetchAll<any>('bus_stations'),
  getPublicBusStations: () => db.fetchAll<any>('bus_stations', { bypassSystemId: true }),
  getBusTerminals: () => db.fetchAll<any>('bus_terminals'),
  getPublicBusTerminals: () => db.fetchAll<any>('bus_terminals', { bypassSystemId: true }),
  getItineraries: () => db.fetchAll<any>('itineraries'),
  getPublicItineraries: () => db.fetchAll<any>('itineraries', { bypassSystemId: true }),

  getSubscriptions: () => db.fetchAll<any>('subscriptions'),
  getAllSubscriptions: () => db.fetchAll<any>('subscriptions'),

  getActivationKeys: () => db.fetchAll<any>('activation_keys'),
  getAllActivationKeys: () => db.fetchAll<any>('activation_keys'),

  deleteActivationKeyByCode: async (keyCode: string): Promise<boolean> => {
    if (!keyCode || typeof keyCode !== 'string') return false;
    const cleanKey = keyCode.trim();
    if (!cleanKey) return false;
    try {
      const qp = new URLSearchParams({
        field: 'key_code',
        value: cleanKey,
        case_insensitive: 'true'
      });
      await fetchWithRetry(`/api/db/activation_keys?${qp.toString()}`, {
        method: 'DELETE',
        headers: buildHeaders(),
        timeoutMs: 10000
      });

      const localKeys = getLocalData<any>('activation_keys');
      const filtered = localKeys.filter((k: any) => (k.key_code || '').trim().toUpperCase() !== cleanKey.toUpperCase());
      setLocalData('activation_keys', filtered);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table: 'activation_keys', action: 'delete' } }));
      }
      return true;
    } catch (err) {
      console.error('[DELETE_OLD_KEY_EXCEPTION] Falha ao tentar excluir chave antiga:', err);
      return false;
    }
  },

  getTimeTracking: () => db.fetchAll<TimeEntry>('time_tracking'),

  getTimeEntries: async (userId?: string): Promise<TimeEntry[]> => {
    try {
      const qp = new URLSearchParams();
      if (userId) qp.set('user_id', userId);
      const url = `/api/db/time_tracking${qp.toString() ? `?${qp.toString()}` : ''}`;
      const res = await fetchWithRetry(url, {
        headers: buildHeaders(),
        timeoutMs: 15000
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLocalData('time_tracking', data);
          pontoIndexedDB.cacheTimeEntries(data as TimeEntry[]).catch(() => {});
          return data as TimeEntry[];
        }
      }
    } catch (err) {
      console.warn('Falha na busca de ponto remoto:', err);
    }

    try {
      const idbEntries = await pontoIndexedDB.getCachedTimeEntries(userId);
      if (idbEntries.length > 0) return idbEntries;
    } catch {}

    const local = getLocalData<TimeEntry>('time_tracking');
    return userId ? local.filter((e) => (e as any).user_id === userId) : local;
  },

  saveTimeEntry: async (entry: Partial<TimeEntry>): Promise<TimeEntry | null> => {
    return db.create<TimeEntry>('time_tracking', entry);
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const res = await fetchWithRetry(`/api/db/users?bypass_system_id=true&or=${encodeURIComponent(`id.eq.${userId},email.eq.${userId}`)}`, {
        headers: buildHeaders(),
        timeoutMs: 10000
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data[0] as User;
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil no Aiven PostgreSQL:', e);
    }
    const localUsers = getLocalData<User>('users');
    return localUsers.find((u) => u.id === userId || (u as any).email === userId) || null;
  },

  updateUserProfile: async (userData: Partial<User> & { id: string }): Promise<User | null> => {
    return db.update<User>('users', userData as User);
  },

  // SINCRONIZAÇÃO COM O PROJETO VIALIVRE MOBILE (VIA EXPRESS API + AIVEN POSTGRESQL)
  getMobileSyncConfig: () => {
    const activeSysId = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return {
      appName: 'ViaLivre Gestão & Mobile Gateway',
      mobileAppTarget: 'ViaLivre Mobile',
      version: '2.0.0',
      databaseProvider: 'Aiven PostgreSQL (pg)',
      systemId: activeSysId,
      apiBaseUrl: origin,
      eventsStreamUrl: `${origin}/api/events`,
      realtimeChannels: [
        'trips',
        'schedules',
        'routes',
        'bus_stations',
        'notices',
        'imp_cards',
        'imp_card_recharges',
        'ticket_sales',
        'bilhetes_passagem',
        'driver_logs',
        'occurrences'
      ],
      publicPassengerTables: PUBLIC_PASSENGER_TABLES,
      timestamp: Date.now()
    };
  },

  restoreBackup: async (
    rawBackup: Record<string, any[]>,
    targetSystemId?: string | null,
    onProgress?: (info: { currentTable: string; completed: number; total: number; percent: number }) => void
  ): Promise<{
    success: boolean;
    targetSystemId: string;
    tablesProcessed: number;
    tablesRestored: number;
    recordsRestored: number;
    failedCount: number;
    tableStats: Record<string, { restored: number; failed: number }>;
    errors: Array<{ table: string; id?: string; message: string }>;
  }> => {
    const resolvedSysId =
      targetSystemId &&
      targetSystemId !== 'sys-vialivre-default' &&
      targetSystemId !== 'default-sys'
        ? String(targetSystemId)
        : currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;

    db.setSystemId(resolvedSysId);
    db.clearLocalCache();

    const tablesMap = extractNormalizedBackupTables(rawBackup);
    const nonEmptyEntries = Object.entries(tablesMap).filter(([, rows]) => Array.isArray(rows) && rows.length > 0);
    if (nonEmptyEntries.length === 0) {
      throw new Error('Nenhuma tabela com registros válidos localizada no arquivo de backup.');
    }

    const prioritySet = ALL_BACKUP_TABLES;
    const orderedKeys = [
      ...prioritySet.filter((t) => tablesMap[t] && tablesMap[t].length > 0),
      ...nonEmptyEntries.map(([k]) => k).filter((k) => !prioritySet.includes(k as TableName))
    ];

    let tablesRestored = 0;
    let recordsRestored = 0;
    let failedCount = 0;
    const tableStats: Record<string, { restored: number; failed: number }> = {};
    const errors: Array<{ table: string; id?: string; message: string }> = [];

    for (let i = 0; i < orderedKeys.length; i++) {
      const table = orderedKeys[i];
      const rows = tablesMap[table] || [];

      if (onProgress) {
        onProgress({
          currentTable: table,
          completed: i,
          total: orderedKeys.length,
          percent: Math.round((i / orderedKeys.length) * 100)
        });
      }

      // Envia em lotes por tabela para atualizar o progresso em tempo real sem sobrecarregar o servidor
      const CHUNK_SIZE = 150;
      let tblRestored = 0;
      let tblFailed = 0;

      for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
        const chunk = rows.slice(offset, offset + CHUNK_SIZE);
        const res = await fetchWithRetry('/api/backup/restore', {
          method: 'POST',
          headers: buildHeaders(undefined, resolvedSysId),
          body: safeJsonStringify({
            targetSystemId: resolvedSysId,
            backup: { [table]: chunk }
          }),
          timeoutMs: 45000,
          retries: 2
        });

        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData?.error || `Erro HTTP ${res.status} ao restaurar tabela ${table}`);
        }

        tblRestored += Number(resData?.recordsRestored || 0);
        tblFailed += Number(resData?.failedCount || 0);
        if (Array.isArray(resData?.errors)) {
          for (const e of resData.errors) {
            if (errors.length < 30) errors.push(e);
          }
        }
      }

      tableStats[table] = { restored: tblRestored, failed: tblFailed };
      recordsRestored += tblRestored;
      failedCount += tblFailed;
      if (tblRestored > 0) {
        tablesRestored++;
      }

      if (onProgress) {
        onProgress({
          currentTable: table,
          completed: i + 1,
          total: orderedKeys.length,
          percent: Math.round(((i + 1) / orderedKeys.length) * 100)
        });
      }
    }

    db.clearLocalCache();
    updateStatus({ isOffline: false, lastError: null, lastSyncAt: Date.now() });

    return {
      success: recordsRestored > 0,
      targetSystemId: resolvedSysId,
      tablesProcessed: orderedKeys.length,
      tablesRestored,
      recordsRestored,
      failedCount,
      tableStats,
      errors
    };
  },

  syncWithMobile: async (): Promise<{ success: boolean; syncedCount: number; message: string }> => {
    try {
      const localResult = await db.syncPendingActions();

      try {
        await fetchWithRetry('/api/events/broadcast', {
          method: 'POST',
          headers: buildHeaders(),
          body: safeJsonStringify({
            table: 'mobile_sync',
            eventType: 'UPDATE',
            payload: {
              type: 'SYNC_TRIGGER',
              origin: 'vialivre_gestao',
              system_id: currentSystemId || getStoredSystemId(),
              timestamp: Date.now()
            }
          }),
          timeoutMs: 5000,
          retries: 1
        });
      } catch {}

      if (typeof window !== 'undefined') {
        localStorage.setItem('fluxo_session_sync_timestamp', String(Date.now()));
        window.dispatchEvent(new CustomEvent('vialivre-sync-timestamp-updated'));
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        window.dispatchEvent(
          new CustomEvent('vialivre-mobile-sync-event', {
            detail: { type: 'MANUAL_SYNC', timestamp: Date.now() }
          })
        );
      }

      return {
        success: true,
        syncedCount: localResult.syncedCount,
        message: 'Sincronização bidirecional via Aiven PostgreSQL executada com sucesso!'
      };
    } catch (err: any) {
      return {
        success: false,
        syncedCount: 0,
        message: err?.message || 'Falha na sincronização móvel.'
      };
    }
  }
};