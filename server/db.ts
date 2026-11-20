import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

export const DEFAULT_SYSTEM_UUID = '44d472ca-9311-45e1-9297-c442e016e1a6';

const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();

function createPgPool(connectionString: string): Pool | null {
  if (!connectionString) return null;
  const globalStore = globalThis as typeof globalThis & { __vialivrePgPool?: Pool };
  if (globalStore.__vialivrePgPool) {
    return globalStore.__vialivrePgPool;
  }

  let poolInstance: Pool;
  const baseConfig = {
    ssl: {
      rejectUnauthorized: false
    },
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000,
    statement_timeout: 15000,
    query_timeout: 15000,
    lock_timeout: 8000,
    allowExitOnIdle: true
  };

  try {
    try {
      const parsed = new URL(connectionString);
      parsed.searchParams.delete('sslmode');
      parsed.searchParams.delete('sslcert');
      parsed.searchParams.delete('sslkey');
      parsed.searchParams.delete('sslrootcert');
      poolInstance = new Pool({
        connectionString: parsed.toString(),
        ...baseConfig
      });
    } catch {
      poolInstance = new Pool({
        connectionString,
        ...baseConfig
      });
    }

    poolInstance.on('error', (err) => {
      console.error('[Aiven PostgreSQL] Erro inesperado no pool de conexões:', err.message);
    });

    globalStore.__vialivrePgPool = poolInstance;
    return poolInstance;
  } catch (err: any) {
    console.warn('[Aiven PostgreSQL] Falha não-fatal ao inicializar pool com DATABASE_URL:', err?.message || err);
    return null;
  }
}

export const pool: Pool | null = createPgPool(rawDatabaseUrl);

if (!pool) {
  console.warn('[Aiven PostgreSQL] DATABASE_URL não configurada no ambiente. Defina DATABASE_URL para conectar ao PostgreSQL.');
}

function isRetryablePgError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '53300' ||
    code === '53400' ||
    code === '57014' ||
    code === '55P03' ||
    code === '08006' ||
    code === '08001' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'EPIPE' ||
    msg.includes('too many clients') ||
    msg.includes('remaining connection slots') ||
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('timeout exceeded when trying to connect') ||
    msg.includes('query read timeout') ||
    msg.includes('statement timeout') ||
    msg.includes('canceling statement due to statement timeout')
  );
}

const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runQuery<T = any>(sql: string, params?: any[], maxRetries = 4): Promise<{ rows: T[]; rowCount: number | null }> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries && isRetryablePgError(err)) {
        const delay = 150 * Math.pow(2, attempt) + Math.floor(Math.random() * 120);
        await waitMs(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function connectWithRetry(maxRetries = 4): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await pool.connect();
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries && isRetryablePgError(err)) {
        const delay = 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await waitMs(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ==========================================
// 1. UTILITÁRIOS DE SEGURANÇA E SENHA
// ==========================================
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

export function hashPassword(plainPassword: string): string {
  if (!plainPassword) return '';
  if (plainPassword.startsWith('scrypt:')) return plainPassword;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(plainPassword: string, storedValue?: string | null): boolean {
  if (!plainPassword || !storedValue) return false;
  if (storedValue.startsWith('scrypt:')) {
    const parts = storedValue.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    try {
      const derived = crypto.scryptSync(plainPassword, salt, 64);
      const originalBuf = Buffer.from(originalHash, 'hex');
      if (derived.length !== originalBuf.length) return false;
      return crypto.timingSafeEqual(derived, originalBuf);
    } catch {
      return false;
    }
  }
  // Suporte de migração para senhas legadas antes do hash
  return storedValue === plainPassword;
}

export function sanitizeUserOutput<T extends Record<string, any>>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const copy: Record<string, any> = { ...user };
  delete copy.password_hash;
  delete copy.senha_acesso;
  delete copy.password;
  delete copy.senha;
  delete copy.login_senha;
  return copy as T;
}

// ==========================================
// 2. TABELAS PERMITIDAS & INICIALIZAÇÃO (initDatabase)
// ==========================================
export const ALLOWED_TABLES = new Set<string>([
  'users',
  'activation_keys',
  'companies',
  'routes',
  'vehicles',
  'drivers',
  'schedules',
  'notifications',
  'routes_logs',
  'bilhetes_passagem',
  'trips',
  'ticket_sales',
  'occurrences',
  'cities',
  'notices',
  'push_subscriptions',
  'maintenance',
  'maintenance_logs',
  'inspections',
  'ticketing_config',
  'payroll_rubrics',
  'payroll',
  'payroll_details',
  'salary_items',
  'role_configs',
  'shifts',
  'daily_schedules',
  'time_tracking',
  'driver_logs',
  'conductor_logs',
  'dispatcher_logs',
  'system_settings',
  'system_versions',
  'imp_cards',
  'imp_card_recharges',
  'user_occurrences',
  'traffic_violations',
  'user_fines',
  'job_applications',
  'job_vacancies',
  'skins',
  'trips_audit',
  'subscriptions',
  'ticket_booths',
  'bus_stations',
  'bus_terminals',
  'itineraries',
  'itinerary_sections',
  'route_sections',
  'passengers',
  'cashier_logs',
  'timetables',
  'uploads',
  'email_verification_codes'
]);

export const PUBLIC_PASSENGER_TABLES = new Set<string>([
  'routes',
  'itineraries',
  'bus_stations',
  'bus_terminals',
  'itinerary_sections',
  'route_sections',
  'cities',
  'timetables'
]);

let dbInitialized = false;
let initPromise: Promise<boolean> | null = null;
const tableColumnsCache = new Map<string, Map<string, string>>();

function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identificador SQL inválido: ${name}`);
  }
  return name;
}

export async function initDatabase(): Promise<boolean> {
  if (!pool) {
    console.warn('[initDatabase] Pool PostgreSQL indisponível (DATABASE_URL ausente).');
    return false;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await connectWithRetry();

      const ddlStatements: string[] = [
        // 1. users
        `CREATE TABLE IF NOT EXISTS public.users (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          full_name TEXT,
          name TEXT,
          email TEXT,
          login_acesso TEXT,
          senha_acesso TEXT,
          password_hash TEXT,
          role TEXT DEFAULT 'DRIVER',
          job_title TEXT,
          unidade TEXT,
          company_id TEXT,
          cpf TEXT,
          pis TEXT,
          registration_id TEXT,
          registration_number TEXT,
          phone TEXT,
          mobile_phone TEXT,
          photo_url TEXT,
          avatar_url TEXT,
          activation_key TEXT,
          is_full_admin BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          active BOOLEAN DEFAULT true,
          status TEXT DEFAULT 'active',
          permissions JSONB DEFAULT '[]'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          work_municipality_id TEXT,
          license_type TEXT,
          license_validity TEXT,
          license_number TEXT,
          birth_date TEXT,
          admission_date TEXT,
          resignation_date TEXT,
          blood_type TEXT,
          cep TEXT,
          address_street TEXT,
          address_number TEXT,
          address_complement TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          work_shift_type TEXT,
          daily_hours_target TEXT,
          standard_clock_in TEXT,
          standard_clock_out TEXT,
          standard_interval TEXT,
          saturday_clock_in TEXT,
          saturday_clock_out TEXT,
          saturday_interval TEXT,
          sunday_clock_in TEXT,
          sunday_clock_out TEXT,
          sunday_interval TEXT,
          base_salary NUMERIC,
          pix_key TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 2. activation_keys
        `CREATE TABLE IF NOT EXISTS public.activation_keys (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          key_code TEXT UNIQUE NOT NULL,
          is_used BOOLEAN DEFAULT false,
          activated_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          owner_email TEXT,
          company_name TEXT,
          plan_type TEXT DEFAULT 'PRO',
          activated_by_name TEXT,
          activated_by_user_id TEXT,
          activated_by_system_id TEXT,
          duration_months INTEGER,
          duration_days INTEGER,
          duration_type TEXT DEFAULT 'MONTHS',
          price NUMERIC,
          currency TEXT DEFAULT 'BRL',
          key_type TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 3. companies
        `CREATE TABLE IF NOT EXISTS public.companies (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT NOT NULL,
          nome_fantasia TEXT,
          razao_social TEXT,
          cnpj TEXT,
          ie TEXT,
          contact_email TEXT,
          email TEXT,
          contact_phone TEXT,
          "contactPhone" TEXT,
          phone TEXT,
          telefone TEXT,
          cep TEXT,
          address_zip_code TEXT,
          address_street TEXT,
          logradouro TEXT,
          address_number TEXT,
          numero TEXT,
          complemento TEXT,
          address_neighborhood TEXT,
          bairro TEXT,
          address_city TEXT,
          cidade TEXT,
          address_state TEXT,
          uf TEXT,
          logo_url TEXT,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 4. routes (com todas as colunas de letreiro e system_id)
        `CREATE TABLE IF NOT EXISTS public.routes (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          company_id TEXT,
          name TEXT,
          origin TEXT NOT NULL DEFAULT 'Origem',
          destination TEXT NOT NULL DEFAULT 'Destino',
          origin_city TEXT,
          destination_city TEXT,
          origin_neighborhood TEXT,
          destination_neighborhood TEXT,
          origin_cep TEXT,
          destination_cep TEXT,
          origin_number TEXT,
          destination_number TEXT,
          origin_lat NUMERIC,
          origin_lng NUMERIC,
          destination_lat NUMERIC,
          destination_lng NUMERIC,
          origin_station_id TEXT,
          origin_station_platform TEXT,
          destination_station_id TEXT,
          destination_station_platform TEXT,
          departure_point TEXT,
          arrival_point TEXT,
          route_number TEXT,
          prefixo_linha TEXT,
          line_code TEXT,
          line_prefix TEXT,
          prefix_code TEXT,
          lightdot_code TEXT,
          route_type TEXT,
          service_number TEXT,
          service_type TEXT,
          service_class TEXT,
          price NUMERIC DEFAULT 0,
          tarifa_integral NUMERIC DEFAULT 0,
          full_fare NUMERIC DEFAULT 0,
          toll NUMERIC DEFAULT 0,
          boarding_fee NUMERIC DEFAULT 0,
          fees NUMERIC DEFAULT 0,
          duration_minutes INTEGER DEFAULT 60,
          distance_km NUMERIC,
          estimated_travel_time_text TEXT,
          payment_type TEXT,
          payment_methods_accepted JSONB DEFAULT '[]'::jsonb,
          status TEXT DEFAULT 'ATIVO',
          active BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          sections JSONB DEFAULT '[]'::jsonb,
          stops JSONB DEFAULT '[]'::jsonb,
          schedule JSONB DEFAULT '{}'::jsonb,
          schedule_weekdays JSONB,
          schedule_saturdays JSONB,
          schedule_sundays JSONB,
          letreiro_cor TEXT DEFAULT '#ffaa00',
          letreiro_principal TEXT,
          letreiro_principal_cor TEXT DEFAULT '#ffaa00',
          letreiro_principal_modo TEXT DEFAULT 'FIXO',
          letreiro_principal_velocidade INTEGER DEFAULT 5,
          letreiro_principal_texto TEXT,
          letreiro_secundario_modo TEXT DEFAULT 'FIXO',
          letreiro_secundario_texto TEXT,
          display_main_color TEXT DEFAULT '#ffaa00',
          display_main_mode TEXT DEFAULT 'FIXO',
          display_main_speed INTEGER DEFAULT 5,
          via1 TEXT,
          via_1 TEXT,
          via1_cor TEXT DEFAULT '#ffaa00',
          via1_modo TEXT DEFAULT 'FIXO',
          via1_mode TEXT DEFAULT 'FIXO',
          via1_texto TEXT,
          via2 TEXT,
          via2_cor TEXT DEFAULT '#ffaa00',
          via2_modo TEXT DEFAULT 'FIXO',
          via2_mode TEXT DEFAULT 'FIXO',
          via2_texto TEXT,
          via3 TEXT,
          via3_cor TEXT DEFAULT '#ffaa00',
          via3_modo TEXT DEFAULT 'FIXO',
          via3_mode TEXT DEFAULT 'FIXO',
          via3_texto TEXT,
          exibir_codigo_letreiro BOOLEAN DEFAULT true,
          municipality_id TEXT,
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 5. vehicles
        `CREATE TABLE IF NOT EXISTS public.vehicles (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          company_id TEXT,
          company_name TEXT,
          nome_da_empresa TEXT,
          empresa TEXT,
          prefix TEXT NOT NULL,
          plate TEXT NOT NULL,
          model TEXT NOT NULL,
          brand TEXT,
          chassis TEXT,
          chassi TEXT,
          year INTEGER,
          year_fab TEXT,
          color TEXT,
          base_city TEXT,
          cidade_atuacao TEXT,
          vehicle_type TEXT DEFAULT 'RODOVIARIA',
          vehicle_class TEXT DEFAULT 'CONVENCIONAL',
          capacity INTEGER DEFAULT 44,
          is_accessible BOOLEAN DEFAULT false,
          is_operational BOOLEAN DEFAULT true,
          active BOOLEAN DEFAULT true,
          status TEXT DEFAULT 'ATIVO',
          last_inspection TEXT,
          inspection_status TEXT,
          skin_id TEXT,
          route_id TEXT,
          default_route_id TEXT,
          conductor_id TEXT,
          conductor_name TEXT,
          default_conductor_id TEXT,
          default_conductor_name TEXT,
          current_turnstile_count INTEGER DEFAULT 0,
          image_url TEXT,
          cep TEXT,
          address_street TEXT,
          address_number TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 6. drivers
        `CREATE TABLE IF NOT EXISTS public.drivers (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          full_name TEXT NOT NULL,
          cpf TEXT,
          cnh_number TEXT,
          cnh_category TEXT,
          cnh_expiration TEXT,
          phone TEXT,
          status TEXT DEFAULT 'Ativo',
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 7. schedules (e daily_schedules + trips para compatibilidade total)
        `CREATE TABLE IF NOT EXISTS public.schedules (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          route_id TEXT,
          vehicle_id TEXT,
          driver_id TEXT,
          driver_name TEXT,
          conductor_id TEXT,
          conductor_name TEXT,
          fiscal_id TEXT,
          fiscal_name TEXT,
          bus_number TEXT,
          trip_date TEXT,
          departure_time TEXT,
          arrival_time TEXT,
          direction TEXT DEFAULT 'IDA',
          trip_type TEXT,
          status TEXT DEFAULT 'Agendada',
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 8. notifications
        `CREATE TABLE IF NOT EXISTS public.notifications (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'INFO',
          category TEXT DEFAULT 'SYSTEM',
          priority TEXT,
          target_role TEXT DEFAULT 'ALL',
          read BOOLEAN DEFAULT false,
          is_read BOOLEAN DEFAULT false,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 9. routes_logs
        `CREATE TABLE IF NOT EXISTS public.routes_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          route_id TEXT,
          trip_id TEXT,
          user_id TEXT,
          action TEXT,
          description TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 10. bilhetes_passagem
        `CREATE TABLE IF NOT EXISTS public.bilhetes_passagem (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          trip_id TEXT,
          route_id TEXT,
          driver_id TEXT,
          booth_id TEXT,
          passenger_name TEXT,
          passenger_document TEXT,
          passenger_cpf TEXT,
          passenger_rg TEXT,
          passenger_phone TEXT,
          passenger_email TEXT,
          seat_number INTEGER,
          section_name TEXT,
          section_origin TEXT,
          section_destination TEXT,
          payment_method TEXT,
          amount NUMERIC DEFAULT 0,
          total_price NUMERIC DEFAULT 0,
          price_base NUMERIC DEFAULT 0,
          price_toll NUMERIC DEFAULT 0,
          price_boarding_fee NUMERIC DEFAULT 0,
          price_fees NUMERIC DEFAULT 0,
          discount_value NUMERIC DEFAULT 0,
          passengers_count INTEGER DEFAULT 1,
          chave_acesso TEXT,
          protocolo_autorizacao TEXT,
          numero_documento TEXT,
          serie_documento TEXT,
          qr_code_url TEXT,
          qr_code_base64 TEXT,
          pdf_url TEXT,
          status TEXT DEFAULT 'ISSUED',
          trip_date TEXT,
          departure_time TEXT,
          direction TEXT,
          company_data JSONB,
          booth_data JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 11. trips
        `CREATE TABLE IF NOT EXISTS public.trips (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          route_id TEXT,
          vehicle_id TEXT,
          driver_id TEXT,
          driver_name TEXT,
          conductor_id TEXT,
          conductor_name TEXT,
          fiscal_id TEXT,
          fiscal_name TEXT,
          inspector_id TEXT,
          company_id TEXT,
          bus_number TEXT,
          vehicle_prefix TEXT,
          replacement_bus_number TEXT,
          trip_type TEXT,
          trip_date TEXT,
          end_date TEXT,
          departure_time TEXT,
          scheduled_start TEXT,
          arrival_time TEXT,
          arrival_time_planned TEXT,
          actual_start_time TEXT,
          actual_end_time TEXT,
          actual_departure TEXT,
          actual_arrival TEXT,
          end_time TEXT,
          direction TEXT DEFAULT 'IDA',
          "direção" TEXT,
          status TEXT DEFAULT 'Agendada',
          finished BOOLEAN DEFAULT false,
          active BOOLEAN DEFAULT true,
          observation TEXT,
          notas TEXT,
          occurrence_type TEXT,
          occurrence_note TEXT,
          occurrences_count INTEGER DEFAULT 0,
          maintenance_alert BOOLEAN DEFAULT false,
          delay_minutes INTEGER DEFAULT 0,
          revenue NUMERIC DEFAULT 0,
          cash_value NUMERIC DEFAULT 0,
          vt_value NUMERIC DEFAULT 0,
          card_value NUMERIC DEFAULT 0,
          cash_amount NUMERIC DEFAULT 0,
          vt_amount NUMERIC DEFAULT 0,
          card_amount NUMERIC DEFAULT 0,
          cash_total NUMERIC DEFAULT 0,
          card_total NUMERIC DEFAULT 0,
          vt_total NUMERIC DEFAULT 0,
          passengers TEXT,
          passengers_count INTEGER DEFAULT 0,
          passenger_count JSONB,
          free_passengers INTEGER DEFAULT 0,
          occupied_seats JSONB DEFAULT '[]'::jsonb,
          sections_data JSONB,
          "selectedTimes" JSONB,
          tickets_sold JSONB,
          electronic_payments JSONB,
          checklist_ok BOOLEAN,
          odometer_start NUMERIC,
          odometer_end NUMERIC,
          initial_odometer NUMERIC,
          fuel_level TEXT,
          fuel_level_end TEXT,
          initial_turnstile INTEGER,
          final_turnstile INTEGER,
          origin_terminal TEXT,
          destination_terminal TEXT,
          ignore_company_filter BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 12. ticket_sales
        `CREATE TABLE IF NOT EXISTS public.ticket_sales (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          trip_id TEXT,
          route_id TEXT,
          driver_id TEXT,
          booth_id TEXT,
          section_name TEXT,
          section_origin TEXT,
          section_destination TEXT,
          payment_method TEXT,
          amount NUMERIC DEFAULT 0,
          total_price NUMERIC DEFAULT 0,
          price_base NUMERIC DEFAULT 0,
          price_toll NUMERIC DEFAULT 0,
          price_boarding_fee NUMERIC DEFAULT 0,
          price_fees NUMERIC DEFAULT 0,
          discount_value NUMERIC DEFAULT 0,
          passengers_count INTEGER DEFAULT 1,
          passenger_name TEXT,
          passenger_document TEXT,
          passenger_cpf TEXT,
          passenger_rg TEXT,
          passenger_phone TEXT,
          passenger_email TEXT,
          passenger_birth TEXT,
          passenger_gender TEXT,
          tipo_documento_passageiro TEXT,
          relationship TEXT,
          responsible_name TEXT,
          responsible_birth TEXT,
          address_cep TEXT,
          address_street TEXT,
          address_number TEXT,
          address_complement TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          seat_number INTEGER,
          vehicle_model TEXT,
          vehicle_prefix TEXT,
          departure_time TEXT,
          direction TEXT,
          trip_date TEXT,
          is_presale BOOLEAN DEFAULT false,
          status TEXT DEFAULT 'ISSUED',
          coupon_applied TEXT,
          chave_acesso TEXT,
          protocolo_autorizacao TEXT,
          data_autorizacao TEXT,
          serie_documento TEXT,
          numero_documento TEXT,
          base_calculo_icms NUMERIC,
          aliquota_icms NUMERIC,
          valor_icms NUMERIC,
          icms_valor NUMERIC,
          plataforma TEXT,
          servico_tipo TEXT,
          qr_code_url TEXT,
          qr_code_base64 TEXT,
          pdf_url TEXT,
          company_data JSONB,
          booth_data JSONB,
          timestamp TIMESTAMPTZ DEFAULT now(),
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 13. occurrences
        `CREATE TABLE IF NOT EXISTS public.occurrences (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          trip_id TEXT,
          vehicle_id TEXT,
          driver_id TEXT,
          occurrence_type TEXT,
          type TEXT,
          category TEXT,
          severity TEXT,
          description TEXT,
          service_description TEXT,
          suggested_action TEXT,
          parts_replaced TEXT,
          status TEXT DEFAULT 'Pendente',
          technician_report TEXT,
          technician_name TEXT,
          technician_name_manual TEXT,
          technician_name_text TEXT,
          estimated_cost_web NUMERIC DEFAULT 0,
          maintenance_start_at TIMESTAMPTZ,
          maintenance_end_at TIMESTAMPTZ,
          resolved_at TIMESTAMPTZ,
          resolved_by TEXT,
          timestamp TIMESTAMPTZ DEFAULT now(),
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 14. cities
        `CREATE TABLE IF NOT EXISTS public.cities (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'SP',
          code TEXT,
          user_id TEXT,
          company_id TEXT,
          is_active BOOLEAN DEFAULT true,
          active BOOLEAN DEFAULT true,
          status TEXT DEFAULT 'ATIVO',
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 15. notices
        `CREATE TABLE IF NOT EXISTS public.notices (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT DEFAULT 'SISTEMA',
          target_role TEXT DEFAULT 'ALL',
          target_audience TEXT,
          company_id TEXT,
          user_id TEXT,
          created_by TEXT,
          protocol TEXT,
          attachment_info TEXT,
          is_active BOOLEAN DEFAULT true,
          "createdAt" TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 16. maintenance
        `CREATE TABLE IF NOT EXISTS public.maintenance (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          vehicle_id TEXT,
          description TEXT,
          service_type TEXT,
          date TEXT,
          maintenance_date TEXT,
          next_inspection TEXT,
          cost NUMERIC DEFAULT 0,
          performed_by TEXT,
          status TEXT DEFAULT 'CONCLUIDA',
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 17. maintenance_logs
        `CREATE TABLE IF NOT EXISTS public.maintenance_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          vehicle_id TEXT,
          description TEXT,
          cost NUMERIC DEFAULT 0,
          service_type TEXT,
          date TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 18. inspections
        `CREATE TABLE IF NOT EXISTS public.inspections (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          vehicle_id TEXT,
          inspector_id TEXT,
          inspector_name TEXT,
          agency TEXT,
          type TEXT,
          location TEXT,
          date TEXT,
          status TEXT,
          notes TEXT,
          photo_url TEXT,
          items_checked JSONB DEFAULT '[]'::jsonb,
          checklist JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 19. ticketing_config
        `CREATE TABLE IF NOT EXISTS public.ticketing_config (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          company_name TEXT,
          cnpj TEXT,
          state_registration TEXT,
          inscricao_municipal TEXT,
          ie_empresa TEXT,
          cnae TEXT,
          address TEXT,
          sac_telefone TEXT,
          logo_url TEXT,
          logo_base64 TEXT,
          ticket_prefix TEXT,
          next_ticket_number INTEGER DEFAULT 1,
          tax_rate NUMERIC DEFAULT 0,
          boarding_box TEXT,
          credit_installments INTEGER DEFAULT 1,
          min_installment_value NUMERIC DEFAULT 0,
          credit_surcharge NUMERIC DEFAULT 0,
          active_coupons JSONB DEFAULT '[]'::jsonb,
          class_seats JSONB DEFAULT '{}'::jsonb,
          custom_vehicle_classes JSONB DEFAULT '[]'::jsonb,
          payment_methods JSONB DEFAULT '[]'::jsonb,
          payment_methods_config JSONB DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 20. payroll_rubrics, payroll, payroll_details, salary_items
        `CREATE TABLE IF NOT EXISTS public.payroll_rubrics (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'EARNING',
          has_conditions BOOLEAN DEFAULT false,
          condition_value TEXT,
          condition_symbol TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.payroll (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          month TEXT,
          year INTEGER,
          gross_salary NUMERIC DEFAULT 0,
          net_salary NUMERIC DEFAULT 0,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.payroll_details (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          payroll_id TEXT,
          rubric_code TEXT,
          amount NUMERIC DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.salary_items (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          name TEXT,
          amount NUMERIC DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 21. role_configs
        `CREATE TABLE IF NOT EXISTS public.role_configs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT NOT NULL,
          base_role TEXT,
          permissions JSONB DEFAULT '[]'::jsonb,
          base_salary NUMERIC DEFAULT 0,
          standard_shift TEXT,
          access_driver_guide BOOLEAN DEFAULT false,
          access_sales BOOLEAN DEFAULT false,
          access_maintenance BOOLEAN DEFAULT false,
          access_global_management BOOLEAN DEFAULT false,
          can_access_checkin BOOLEAN DEFAULT false,
          can_access_diary BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 22. shifts & daily_schedules
        `CREATE TABLE IF NOT EXISTS public.shifts (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          date TEXT,
          driver_id TEXT,
          route_id TEXT,
          start_time TEXT,
          end_time TEXT,
          status TEXT DEFAULT 'AGENDADO',
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.daily_schedules (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          date TEXT,
          data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 23. time_tracking
        `CREATE TABLE IF NOT EXISTS public.time_tracking (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          clock_in TEXT,
          break_start TEXT,
          break_end TEXT,
          clock_out TEXT,
          gps_location TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 24. logs tables (driver_logs, conductor_logs, dispatcher_logs, trips_audit, cashier_logs)
        `CREATE TABLE IF NOT EXISTS public.driver_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          driver_id TEXT,
          vehicle_id TEXT,
          dispatcher_id TEXT,
          trip_id TEXT,
          status TEXT DEFAULT 'OPEN',
          vehicle_confirmed BOOLEAN DEFAULT false,
          released_at TIMESTAMPTZ,
          notes TEXT,
          data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.conductor_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          conductor_id TEXT,
          trip_id TEXT,
          data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.dispatcher_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          dispatcher_id TEXT,
          trip_id TEXT,
          action TEXT,
          data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.trips_audit (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          trip_id TEXT,
          user_id TEXT,
          action TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.cashier_logs (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          amount NUMERIC DEFAULT 0,
          type TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 25. system_settings & system_versions
        `CREATE TABLE IF NOT EXISTS public.system_settings (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          key TEXT,
          value TEXT,
          description TEXT,
          company_name TEXT,
          system_name TEXT DEFAULT 'ViaLivre Gestão',
          nome_da_empresa TEXT,
          registration_pattern TEXT DEFAULT 'FLX-000',
          theme_color TEXT,
          high_contrast BOOLEAN DEFAULT false,
          glass_effect BOOLEAN DEFAULT true,
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.system_versions (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          version TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 26. imp_cards & imp_card_recharges
        `CREATE TABLE IF NOT EXISTS public.imp_cards (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          type TEXT,
          card_number TEXT,
          balance NUMERIC DEFAULT 0,
          name TEXT,
          surname TEXT,
          cpf TEXT,
          rg TEXT,
          birth_date TEXT,
          email TEXT,
          phone TEXT,
          cep TEXT,
          zip_code TEXT,
          address_street TEXT,
          address_number TEXT,
          address_complement TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          senha TEXT,
          password TEXT,
          generated_image_url TEXT,
          card_logo_left_url TEXT,
          card_logo_right_url TEXT,
          left_logo_url TEXT,
          right_logo_url TEXT,
          ai_art_url TEXT,
          photo_url TEXT,
          is_passenger_buyer BOOLEAN DEFAULT false,
          seat_number INTEGER,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.imp_card_recharges (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          card_id TEXT,
          card_number TEXT,
          amount NUMERIC DEFAULT 0,
          payment_method TEXT,
          status TEXT DEFAULT 'COMPLETED',
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 27. user_occurrences, traffic_violations, user_fines
        `CREATE TABLE IF NOT EXISTS public.user_occurrences (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          type TEXT,
          description TEXT,
          date TEXT,
          status TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.traffic_violations (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          driver_id TEXT,
          vehicle_id TEXT,
          description TEXT,
          points INTEGER DEFAULT 0,
          amount NUMERIC DEFAULT 0,
          status TEXT DEFAULT 'PENDENTE',
          date_time TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.user_fines (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          driver_id TEXT,
          vehicle_id TEXT,
          description TEXT,
          amount NUMERIC DEFAULT 0,
          points INTEGER DEFAULT 0,
          status TEXT DEFAULT 'PENDENTE',
          date TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 28. job_applications & job_vacancies
        `CREATE TABLE IF NOT EXISTS public.job_vacancies (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          job_title TEXT NOT NULL,
          company_name TEXT,
          requirements TEXT,
          activities TEXT,
          benefits TEXT,
          contact_info TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.job_applications (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          full_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          cpf TEXT,
          birth_date TEXT,
          desired_position TEXT,
          resume_url TEXT,
          photo_url TEXT,
          address_cep TEXT,
          address_street TEXT,
          address_number TEXT,
          address_complement TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          status TEXT DEFAULT 'Recebido',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 29. skins
        `CREATE TABLE IF NOT EXISTS public.skins (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          vehicle_id TEXT,
          company_id TEXT,
          name TEXT,
          skin_name TEXT,
          bus_model TEXT,
          image_url TEXT,
          file_url TEXT,
          version TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 30. subscriptions & ticket_booths
        `CREATE TABLE IF NOT EXISTS public.subscriptions (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          plan_type TEXT,
          status TEXT DEFAULT 'ACTIVE',
          activated_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.ticket_booths (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          company_id TEXT,
          name TEXT NOT NULL,
          cnpj TEXT,
          ie TEXT,
          address_street TEXT,
          address_number TEXT,
          address_neighborhood TEXT,
          address_city TEXT,
          address_state TEXT,
          address_complement TEXT,
          phone TEXT,
          email TEXT,
          booth_manager TEXT,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 31. bus_stations, bus_terminals, itineraries, sections, timetables, passengers, push_subscriptions
        `CREATE TABLE IF NOT EXISTS public.bus_stations (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT NOT NULL,
          postal_code TEXT,
          cep TEXT,
          state TEXT,
          uf TEXT,
          street TEXT,
          logradouro TEXT,
          number TEXT,
          numero TEXT,
          complement TEXT,
          complemento TEXT,
          neighborhood TEXT,
          bairro TEXT,
          city TEXT,
          cidade TEXT,
          address TEXT,
          platforms JSONB DEFAULT '[]'::jsonb,
          company_id TEXT,
          enterprise_id TEXT,
          user_id TEXT,
          is_active BOOLEAN DEFAULT true,
          active BOOLEAN DEFAULT true,
          status TEXT DEFAULT 'ATIVO',
          deleted BOOLEAN DEFAULT false,
          deleted_at TIMESTAMPTZ,
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.bus_terminals (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT NOT NULL,
          city TEXT,
          state TEXT,
          address TEXT,
          platforms JSONB DEFAULT '[]'::jsonb,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.itineraries (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          via_1 TEXT,
          via_2 TEXT,
          via_3 TEXT,
          nome_itinerario TEXT,
          full_fare NUMERIC,
          stops_list JSONB,
          sections_data JSONB,
          schedule_week JSONB,
          schedule_sat JSONB,
          schedule_sun JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.itinerary_sections (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          itinerary_id TEXT,
          name TEXT,
          price NUMERIC,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.route_sections (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          route_id TEXT,
          name TEXT,
          price NUMERIC,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.timetables (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          route_id TEXT,
          day_type TEXT,
          direction TEXT,
          time TEXT,
          schedule JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.passengers (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          name TEXT,
          cpf TEXT,
          email TEXT,
          phone TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.push_subscriptions (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          user_id TEXT,
          endpoint TEXT,
          keys JSONB,
          subscription JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.uploads (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          bucket TEXT DEFAULT 'default',
          file_name TEXT,
          content_type TEXT,
          data_url TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );`,
        `CREATE TABLE IF NOT EXISTS public.email_verification_codes (
          id TEXT PRIMARY KEY,
          system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}',
          email TEXT NOT NULL,
          code TEXT NOT NULL,
          purpose TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        );`
      ];

      for (const sql of ddlStatements) {
        await client.query(sql);
      }

      // Garante colunas obrigatórias em tabelas pré-existentes (routes letreiros, system_id, password_hash, etc.)
      const alterStatements: string[] = [
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS letreiro_cor TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS letreiro_principal_cor TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS via1_cor TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS via2_cor TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS via3_cor TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS display_main_color TEXT DEFAULT '#ffaa00';`,
        `ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS exibir_codigo_letreiro BOOLEAN DEFAULT true;`,
        `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS conductor_id TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS conductor_name TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS default_conductor_id TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS default_conductor_name TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS route_id TEXT;`,
        `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS default_route_id TEXT;`,
        `ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.routes_logs ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`,
        `ALTER TABLE public.bilhetes_passagem ADD COLUMN IF NOT EXISTS system_id TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`
      ];

      for (const alterSql of alterStatements) {
        try {
          await client.query(alterSql);
        } catch (alterErr: any) {
          console.warn('[initDatabase] Aviso ao ajustar coluna:', alterErr?.message);
        }
      }

      // Índices por system_id para performance multi-tenant e garantia de índice único em id
      const indexTables = [
        'users', 'activation_keys', 'companies', 'routes', 'vehicles', 'drivers',
        'schedules', 'notifications', 'routes_logs', 'bilhetes_passagem',
        'trips', 'ticket_sales', 'occurrences', 'time_tracking', 'imp_cards'
      ];
      for (const tbl of indexTables) {
        try {
          await client.query(`CREATE INDEX IF NOT EXISTS idx_${tbl}_system_id ON public.${tbl} (system_id);`);
        } catch {}
      }

      for (const tbl of ALLOWED_TABLES) {
        try {
          await client.query(`ALTER TABLE public."${tbl}" ADD COLUMN IF NOT EXISTS "system_id" TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_UUID}';`);
        } catch {}
        try {
          await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_id_unique ON public."${tbl}" ("id");`);
        } catch {}
      }

      // Pré-carrega o mapa de colunas de todas as tabelas públicas em uma única query
      try {
        const schemaRes = await client.query(
          `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'`
        );
        tableColumnsCache.clear();
        for (const row of schemaRes.rows) {
          const tblName = String(row.table_name).toLowerCase();
          if (!tableColumnsCache.has(tblName)) {
            tableColumnsCache.set(tblName, new Map<string, string>());
          }
          tableColumnsCache.get(tblName)!.set(row.column_name, row.data_type);
        }
      } catch {}

      dbInitialized = true;
      console.log('[Aiven PostgreSQL] initDatabase concluído com sucesso! Todas as tabelas e colunas verificadas.');
      return true;
    } catch (err: any) {
      console.error('[Aiven PostgreSQL] Falha ao executar initDatabase:', err?.message || err);
      initPromise = null;
      return false;
    } finally {
      if (client) {
        try {
          client.release();
        } catch {}
      }
    }
  })();

  return initPromise;
}

// ==========================================
// 3. INTROSPECÇÃO E AUTO-ADAPTAÇÃO DE COLUNAS
// ==========================================
export async function getTableColumns(tableName: string, forceRefresh = false): Promise<Map<string, string>> {
  const norm = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(norm)) {
    throw new Error(`Tabela não permitida: ${norm}`);
  }
  if (!forceRefresh && tableColumnsCache.has(norm)) {
    return tableColumnsCache.get(norm)!;
  }
  if (!pool) return new Map();

  try {
    const res = await runQuery(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [norm]
    );
    const colMap = new Map<string, string>();
    for (const row of res.rows) {
      colMap.set(row.column_name, row.data_type);
    }
    tableColumnsCache.set(norm, colMap);
    return colMap;
  } catch (err: any) {
    console.warn(`[Aiven DB] Falha ao ler colunas de ${norm}:`, err?.message);
    return new Map();
  }
}

async function ensureColumnsExist(tableName: string, payload: Record<string, any>): Promise<Map<string, string>> {
  const norm = sanitizeIdentifier(tableName.toLowerCase());
  let colMap = await getTableColumns(norm);
  if (!pool) return colMap;

  if (colMap.size === 0) {
    await initDatabase();
    colMap = await getTableColumns(norm, true);
  }

  for (const [key, val] of Object.entries(payload)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    if (colMap.has(key)) continue;

    // Adiciona coluna ausente dinamicamente de forma segura
    let pgType = 'TEXT';
    if (typeof val === 'boolean') pgType = 'BOOLEAN';
    else if (typeof val === 'number') pgType = Number.isInteger(val) ? 'INTEGER' : 'NUMERIC';
    else if (val !== null && typeof val === 'object') pgType = 'JSONB';

    try {
      await runQuery(`ALTER TABLE public."${norm}" ADD COLUMN IF NOT EXISTS "${key}" ${pgType};`);
      colMap.set(key, pgType.toLowerCase());
    } catch (err: any) {
      console.warn(`[Aiven DB] Não foi possível criar coluna ${key} em ${norm}:`, err?.message);
    }
  }

  return colMap;
}

export function strictJsonSerialize(val: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(val ?? null, (_key, value) => {
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
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  });
}

export function normalizeColumnValue(val: any, dataType: string): any {
  if (val === undefined || val === null) return null;
  const dt = (dataType || 'text').toLowerCase();

  if (val === '' && (dt.includes('int') || dt.includes('numeric') || dt.includes('double') || dt.includes('real') || dt.includes('bool') || dt.includes('timestamp') || dt.includes('date') || dt.includes('uuid'))) {
    return null;
  }

  if (dt.includes('uuid')) {
    const str = String(val).replace(/\u0000/g, '').trim();
    if (!str || str === 'null' || str === 'none') return null;
    if (isValidUUID(str)) return str.toLowerCase();
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  if (dt.includes('timestamp') || dt === 'date') {
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val.toISOString();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof val === 'string') {
      const s = val.replace(/\u0000/g, '').trim();
      if (!s || s === 'null' || s === 'none' || s === 'undefined' || s === 'Invalid Date') return null;
      // Suporta formato brasileiro DD/MM/YYYY[ HH:mm[:ss]]
      const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (brMatch) {
        const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
        const isoCandidate = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.000Z`;
        const parsedBr = Date.parse(isoCandidate);
        if (!isNaN(parsedBr)) return dt === 'date' ? `${yyyy}-${mm}-${dd}` : new Date(parsedBr).toISOString();
      }
      const parsed = Date.parse(s);
      if (!isNaN(parsed)) {
        return dt === 'date' ? s.slice(0, 10) : new Date(parsed).toISOString();
      }
      return null;
    }
    return null;
  }

  if (dt.includes('json')) {
    if (typeof val === 'string') {
      const sanitizedStr = val.replace(/\u0000/g, '');
      try {
        const parsed = JSON.parse(sanitizedStr);
        return strictJsonSerialize(parsed);
      } catch {
        return strictJsonSerialize(sanitizedStr);
      }
    }
    return strictJsonSerialize(val);
  }

  if (dt.includes('bool')) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
  }

  if (dt.includes('int')) {
    if (typeof val === 'string') {
      const cleanedNum = val.replace(/[^\d.,-]/g, '').replace(',', '.');
      const n = Number(cleanedNum);
      return cleanedNum !== '' && Number.isFinite(n) ? Math.round(n) : null;
    }
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  if (dt.includes('numeric') || dt.includes('double') || dt.includes('real') || dt.includes('decimal')) {
    if (typeof val === 'string') {
      const cleanedNum = val.replace(/[^\d.,-]/g, '').replace(',', '.');
      const n = Number(cleanedNum);
      return cleanedNum !== '' && Number.isFinite(n) ? n : null;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  if (typeof val === 'object') {
    return strictJsonSerialize(val);
  }

  if (typeof val === 'string') {
    return val.replace(/\u0000/g, '');
  }

  return val;
}

// ==========================================
// 4. HEALTH CHECK
// ==========================================
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  database: string;
  host: string;
  tablesCount: number;
  latencyMs: number;
  initialized: boolean;
  error?: string | null;
}> {
  const start = Date.now();
  let parsedHost = 'Não configurado (DATABASE_URL ausente)';
  let parsedDb = 'defaultdb';

  if (rawDatabaseUrl) {
    try {
      const urlObj = new URL(rawDatabaseUrl);
      parsedHost = `${urlObj.hostname}:${urlObj.port || '5432'}`;
      parsedDb = urlObj.pathname.replace(/^\//, '') || 'defaultdb';
    } catch {
      parsedHost = 'Aiven PostgreSQL';
    }
  }

  if (!pool) {
    return {
      connected: false,
      database: parsedDb,
      host: parsedHost,
      tablesCount: 0,
      latencyMs: Date.now() - start,
      initialized: dbInitialized,
      error: 'Variável de ambiente DATABASE_URL não definida.'
    };
  }

  try {
    if (!dbInitialized) {
      await initDatabase();
    }
    const res = await runQuery(
      `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const latencyMs = Date.now() - start;
    return {
      connected: true,
      database: parsedDb,
      host: parsedHost,
      tablesCount: res.rows[0]?.count || 0,
      latencyMs,
      initialized: dbInitialized,
      error: null
    };
  } catch (err: any) {
    return {
      connected: false,
      database: parsedDb,
      host: parsedHost,
      tablesCount: 0,
      latencyMs: Date.now() - start,
      initialized: dbInitialized,
      error: err?.message || 'Falha ao conectar no PostgreSQL Aiven'
    };
  }
}

// ==========================================
// 5. OPERAÇÕES CRUD COM ISOLAMENTO STRICT POR system_id
// ==========================================
export interface QueryOptions {
  systemId?: string | null;
  bypassSystemId?: boolean;
  strictSystemId?: boolean;
}

function parseOrCondition(
  orStr: string,
  colMap: Map<string, string>,
  params: any[]
): string | null {
  if (!orStr || typeof orStr !== 'string') return null;
  const parts = orStr.split(',').map((s) => s.trim()).filter(Boolean);
  const sqlParts: string[] = [];

  for (const part of parts) {
    const dotIdx = part.indexOf('.');
    if (dotIdx === -1) continue;
    const col = part.slice(0, dotIdx).trim();
    if (!colMap.has(col)) continue;
    const rest = part.slice(dotIdx + 1);
    const secondDot = rest.indexOf('.');
    if (secondDot === -1) continue;
    const op = rest.slice(0, secondDot).trim().toLowerCase();
    const val = rest.slice(secondDot + 1).trim();

    if (op === 'eq') {
      params.push(val);
      sqlParts.push(`"${col}"::text = $${params.length}`);
    } else if (op === 'ilike') {
      params.push(val);
      sqlParts.push(`"${col}"::text ILIKE $${params.length}`);
    } else if (op === 'is' && val.toLowerCase() === 'null') {
      sqlParts.push(`"${col}" IS NULL`);
    }
  }

  return sqlParts.length > 0 ? `(${sqlParts.join(' OR ')})` : null;
}

export async function fetchAllRows(
  tableName: string,
  queryFilters?: Record<string, any>,
  options?: QueryOptions
): Promise<any[]> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  if (!dbInitialized) {
    await initDatabase();
  }

  const colMap = await getTableColumns(normTable);
  const whereClauses: string[] = [];
  const params: any[] = [];

  const activeSystemId = options?.systemId || queryFilters?.system_id || null;
  const bypassSystemId =
    options?.bypassSystemId === true ||
    queryFilters?.bypass_system_id === 'true' ||
    queryFilters?.bypassSystemId === 'true';

  if (!bypassSystemId && activeSystemId && colMap.has('system_id')) {
    params.push(String(activeSystemId));
    if (options?.strictSystemId) {
      whereClauses.push(`"system_id" = $${params.length}`);
    } else {
      whereClauses.push(`("system_id" = $${params.length} OR "system_id" IS NULL)`);
    }
  }

  if (queryFilters) {
    for (const [key, val] of Object.entries(queryFilters)) {
      if (
        key === 'system_id' ||
        key === 'bypass_system_id' ||
        key === 'bypassSystemId' ||
        key === 'order' ||
        key === 'limit' ||
        val === undefined ||
        val === null ||
        val === ''
      ) {
        continue;
      }

      if (key === 'or' && typeof val === 'string') {
        const orSql = parseOrCondition(val, colMap, params);
        if (orSql) whereClauses.push(orSql);
        continue;
      }

      if (colMap.has(key)) {
        if (val === 'null') {
          whereClauses.push(`"${key}" IS NULL`);
        } else {
          params.push(String(val));
          whereClauses.push(`"${key}"::text = $${params.length}`);
        }
      }
    }
  }

  let sql = `SELECT * FROM public."${normTable}"`;
  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  if (colMap.has('created_at')) {
    sql += ` ORDER BY "created_at" DESC NULLS LAST`;
  }

  if (queryFilters?.limit && !isNaN(Number(queryFilters.limit))) {
    const lim = Math.min(Math.max(1, Number(queryFilters.limit)), 5000);
    sql += ` LIMIT ${lim}`;
  }

  const res = await runQuery(sql, params);
  if (normTable === 'users') {
    return res.rows.map((u) => sanitizeUserOutput(u));
  }
  return res.rows;
}

function prepareUsersSecurityPayload(payload: Record<string, any>, isUpdate: boolean): Record<string, any> {
  const copy = { ...payload };
  const rawPassword = copy.senha_acesso || copy.password || copy.senha || copy.login_senha;

  if (typeof rawPassword === 'string' && rawPassword.trim() !== '') {
    copy.password_hash = hashPassword(rawPassword.trim());
  } else if (isUpdate) {
    // Em atualização sem alteração de senha, não apaga o hash existente
    delete copy.password_hash;
  }

  // Nunca armazena senha em texto puro no banco
  delete copy.senha_acesso;
  delete copy.password;
  delete copy.senha;
  delete copy.login_senha;

  return copy;
}

export async function upsertRow(
  tableName: string,
  data: any,
  systemIdOverride?: string | null
): Promise<any> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  if (!dbInitialized) {
    await initDatabase();
  }

  let payload: Record<string, any> = { ...(data || {}) };

  // Remove metadados internos de frontend
  for (const k of Object.keys(payload)) {
    if (k.startsWith('_') || payload[k] === undefined) {
      delete payload[k];
    }
  }

  if (normTable === 'notifications') {
    // Mantém metadata se suportada pelo JSONB
  }

  if (!payload.id || String(payload.id).trim() === '') {
    payload.id = generateUUID();
  } else {
    payload.id = String(payload.id);
  }

  const effectiveSystemId = payload.system_id || systemIdOverride || DEFAULT_SYSTEM_UUID;
  if (!payload.system_id || payload.system_id === 'sys-vialivre-default' || payload.system_id === 'default-sys') {
    payload.system_id = effectiveSystemId;
  }

  if (normTable === 'users') {
    payload = prepareUsersSecurityPayload(payload, false);
  }

  const colMap = await ensureColumnsExist(normTable, payload);
  const cols: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  const updateAssignments: string[] = [];

  for (const [key, rawVal] of Object.entries(payload)) {
    if (!colMap.has(key)) continue;
    const dataType = colMap.get(key) || 'text';
    const normalized = normalizeColumnValue(rawVal, dataType);
    cols.push(`"${key}"`);
    values.push(normalized);
    placeholders.push(`$${values.length}`);
    if (key !== 'id') {
      updateAssignments.push(`"${key}" = EXCLUDED."${key}"`);
    }
  }

  if (cols.length === 0) {
    throw new Error(`Nenhuma coluna válida para inserir em ${normTable}`);
  }

  let sql = `INSERT INTO public."${normTable}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
  if (updateAssignments.length > 0) {
    sql += ` ON CONFLICT ("id") DO UPDATE SET ${updateAssignments.join(', ')}`;
  } else {
    sql += ` ON CONFLICT ("id") DO NOTHING`;
  }
  sql += ` RETURNING *`;

  try {
    const res = await runQuery(sql, values);
    const saved = res.rows[0] || payload;
    return normTable === 'users' ? sanitizeUserOutput(saved) : saved;
  } catch (err: any) {
    // Fallback para colunas legadas com constraint NOT NULL ausentes no registro restaurado (código 23502)
    if (err?.code === '23502' && err?.column) {
      const colName = sanitizeIdentifier(String(err.column));
      const dt = (colMap.get(colName) || 'text').toLowerCase();
      if (colName !== 'id') {
        try {
          await runQuery(`ALTER TABLE public."${normTable}" ALTER COLUMN "${colName}" DROP NOT NULL;`);
          const retryRes = await runQuery(sql, values);
          const saved = retryRes.rows[0] || payload;
          return normTable === 'users' ? sanitizeUserOutput(saved) : saved;
        } catch {
          const fallbackVal =
            dt.includes('bool') ? false :
            (dt.includes('int') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('real') || dt.includes('double')) ? 0 :
            dt.includes('json') ? '{}' :
            dt.includes('timestamp') ? new Date().toISOString() :
            dt === 'date' ? new Date().toISOString().slice(0, 10) :
            '';
          const existingIdx = cols.indexOf(`"${colName}"`);
          if (existingIdx !== -1) {
            values[existingIdx] = fallbackVal;
          } else {
            cols.push(`"${colName}"`);
            values.push(fallbackVal);
            placeholders.push(`$${values.length}`);
          }
          const retrySql = `INSERT INTO public."${normTable}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("id") DO UPDATE SET ${updateAssignments.length > 0 ? updateAssignments.join(', ') : `"${colName}" = EXCLUDED."${colName}"`} RETURNING *`;
          const retryRes = await runQuery(retrySql, values);
          const saved = retryRes.rows[0] || payload;
          return normTable === 'users' ? sanitizeUserOutput(saved) : saved;
        }
      }
    }

    // Fallback para conflito de chave única secundária (ex: activation_keys.key_code UNIQUE)
    if (err?.code === '23505' && normTable === 'activation_keys' && payload.key_code) {
      const updateCols: string[] = [];
      const updateVals: any[] = [];
      for (let i = 0; i < cols.length; i++) {
        if (cols[i] === '"id"' || cols[i] === '"key_code"') continue;
        updateVals.push(values[i]);
        updateCols.push(`${cols[i]} = $${updateVals.length}`);
      }
      if (updateCols.length > 0) {
        updateVals.push(String(payload.key_code));
        const byKeySql = `UPDATE public."activation_keys" SET ${updateCols.join(', ')} WHERE "key_code" = $${updateVals.length} RETURNING *`;
        const upRes = await runQuery(byKeySql, updateVals);
        if (upRes.rows.length > 0) return upRes.rows[0];
      }
    }

    // Fallback para tabelas legadas sem constraint UNIQUE/PRIMARY KEY explícita em "id" (código 42P10)
    if (err?.code === '42P10' || (err?.message && err.message.includes('no unique or exclusion constraint'))) {
      const updateCols: string[] = [];
      const updateVals: any[] = [];
      for (let i = 0; i < cols.length; i++) {
        if (cols[i] === '"id"') continue;
        updateVals.push(values[i]);
        updateCols.push(`${cols[i]} = $${updateVals.length}`);
      }
      if (updateCols.length > 0) {
        updateVals.push(String(payload.id));
        const updateSql = `UPDATE public."${normTable}" SET ${updateCols.join(', ')} WHERE "id"::text = $${updateVals.length} RETURNING *`;
        const upRes = await runQuery(updateSql, updateVals);
        if (upRes.rows.length > 0) {
          const saved = upRes.rows[0];
          return normTable === 'users' ? sanitizeUserOutput(saved) : saved;
        }
      }
      const insertSql = `INSERT INTO public."${normTable}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const insRes = await runQuery(insertSql, values);
      const saved = insRes.rows[0] || payload;
      return normTable === 'users' ? sanitizeUserOutput(saved) : saved;
    }
    throw err;
  }
}

export async function updateRowById(
  tableName: string,
  id: string,
  data: any,
  systemIdFilter?: string | null,
  bypassSystemId = false
): Promise<any> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  if (!dbInitialized) {
    await initDatabase();
  }

  let payload: Record<string, any> = { ...(data || {}) };
  delete payload.id;

  for (const k of Object.keys(payload)) {
    if (k.startsWith('_') || payload[k] === undefined) {
      delete payload[k];
    }
  }

  if (normTable === 'users') {
    payload = prepareUsersSecurityPayload(payload, true);
  }

  const colMap = await ensureColumnsExist(normTable, payload);
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, rawVal] of Object.entries(payload)) {
    if (!colMap.has(key)) continue;
    const dataType = colMap.get(key) || 'text';
    const normalized = normalizeColumnValue(rawVal, dataType);
    values.push(normalized);
    setClauses.push(`"${key}" = $${values.length}`);
  }

  if (setClauses.length === 0) {
    const existing = await runQuery(`SELECT * FROM public."${normTable}" WHERE "id" = $1 LIMIT 1`, [String(id)]);
    const row = existing.rows[0] || { id };
    return normTable === 'users' ? sanitizeUserOutput(row) : row;
  }

  values.push(String(id));
  let whereSql = `"id" = $${values.length}`;

  if (!bypassSystemId && systemIdFilter && colMap.has('system_id') && normTable !== 'activation_keys') {
    values.push(String(systemIdFilter));
    whereSql += ` AND ("system_id" = $${values.length} OR "system_id" IS NULL)`;
  }

  const sql = `UPDATE public."${normTable}" SET ${setClauses.join(', ')} WHERE ${whereSql} RETURNING *`;
  const res = await runQuery(sql, values);

  if (res.rows.length === 0) {
    // Caso o registro ainda não exista no banco (ex: restauração ou edição offline), faz upsert seguro
    return await upsertRow(normTable, { ...payload, id, system_id: payload.system_id || systemIdFilter }, systemIdFilter);
  }

  const updated = res.rows[0];
  return normTable === 'users' ? sanitizeUserOutput(updated) : updated;
}

export async function deleteRowById(
  tableName: string,
  id: string,
  systemIdFilter?: string | null,
  bypassSystemId = false
): Promise<boolean> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  const colMap = await getTableColumns(normTable);
  const values: any[] = [String(id)];
  let sql = `DELETE FROM public."${normTable}" WHERE "id" = $1`;

  if (!bypassSystemId && systemIdFilter && colMap.has('system_id') && normTable !== 'activation_keys') {
    values.push(String(systemIdFilter));
    sql += ` AND ("system_id" = $2 OR "system_id" IS NULL)`;
  }

  await runQuery(sql, values);
  return true;
}

export async function deleteByField(
  tableName: string,
  field: string,
  value: string,
  caseInsensitive = false,
  systemIdFilter?: string | null
): Promise<boolean> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  const colMap = await getTableColumns(normTable);
  const safeField = sanitizeIdentifier(field);
  if (!colMap.has(safeField)) return false;

  const params: any[] = [String(value)];
  let sql = caseInsensitive
    ? `DELETE FROM public."${normTable}" WHERE LOWER("${safeField}"::text) = LOWER($1)`
    : `DELETE FROM public."${normTable}" WHERE "${safeField}"::text = $1`;

  if (systemIdFilter && colMap.has('system_id') && normTable !== 'activation_keys') {
    params.push(String(systemIdFilter));
    sql += ` AND ("system_id" = $2 OR "system_id" IS NULL)`;
  }

  await runQuery(sql, params);
  return true;
}

export async function clearTableData(tableName: string, systemIdFilter?: string | null): Promise<boolean> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }

  const normTable = sanitizeIdentifier(tableName.toLowerCase());
  if (!ALLOWED_TABLES.has(normTable)) {
    throw new Error(`Tabela não permitida: ${normTable}`);
  }

  const colMap = await getTableColumns(normTable);
  if (systemIdFilter && colMap.has('system_id')) {
    await runQuery(`DELETE FROM public."${normTable}" WHERE "system_id" = $1`, [String(systemIdFilter)]);
  } else {
    await runQuery(`DELETE FROM public."${normTable}"`);
  }
  return true;
}

// ==========================================
// 6. AUTENTICAÇÃO PRÓPRIA (HASH DE SENHA E RESOLUÇÃO DE TENANT)
// ==========================================
export async function resolveRootAdminSystemId(user?: Record<string, any> | null): Promise<string> {
  if (!user) return DEFAULT_SYSTEM_UUID;

  if (user.system_id && isValidUUID(user.system_id)) {
    return user.system_id;
  }

  if (!pool) return user.system_id || DEFAULT_SYSTEM_UUID;

  try {
    if (user.unidade) {
      const res = await runQuery(
        `SELECT system_id FROM public.users WHERE unidade = $1 AND (UPPER(COALESCE(role, '')) LIKE '%ADMIN%' OR is_full_admin = true) AND system_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
        [String(user.unidade)]
      );
      if (res.rows[0]?.system_id) return res.rows[0].system_id;
    }

    if (user.company_id) {
      const res = await runQuery(
        `SELECT system_id FROM public.users WHERE company_id = $1 AND (UPPER(COALESCE(role, '')) LIKE '%ADMIN%' OR is_full_admin = true) AND system_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
        [String(user.company_id)]
      );
      if (res.rows[0]?.system_id) return res.rows[0].system_id;
    }

    const rootRes = await runQuery(
      `SELECT system_id FROM public.users WHERE (UPPER(COALESCE(role, '')) LIKE '%ADMIN%' OR is_full_admin = true) AND system_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`
    );
    if (rootRes.rows[0]?.system_id) return rootRes.rows[0].system_id;
  } catch (err: any) {
    console.warn('[AUTH] Erro ao resolver system_id do Administrador Raiz:', err?.message);
  }

  return DEFAULT_SYSTEM_UUID;
}

export async function authenticateUser(
  identifier: string,
  plainPassword: string
): Promise<{ user: any | null; error?: string }> {
  if (!pool) {
    return { user: null, error: 'Banco de dados PostgreSQL não configurado.' };
  }

  if (!dbInitialized) {
    await initDatabase();
  }

  const cleanIdent = (identifier || '').trim();
  const cleanCpf = cleanIdent.replace(/\D/g, '');

  const res = await runQuery(
    `SELECT * FROM public.users
     WHERE LOWER(COALESCE(login_acesso, '')) = LOWER($1)
        OR LOWER(COALESCE(email, '')) = LOWER($1)
        OR ($2 <> '' AND REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $2)
     LIMIT 10`,
    [cleanIdent, cleanCpf]
  );

  for (const row of res.rows) {
    const hashMatched = row.password_hash ? verifyPassword(plainPassword, row.password_hash) : false;
    const legacyMatched = !hashMatched && row.senha_acesso ? verifyPassword(plainPassword, row.senha_acesso) : false;

    if (hashMatched || legacyMatched) {
      // Migra automaticamente senha legada para password_hash scrypt
      if (legacyMatched && !row.password_hash) {
        try {
          const newHash = hashPassword(plainPassword);
          await runQuery(
            `UPDATE public.users SET password_hash = $1, senha_acesso = NULL WHERE id = $2`,
            [newHash, row.id]
          );
        } catch {}
      }

      const rootSystemId = await resolveRootAdminSystemId(row);
      const sanitized = sanitizeUserOutput({
        ...row,
        system_id: rootSystemId
      });
      return { user: sanitized };
    }
  }

  return { user: null, error: 'Credenciais incorretas ou usuário não localizado.' };
}

export async function lookupUserForReset(identifier: string): Promise<any | null> {
  if (!pool) return null;
  if (!dbInitialized) await initDatabase();

  const cleanIdent = (identifier || '').trim();
  const cleanCpf = cleanIdent.replace(/\D/g, '');

  const res = await runQuery(
    `SELECT id, system_id, name, full_name, email, login_acesso, role
     FROM public.users
     WHERE LOWER(COALESCE(email, '')) = LOWER($1)
        OR LOWER(COALESCE(login_acesso, '')) = LOWER($1)
        OR ($2 <> '' AND REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $2)
     LIMIT 1`,
    [cleanIdent, cleanCpf]
  );

  return res.rows[0] || null;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL não configurado.');
  }
  if (!dbInitialized) await initDatabase();

  const newHash = hashPassword(newPassword);
  const res = await runQuery(
    `UPDATE public.users SET password_hash = $1, senha_acesso = NULL, updated_at = now() WHERE id = $2 RETURNING id`,
    [newHash, userId]
  );
  return res.rows.length > 0;
}

// ==========================================
// 7. CONTEXTO OPERACIONAL (TICO IA)
// ==========================================
export async function getOperationalContext(systemId?: string | null) {
  const emptyContext = {
    timestamp: new Date().toISOString(),
    database: 'Aiven PostgreSQL',
    fleetSummary: { total: 0, active: 0, maintenance: 0, vehicles: [] },
    routesSummary: { totalActiveRoutes: 0, routes: [] },
    tripsSummary: { totalTripsLogged: 0, recentTrips: [] },
    occurrencesSummary: { pendingOccurrences: 0, occurrences: [] },
    companiesSummary: { companies: [] }
  };

  if (!pool) return emptyContext;

  try {
    if (!dbInitialized) await initDatabase();

    const sysFilter = systemId || null;
    const [routes, trips, vehicles, companies, occurrences] = await Promise.all([
      fetchAllRows('routes', { limit: 100 }, { systemId: sysFilter, bypassSystemId: !sysFilter }),
      fetchAllRows('trips', { limit: 100 }, { systemId: sysFilter, bypassSystemId: !sysFilter }),
      fetchAllRows('vehicles', { limit: 100 }, { systemId: sysFilter, bypassSystemId: !sysFilter }),
      fetchAllRows('companies', { limit: 50 }, { systemId: sysFilter, bypassSystemId: !sysFilter }),
      fetchAllRows('occurrences', { limit: 50 }, { systemId: sysFilter, bypassSystemId: !sysFilter })
    ]);

    const pendingOccurrences = occurrences.filter((o: any) => o.status !== 'Concluído');
    const totalFleet = vehicles.length;
    const activeFleet = vehicles.filter((v: any) => v.status === 'ATIVO' || v.is_operational === true).length;
    const maintenanceFleet = vehicles.filter((v: any) => v.status === 'MANUTENÇÃO' || v.status === 'MANUTENCAO' || v.inspection_status === 'REPROVADO').length;

    return {
      timestamp: new Date().toISOString(),
      database: 'Aiven PostgreSQL',
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
        pendingOccurrences: pendingOccurrences.length,
        occurrences: pendingOccurrences
      },
      companiesSummary: {
        companies
      }
    };
  } catch (err: any) {
    console.error('[Aiven DB] Error assembling operational context:', err?.message || err);
    return {
      ...emptyContext,
      error: err?.message || 'Erro ao consultar contexto operacional'
    };
  }
}

// ==========================================
// 8. RESTAURAÇÃO COMPLETA DE BACKUP JSON MULTI-TENANT
// ==========================================
const BACKUP_TABLE_ALIASES: Record<string, string> = {
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

const RESTORE_PRIORITY_ORDER: string[] = [
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

export function extractBackupTablesMap(rawInput: any): Record<string, any[]> {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return {};
  }

  let source: Record<string, any> = rawInput;
  // Suporta formatos encapsulados { data: {...} }, { tables: {...} }, { backup: {...} }
  for (const wrapperKey of ['data', 'tables', 'backup', 'snapshot', 'records']) {
    const candidate = rawInput[wrapperKey];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const hasArrays = Object.values(candidate).some((v) => Array.isArray(v));
      if (hasArrays) {
        source = candidate;
        break;
      }
    }
  }

  const normalizedMap: Record<string, any[]> = {};
  for (const [rawKey, val] of Object.entries(source)) {
    if (!Array.isArray(val) || val.length === 0) continue;
    const lowered = rawKey.trim().toLowerCase();
    const mapped = BACKUP_TABLE_ALIASES[lowered] || lowered;
    if (!ALLOWED_TABLES.has(mapped) || mapped === 'email_verification_codes') continue;
    if (!normalizedMap[mapped]) {
      normalizedMap[mapped] = [];
    }
    normalizedMap[mapped].push(...val);
  }
  return normalizedMap;
}

function prepareRestoredRecord(
  table: string,
  rawRow: any,
  targetSystemId: string
): Record<string, any> | null {
  if (!rawRow || typeof rawRow !== 'object') return null;

  const item: Record<string, any> = { ...rawRow };
  for (const k of Object.keys(item)) {
    if (k.startsWith('_') || item[k] === undefined) {
      delete item[k];
    }
  }

  item.id = item.id && String(item.id).trim() !== '' ? String(item.id).trim() : generateUUID();
  item.system_id = targetSystemId;

  if (table === 'companies') {
    if (item.city && !item.cidade) item.cidade = item.city;
    if (item.city && !item.address_city) item.address_city = item.city;
    if (item.state && !item.uf) item.uf = item.state;
    if (item.state && !item.address_state) item.address_state = item.state;
    if (item.trade_name && !item.nome_fantasia) item.nome_fantasia = item.trade_name;
    if (item.corporate_name && !item.razao_social) item.razao_social = item.corporate_name;
    if (item.street && !item.logradouro) item.logradouro = item.street;
    if (item.neighborhood && !item.bairro) item.bairro = item.neighborhood;
    if ((item.zip || item.zip_code) && !item.cep) item.cep = item.zip || item.zip_code;
    if (item.number && !item.numero) item.numero = item.number;
    if (item.phone && !item.telefone) item.telefone = item.phone;
    if (!item.name || String(item.name).trim() === '') {
      item.name = item.nome_fantasia || item.razao_social || 'Empresa Restaurada';
    }
    if (item.active === undefined) item.active = true;
  } else if (table === 'routes') {
    if (item.route_code && !item.line_code) item.line_code = item.route_code;
    if (item.route_code && !item.route_number) item.route_number = item.route_code;
    if (item.route_code && !item.prefixo_linha) item.prefixo_linha = item.route_code;
    if (item.route_name && !item.letreiro_principal) item.letreiro_principal = item.route_name;
    if (!item.origin || String(item.origin).trim() === '') {
      item.origin = (item.name ? String(item.name).split(' - ')[0] : '') || 'Origem';
    }
    if (!item.destination || String(item.destination).trim() === '') {
      item.destination = (item.name ? String(item.name).split(' - ')[1] : '') || 'Destino';
    }
    if (!item.route_number) item.route_number = item.code || item.prefixo_linha || '001';
    if (!item.price && item.tarifa_integral) item.price = Number(item.tarifa_integral);
    if (!item.tarifa_integral && item.price) item.tarifa_integral = Number(item.price);
    if (item.active === undefined) item.active = true;
    const chosenColor = item.letreiro_cor || item.display_main_color || item.letreiro_principal_cor || '#ffaa00';
    item.letreiro_cor = chosenColor;
    item.display_main_color = chosenColor;
    item.letreiro_principal_cor = chosenColor;
    item.via1_cor = item.via1_cor || chosenColor;
    item.via2_cor = item.via2_cor || chosenColor;
    item.via3_cor = item.via3_cor || chosenColor;
  } else if (table === 'vehicles') {
    if (!item.prefix || String(item.prefix).trim() === '') item.prefix = item.plate || '0000';
    if (!item.plate || String(item.plate).trim() === '') item.plate = `V-${String(item.prefix).slice(0, 6)}`;
    if (!item.model || String(item.model).trim() === '') item.model = 'Ônibus Executivo';
    if (!item.chassis && item.chassi) item.chassis = item.chassi;
    if (item.active === undefined) item.active = true;
    if (item.is_operational === undefined) item.is_operational = true;
  } else if (table === 'drivers') {
    if (item.name && !item.full_name) item.full_name = item.name;
    if (!item.full_name || String(item.full_name).trim() === '') item.full_name = 'Motorista';
    if (!item.cpf || String(item.cpf).trim() === '') item.cpf = '00000000000';
    if (!item.cnh_number || String(item.cnh_number).trim() === '') item.cnh_number = item.cnh || '00000000000';
    if (!item.cnh_category || String(item.cnh_category).trim() === '') item.cnh_category = item.tipo_cnh || 'D';
    if (!item.cnh_expiration || String(item.cnh_expiration).trim() === '') item.cnh_expiration = item.validade_cnh || '2029-12-31';
    if (!item.status) item.status = 'Ativo';
  } else if (table === 'trips') {
    if (!item.departure_time || String(item.departure_time).trim() === '') item.departure_time = item.scheduled_start || '08:00';
    if (!item.status) item.status = 'Agendada';
    if (item.finished === undefined) item.finished = false;
    if (item.active === undefined) item.active = true;
  } else if (table === 'shifts') {
    if (!item.date || String(item.date).trim() === '') item.date = new Date().toISOString().slice(0, 10);
    if (!item.start_time || String(item.start_time).trim() === '') item.start_time = '08:00';
    if (!item.end_time || String(item.end_time).trim() === '') item.end_time = '16:00';
    if (!item.status) item.status = 'AGENDADO';
  } else if (table === 'users') {
    if (item.login_acesso && !item.login) item.login = item.login_acesso;
    if (item.login_acesso && !item.username) item.username = item.login_acesso;
    if (item.full_name && !item.name) item.name = String(item.full_name).split(' ')[0];
    if (item.name && !item.full_name) item.full_name = item.name;
    if (item.active === undefined) item.active = true;
    if (item.is_active === undefined) item.is_active = true;
    if (!item.status) item.status = 'active';
  } else if (table === 'cities') {
    if (!item.name || String(item.name).trim() === '') item.name = 'Município';
    if (!item.state || String(item.state).trim() === '') item.state = 'SP';
    if (item.active === undefined) item.active = true;
    if (item.is_active === undefined) item.is_active = true;
  } else if (table === 'bus_stations' || table === 'bus_terminals' || table === 'ticket_booths' || table === 'role_configs') {
    if (!item.name || String(item.name).trim() === '') {
      item.name = table === 'bus_stations' ? 'Terminal Rodoviário' : table === 'bus_terminals' ? 'Terminal Urbano' : table === 'ticket_booths' ? 'Guichê Principal' : 'Cargo';
    }
  } else if (table === 'notices') {
    if (!item.title || String(item.title).trim() === '') item.title = 'Comunicado';
    if (!item.content || String(item.content).trim() === '') item.content = item.title;
  } else if (table === 'notifications') {
    if (!item.title || String(item.title).trim() === '') item.title = 'Notificação';
    if (!item.message || String(item.message).trim() === '') item.message = item.title;
  } else if (table === 'payroll_rubrics') {
    if (!item.code || String(item.code).trim() === '') item.code = String(item.id).slice(0, 8).toUpperCase();
    if (!item.name || String(item.name).trim() === '') item.name = `Rubrica ${item.code}`;
    if (!item.type || String(item.type).trim() === '') item.type = 'EARNING';
  } else if (table === 'time_tracking') {
    if (!item.user_id || String(item.user_id).trim() === '') item.user_id = 'unknown-user';
    if (!item.date || String(item.date).trim() === '') item.date = new Date().toISOString().slice(0, 10);
  } else if (table === 'job_vacancies') {
    if (!item.job_title || String(item.job_title).trim() === '') item.job_title = 'Vaga Operacional';
  } else if (table === 'job_applications') {
    if (!item.full_name || String(item.full_name).trim() === '') item.full_name = 'Candidato';
  } else if (table === 'activation_keys') {
    if (!item.key_code || String(item.key_code).trim() === '') {
      item.key_code = `KEY-${String(item.id).slice(0, 8).toUpperCase()}`;
    }
    item.activated_by_system_id = targetSystemId;
  } else if (table === 'system_settings') {
    if (!item.key) item.key = 'config_default';
    const knownSettingsCols = new Set([
      'id', 'system_id', 'key', 'value', 'description', 'company_name',
      'system_name', 'nome_da_empresa', 'registration_pattern', 'theme_color',
      'high_contrast', 'glass_effect', 'updated_at'
    ]);
    let existingVal: Record<string, any> = {};
    try {
      if (typeof item.value === 'string' && item.value.trim().startsWith('{')) {
        existingVal = JSON.parse(item.value);
      } else if (item.value && typeof item.value === 'object') {
        existingVal = { ...item.value };
      }
    } catch {}
    for (const [k, v] of Object.entries(item)) {
      if (!knownSettingsCols.has(k)) {
        existingVal[k] = v;
        delete item[k];
      }
    }
    if (Object.keys(existingVal).length > 0) {
      item.value = strictJsonSerialize(existingVal);
    }
  } else if (table === 'imp_cards') {
    const metaObj: Record<string, any> = {};
    if (item.abbreviation && typeof item.abbreviation === 'string' && item.abbreviation.trim()) {
      metaObj.abbreviation = item.abbreviation.trim().toUpperCase();
    }
    if (item.company_id) {
      metaObj.company_id = item.company_id;
      item.card_logo_left_url = String(item.company_id);
    }
    if (item.company_name) {
      metaObj.company_name = item.company_name;
      item.card_logo_right_url = String(item.company_name);
    }
    if (item.company_logo) {
      metaObj.company_logo = item.company_logo;
      item.left_logo_url = String(item.company_logo);
    }
    if (item.internal_code) {
      metaObj.internal_code = item.internal_code;
      item.right_logo_url = String(item.internal_code);
    }
    if (Object.keys(metaObj).length > 0 && !item.ai_art_url) {
      item.ai_art_url = strictJsonSerialize(metaObj);
    }
  }

  return item;
}

export interface RestoreBackupResult {
  success: boolean;
  targetSystemId: string;
  tablesProcessed: number;
  tablesRestored: number;
  recordsRestored: number;
  failedCount: number;
  tableStats: Record<string, { restored: number; failed: number }>;
  errors: Array<{ table: string; id?: string; message: string }>;
}

export async function restoreBackupData(
  rawBackup: any,
  targetSystemIdOverride?: string | null
): Promise<RestoreBackupResult> {
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL (DATABASE_URL) não configurado.');
  }
  if (!dbInitialized) {
    await initDatabase();
  }

  const targetSystemId =
    targetSystemIdOverride &&
    targetSystemIdOverride !== 'sys-vialivre-default' &&
    targetSystemIdOverride !== 'default-sys'
      ? String(targetSystemIdOverride)
      : DEFAULT_SYSTEM_UUID;

  const tablesMap = extractBackupTablesMap(rawBackup);
  const allTableNames = Object.keys(tablesMap);

  const orderedTables = [
    ...RESTORE_PRIORITY_ORDER.filter((t) => allTableNames.includes(t)),
    ...allTableNames.filter((t) => !RESTORE_PRIORITY_ORDER.includes(t))
  ];

  let tablesRestored = 0;
  let recordsRestored = 0;
  let failedCount = 0;
  const tableStats: Record<string, { restored: number; failed: number }> = {};
  const errors: Array<{ table: string; id?: string; message: string }> = [];

  for (const table of orderedTables) {
    const rows = tablesMap[table] || [];
    if (rows.length === 0) continue;

    let tableRestored = 0;
    let tableFailed = 0;

    // Para system_settings, reutiliza o ID existente do tenant caso já exista para evitar registros duplicados
    let existingSettingsId: string | null = null;
    if (table === 'system_settings') {
      try {
        const existingRes = await runQuery(
          `SELECT id FROM public.system_settings WHERE system_id = $1 LIMIT 1`,
          [targetSystemId]
        );
        if (existingRes.rows[0]?.id) {
          existingSettingsId = String(existingRes.rows[0].id);
        }
      } catch {}
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const prepared = prepareRestoredRecord(table, rows[idx], targetSystemId);
      if (!prepared) continue;

      if (table === 'system_settings' && existingSettingsId && idx === 0) {
        prepared.id = existingSettingsId;
      }

      try {
        await upsertRow(table, prepared, targetSystemId);
        tableRestored++;
        recordsRestored++;
      } catch (rowErr: any) {
        tableFailed++;
        failedCount++;
        if (errors.length < 30) {
          errors.push({
            table,
            id: prepared.id,
            message: rowErr?.message || 'Erro ao gravar registro'
          });
        }
        console.warn(`[RESTORE_BACKUP] Falha ao restaurar ${table} (${prepared.id}):`, rowErr?.message || rowErr);
      }
    }

    tableStats[table] = { restored: tableRestored, failed: tableFailed };
    if (tableRestored > 0) {
      tablesRestored++;
    }
  }

  return {
    success: recordsRestored > 0 || (orderedTables.length === 0 && failedCount === 0),
    targetSystemId,
    tablesProcessed: orderedTables.length,
    tablesRestored,
    recordsRestored,
    failedCount,
    tableStats,
    errors
  };
}

