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
import { 
  supabase, 
  isSupabaseConfigured, 
  SUPABASE_URL as RAW_SB_URL, 
  SUPABASE_ANON_KEY as RAW_SB_KEY,
  getCleanSupabaseConfig 
} from './supabaseClient';
import { safeLocalStorage } from '../utils/storage';
import { pontoIndexedDB } from './pontoIndexedDB';
export { pontoIndexedDB };
export type RealtimeChannel = any;

const SAFE_DEFAULT_SB_URL = 'https://kkvmtqthahbcobsqmugl.supabase.co';
const SAFE_DEFAULT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrdm10cXRoYWhiY29ic3FtdWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MDM0MDUsImV4cCI6MjA4NDI3OTQwNX0.cYc8Qx8bpZFoxZ6RR-kgrE12l-4wDQx2MGcWBPvd24g';

export const SUPABASE_URL = RAW_SB_URL || SAFE_DEFAULT_SB_URL;
export const SUPABASE_ANON_KEY = RAW_SB_KEY || SAFE_DEFAULT_SB_KEY;
export { supabase, isSupabaseConfigured };

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
  | 'cashier_logs';

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
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {}
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
      if (explicit && isValidUUID(explicit)) {
        return explicit;
      }
      const u = safeLocalStorage.getItem('fluxo_session_user') || safeLocalStorage.getItem('@vialivre_user');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.system_id && isValidUUID(parsed.system_id)) {
          return parsed.system_id;
        }
      }
    }
  } catch {}
  return null;
};

export let currentSystemId: string | null = getStoredSystemId();

export const fetchRootAdminSystemId = async (user?: Partial<User> | null): Promise<string> => {
  try {
    const isUserAdmin = (user?.role || '').toUpperCase() === 'ADMIN' || user?.is_full_admin === true || (user?.job_title || '').toUpperCase().includes('ADMINISTRADOR');

    // 1. Se o próprio usuário for Administrador e possuir system_id UUID válido, define e retorna imediatamente
    if (isUserAdmin && user?.system_id && isValidUUID(user.system_id)) {
      currentSystemId = user.system_id;
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('vialivre_system_id', user.system_id);
      }
      return user.system_id;
    }

    // 2. Se o colaborador logado já tiver system_id UUID válido em seu cadastro de usuário
    if (user?.system_id && isValidUUID(user.system_id)) {
      currentSystemId = user.system_id;
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('vialivre_system_id', user.system_id);
      }
      return user.system_id;
    }

    // 3. Busca o Administrador Raiz da mesma unidade organizacional do colaborador na tabela public.users
    if (user?.unidade) {
      const { data: unitAdmins, error: unitErr } = await supabase
        .from('users')
        .select('id, system_id, role, is_full_admin, created_at')
        .eq('unidade', user.unidade)
        .or('role.ilike.%ADMIN%,is_full_admin.eq.true')
        .not('system_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!unitErr && unitAdmins && unitAdmins.length > 0 && unitAdmins[0].system_id) {
        const found = unitAdmins[0].system_id;
        currentSystemId = found;
        if (typeof window !== 'undefined') {
          safeLocalStorage.setItem('vialivre_system_id', found);
        }
        return found;
      }
    }

    // 4. Busca o Administrador Raiz pela empresa vinculada (company_id)
    if (user?.company_id) {
      const { data: compAdmins, error: compErr } = await supabase
        .from('users')
        .select('id, system_id, role, is_full_admin, created_at')
        .eq('company_id', user.company_id)
        .or('role.ilike.%ADMIN%,is_full_admin.eq.true')
        .not('system_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!compErr && compAdmins && compAdmins.length > 0 && compAdmins[0].system_id) {
        const found = compAdmins[0].system_id;
        currentSystemId = found;
        if (typeof window !== 'undefined') {
          safeLocalStorage.setItem('vialivre_system_id', found);
        }
        return found;
      }
    }

    // 5. Busca o Administrador Raiz geral primário na tabela public.users
    const { data: rootAdmins, error: rootErr } = await supabase
      .from('users')
      .select('id, system_id, role, is_full_admin, created_at')
      .or('role.ilike.%ADMIN%,is_full_admin.eq.true')
      .not('system_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!rootErr && rootAdmins && rootAdmins.length > 0 && rootAdmins[0].system_id) {
      const rootSysId = rootAdmins[0].system_id;
      currentSystemId = rootSysId;
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('vialivre_system_id', rootSysId);
      }
      return rootSysId;
    }
  } catch (err) {
    console.error('[AUTH] Erro ao buscar system_id do Administrador Raiz na tabela users do Supabase:', err);
  }

  // Fallback seguro para o ID da organização padrão do sistema
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
    'id', 'created_at', 'active', 'company_id', 'origin', 'destination', 'price', 'letreiro_principal',
    'route_number', 'schedule', 'sections', 'status', 'stops', 'via1', 'via2', 'via3', 'prefixo_linha',
    'lightdot_code', 'via_1', 'tarifa_integral', 'route_type', 'service_number', 'service_type',
    'prefix_code', 'duration_minutes', 'letreiro_principal_modo', 'letreiro_principal_texto',
    'letreiro_secundario_modo', 'letreiro_secundario_texto', 'via1_modo', 'via1_texto', 'via2_modo',
    'via2_texto', 'via3_modo', 'via3_texto', 'boarding_fee', 'toll', 'origin_lat', 'origin_lng',
    'destination_lat', 'destination_lng', 'origin_cep', 'destination_cep', 'origin_number',
    'destination_number', 'origin_city', 'destination_city', 'origin_neighborhood',
    'destination_neighborhood', 'departure_point', 'arrival_point', 'fees', 'line_prefix',
    'display_main_color', 'display_main_mode', 'display_main_speed', 'via1_mode', 'via2_mode',
    'via3_mode', 'letreiro_principal_cor', 'letreiro_principal_velocidade', 'system_id', 'payment_type',
    'full_fare', 'municipality_id', 'line_code', 'schedule_weekdays', 'schedule_saturdays',
    'schedule_sundays', 'estimated_travel_time_text', 'payment_methods_accepted', 'service_class',
    'origin_station_id', 'origin_station_platform', 'destination_station_id',
    'destination_station_platform', 'via1_cor', 'via2_cor', 'via3_cor', 'exibir_codigo_letreiro',
    'created_by', 'updated_by', 'is_active'
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
    'address_street', 'address_neighborhood', 'address_city', 'address_state', 'address_number', 'inspection_status'
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
    'destination_terminal', 'conductor_id', 'conductor_name', 'ignore_company_filter', 'odometer_start',
    'odometer_end', 'fuel_level_end', 'tickets_sold', 'electronic_payments', 'selectedTimes', 'checklist_ok',
    'fuel_level', 'initial_turnstile', 'cash_total', 'card_total', 'vt_total', 'final_turnstile', 'initial_odometer'
  ]),
  itineraries: new Set([
    'id', 'via_1', 'via_2', 'via_3', 'nome_itinerario', 'full_fare', 'stops_list', 'sections_data',
    'schedule_week', 'schedule_sat', 'schedule_sun', 'system_id'
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
    'route_id', 'trip_date', 'booth_data', 'booth_id', 'section_origin', 'section_destination'
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
    'created_at', 'target_role', 'target_audience', 'system_id'
  ]),
  notifications: new Set([
    'id', 'created_at', 'user_id', 'title', 'message', 'read', 'type', 'is_read', 'priority', 'category',
    'system_id', 'target_role'
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
    'access_maintenance', 'access_global_management', 'system_id', 'base_role', 'can_access_checkin', 'can_access_diary'
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
    'id', 'user_id', 'date', 'clock_in', 'break_start', 'break_end', 'clock_out', 'gps_location', 'created_at',
    'total_daily_hours', 'system_id'
  ]),
  drivers: new Set([
    'id', 'full_name', 'cpf', 'cnh_number', 'cnh_category', 'cnh_expiration', 'phone', 'status', 'created_at', 'system_id'
  ]),
  inspections: new Set([
    'id', 'created_at', 'vehicle_id', 'inspector_name', 'items_checked', 'status', 'notes', 'agency', 'checklist', 'date', 'inspector_id', 'location', 'type', 'photo_url', 'system_id'
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
      cleaned[key] = JSON.stringify(v);
      continue;
    }

    cleaned[key] = v;
  }
  
  // Aliases e Mapeamento de Colunas por Tabela
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

    // Se empresa autuante for informada, encapsula com segurança em sections para persistência
    if (obj.empresa_autuante || obj.empresa_autuante_id) {
      let sectionsArr: any[] = [];
      try {
        if (Array.isArray(cleaned.sections)) sectionsArr = [...cleaned.sections];
        else if (typeof cleaned.sections === 'string') sectionsArr = JSON.parse(cleaned.sections);
      } catch {}
      const metaObj = {
        __route_meta__: true,
        empresa_autuante: obj.empresa_autuante || null,
        empresa_autuante_id: obj.empresa_autuante_id || null
      };
      const existingMetaIdx = sectionsArr.findIndex(s => s && s.__route_meta__);
      if (existingMetaIdx >= 0) sectionsArr[existingMetaIdx] = metaObj;
      else sectionsArr.push(metaObj);
      cleaned.sections = sectionsArr;
    }
  }

  if (table === 'drivers') {
    if (obj.name && !cleaned.full_name) cleaned.full_name = obj.name;
    if (!cleaned.full_name) cleaned.full_name = 'Motorista';
    if (!cleaned.cpf) cleaned.cpf = '00000000000';
    if (!cleaned.cnh_number) cleaned.cnh_number = cleaned.cnh || '00000000000';
    if (!cleaned.cnh_category) cleaned.cnh_category = cleaned.tipo_cnh || 'D';
    if (!cleaned.cnh_expiration) cleaned.cnh_expiration = cleaned.validade_cnh || '2029-12-31';
    if (!cleaned.status) cleaned.status = 'Ativo';
    delete cleaned.active; // Coluna não existe no PostgreSQL na tabela drivers
    delete cleaned.name;
    delete cleaned.email;
    delete cleaned.photo_url;
  }

  if (table === 'vehicles') {
    if (!cleaned.plate) cleaned.plate = 'ABC-' + Math.floor(1000 + Math.random() * 9000);
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
    delete cleaned.created_by;
  }

  if (table === 'shifts') {
    if (!isUpdate) delete cleaned.id;
    else if (typeof cleaned.id === 'string' && isNaN(Number(cleaned.id))) delete cleaned.id;
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
    if (typeof cleaned.id === 'string' && isNaN(Number(cleaned.id))) {
      delete cleaned.id;
    }
    // Encapsula propriedades adicionais de configuração institucional e VT dentro da coluna value (JSON)
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
      cleaned.value = JSON.stringify({ ...existingVal, ...extraSettings });
    }
  }

  if (table === 'imp_cards') {
    if (obj.abbreviation && typeof obj.abbreviation === 'string' && obj.abbreviation.trim()) {
      cleaned.ai_art_url = 'abbr:' + obj.abbreviation.trim().toUpperCase();
    }
  }

  if (table === 'time_tracking' as any) {
    delete cleaned.total_daily_hours;
  }
  
  if (table === 'users') {
    delete cleaned.pis;
    delete cleaned.occurrences;
    if (cleaned.login_acesso && !cleaned.login) cleaned.login = cleaned.login_acesso;
    if (cleaned.login_acesso && !cleaned.username) cleaned.username = cleaned.login_acesso;
    if (cleaned.login_acesso && !cleaned.login_usuario) cleaned.login_usuario = cleaned.login_acesso;
    if (cleaned.senha_acesso && !cleaned.senha) cleaned.senha = cleaned.senha_acesso;
    if (cleaned.senha_acesso && !cleaned.password) cleaned.password = cleaned.senha_acesso;
    if (cleaned.senha_acesso && !cleaned.login_senha) cleaned.login_senha = cleaned.senha_acesso;
    if (cleaned.full_name && !cleaned.name) cleaned.name = cleaned.full_name.split(' ')[0];
    if (cleaned.name && !cleaned.full_name) cleaned.full_name = cleaned.name;
    if (!cleaned.email) cleaned.email = `${cleaned.login || 'usuario'}_${Date.now()}@vialivre.com.br`;
    if (cleaned.is_active === undefined) cleaned.is_active = true;
    if (cleaned.active === undefined) cleaned.active = true;
    if (!cleaned.status) cleaned.status = 'active';
  }

  if (table === 'notifications') {
    delete cleaned.metadata;
  }

  // Garantia do system_id exclusivo ou da organização (INSERT automático)
  const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
  if (!cleaned.system_id || cleaned.system_id === 'sys-vialivre-default' || cleaned.system_id === 'default-sys' || cleaned.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb') {
    cleaned.system_id = activeSys;
  }

  // Filtra estritamente as colunas conhecidas para a tabela no PostgreSQL, evitando erro de schema cache
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
  
  if (error.code && typeof error.code === 'string' && (error.code.length === 5 || error.code.startsWith('PGRST'))) {
    return false;
  }
  
  const msg = (typeof error === 'string' ? error : (error.message || error.details || error.hint || '')).toLowerCase();
  const name = (error.name || '').toLowerCase();
  
  return (
    name === 'aborterror' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('net::err') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('offline') ||
    msg.includes('load failed')
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

// Helper para gerenciar exclusões locais
const getDeletedIds = (table: TableName): Set<string> => {
  try {
    const raw = safeLocalStorage.getItem(`vialivre_deleted_${table}`);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set<string>();
  }
};

const addDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    set.add(id);
    safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn(`[DB_DELETED_SAVE_ERROR] Erro ao gravar exclusão de ${table}:`, e);
  }
};

const removeDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    if (set.has(id)) {
      set.delete(id);
      safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
};

// Cache local com suporte a multitenancy (somente espelho do Supabase)
const getLocalData = <T>(table: TableName): T[] => {
  const deleted = getDeletedIds(table);
  const isPublicPassenger = PUBLIC_PASSENGER_TABLES.includes(table);
  const activeSysId = currentSystemId || getStoredSystemId();

  try {
    let rawList: any[] = [];
    const raw = safeLocalStorage.getItem(`vialivre_db_${table}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        rawList = parsed;
      }
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
        // Tabelas públicas de passageiros são livres para consulta
        if (isPublicPassenger || table === 'activation_keys' || !activeSysId) {
          return true;
        }
        // Se usuário autenticado está consultando tabelas isoladas, filtra pelo system_id
        if (!x.system_id) return true; // Legados ou dados globais
        if (activeSysId === DEFAULT_SYSTEM_UUID) {
          return x.system_id === DEFAULT_SYSTEM_UUID || x.system_id === 'sys-vialivre-default';
        }
        return x.system_id === activeSysId;
      }) as T[];
    }
  } catch (e) {
    console.warn(`[DB_LOCAL_READ_ERROR] Erro ao ler cache local de ${table}:`, e);
  }

  return [];
};

const setLocalData = <T>(table: TableName, data: T[]): void => {
  try {
    safeLocalStorage.setItem(`vialivre_db_${table}`, JSON.stringify(data));
    if (table === 'bus_stations' || table === 'bus_terminals') {
      safeLocalStorage.setItem('vialivre_bus_stations', JSON.stringify(data));
    }
  } catch (e) {
    console.warn(`[DB_LOCAL_SAVE_ERROR] Erro ao salvar cache local de ${table}:`, e);
  }
};

// Nuvem Supabase Storage para persistência de dados transparente e imune a recursão RLS
const CLOUD_STORAGE_BUCKET = 'photos';
const CLOUD_STORAGE_PREFIX = 'vialivre_cloud_db';

export const isRlsRecursionError = (err: any): boolean => {
  if (!err) return false;
  if (err.code === '42P17') return true;
  const msg = (typeof err === 'string' ? err : (err.message || err.details || err.hint || '')).toLowerCase();
  return msg.includes('infinite recursion') || msg.includes('recursion detected');
};

export const syncTableToCloudStorage = async (table: TableName, data: any[]): Promise<void> => {
  try {
    const jsonStr = JSON.stringify(data);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    await supabase.storage.from(CLOUD_STORAGE_BUCKET).upload(`${CLOUD_STORAGE_PREFIX}/${table}.json`, blob, {
      upsert: true,
      contentType: 'application/json'
    });
  } catch (err) {
    // Non-blocking background cloud mirror
  }
};

export const fetchTableFromCloudStorage = async <T>(table: TableName): Promise<T[] | null> => {
  try {
    const { data, error } = await supabase.storage.from(CLOUD_STORAGE_BUCKET).download(`${CLOUD_STORAGE_PREFIX}/${table}.json`);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// Gerenciamento de Fila de Sincronização
const SYNC_QUEUE_KEY = 'vialivre_sync_queue';

const getSyncQueue = (): PendingAction[] => {
  try {
    const raw = safeLocalStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Erro ao ler fila de sincronização:', e);
    return [];
  }
};

const saveSyncQueue = (queue: PendingAction[]): void => {
  try {
    safeLocalStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifyStatusChange();
  } catch (e) {
    console.error('Erro ao salvar fila de sincronização:', e);
  }
};

const addToSyncQueue = (item: Omit<PendingAction, 'id' | 'timestamp'>): PendingAction => {
  const queue = getSyncQueue();
  const newAction: PendingAction = {
    ...item,
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };
  
  const existingIdx = queue.findIndex(q => q.table === item.table && q.recordId === item.recordId);
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
  isOffline: !isSupabaseConfigured,
  pendingSyncCount: getSyncQueue().length,
  isSyncing: false,
  lastSyncAt: null,
  lastError: !isSupabaseConfigured ? 'Banco de dados em nuvem não configurado' : null
};

const statusListeners = new Set<(status: DbStatus) => void>();

const dispatchSystemToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vialivre-show-toast', { detail: { message, type } }));
  }
};

const notifyStatusChange = () => {
  dbStatus.pendingSyncCount = getSyncQueue().length;
  statusListeners.forEach(cb => {
    try {
      cb({ ...dbStatus });
    } catch (e) {
      console.warn('Erro em listener de status do banco:', e);
    }
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

// Monitoramento de Conexão Online/Offline e Sincronização Periódica
if (typeof window !== 'undefined') {
  const triggerAutoSync = async () => {
    db.checkConnection().then(async (isOnline) => {
      if (isOnline) {
        const result = await db.syncPendingActions();
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        if (result.syncedCount > 0) {
          dispatchSystemToast(`Sincronizado: ${result.syncedCount} itens salvos na nuvem`, 'success');
        }
      }
    });
  };

  window.addEventListener('online', () => {
    dispatchSystemToast('Rede reconectada. Sincronizando...', 'info');
    triggerAutoSync();
  });

  window.addEventListener('offline', () => {
    updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
    dispatchSystemToast('Sem conexão com a internet', 'warning');
  });

  // Sincronizar ao focar na janela (ex: quando o usuário volta pro computador ou alterna abas)
  window.addEventListener('focus', () => {
    triggerAutoSync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerAutoSync();
    }
  });

  // Intervalo suave em segundo plano para manter dados sincronizados entre múltiplos dispositivos
  setInterval(() => {
    if (!dbStatus.isSyncing) {
      db.syncPendingActions();
    }
  }, 25000);
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
    'notices', 'ticket_sales', 'maintenance', 'driver_logs', 'conductor_logs',
    'dispatcher_logs', 'ticketing_config', 'payroll_rubrics', 'payroll',
    'role_configs', 'notifications', 'shifts', 'daily_schedules', 'time_tracking', 
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
    if (!isSupabaseConfigured) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const { error } = await supabase.from('companies').select('id').limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);

      if (error && isNetworkError(error)) {
        updateStatus({ isOffline: true, lastError: error.message });
        return false;
      }
      updateStatus({ isOffline: false, lastError: null });
      return true;
    } catch (e: any) {
      if (isNetworkError(e)) {
        updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
        return false;
      }
      updateStatus({ isOffline: false, lastError: null });
      return true;
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
          const payload = cleanPayload(item.table, item.payload, true);
          const { error } = await supabase.from(item.table).upsert(payload);
          if (error && isNetworkError(error)) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.recordId);
          if (error && isNetworkError(error)) throw error;
        }

        const idx = remainingQueue.findIndex(q => q.id === item.id);
        if (idx !== -1) remainingQueue.splice(idx, 1);
        syncedCount++;
      } catch (err: any) {
        if (isNetworkError(err)) {
          updateStatus({ isOffline: true, lastError: err?.message || 'Erro de rede' });
          saveSyncQueue(remainingQueue);
          updateStatus({ isSyncing: false });
          return { success: false, syncedCount };
        } else {
          const idx = remainingQueue.findIndex(q => q.id === item.id);
          if (idx !== -1) remainingQueue.splice(idx, 1);
        }
      }
    }

    saveSyncQueue(remainingQueue);
    updateStatus({ isSyncing: false, isOffline: false, lastSyncAt: Date.now(), lastError: null });
    return { success: true, syncedCount };
  },

  // BUSCA UNIVERSAL NA NUVEM (Com Isolamento por Chave/Tenant e Janela do Passageiro Aberta)
  fetchAll: async <T>(table: TableName, options?: { bypassSystemId?: boolean; filterSystemId?: string }): Promise<T[]> => {
    try {
      let query = supabase.from(table).select('*');
      
      const isPublicPassenger = PUBLIC_PASSENGER_TABLES.includes(table);
      const activeSysId = options?.filterSystemId || currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;

      // Regra 2: Janela do Passageiro (Acesso Aberto)
      // As tabelas de rotas (routes), itinerários (itineraries), paragens (bus_stations) e cidades (cities)
      // devem permanecer totalmente acessíveis e públicas para consulta livre por parte dos passageiros.
      if (options?.bypassSystemId || (isPublicPassenger && !currentSystemId && !options?.filterSystemId)) {
        // Consulta aberta irrestrita
      } else if (table === 'activation_keys' && options?.bypassSystemId) {
        // Chaves de ativação podem ser consultadas globalmente para validação
      } else if (table === 'users' && !currentSystemId && !options?.filterSystemId) {
        // Tela de login inicial buscando credenciais
      } else if (activeSysId && !options?.bypassSystemId) {
        if (isPublicPassenger || table === 'companies' || table === 'system_settings') {
          // No painel interno de gestão, operador consulta sua rede + rotas/cidades gerais
          query = query.or(`system_id.eq.${activeSysId},system_id.is.null`);
        } else {
          // Regra 1: Isolamento estrito por system_id da organização
          query = query.or(`system_id.eq.${activeSysId},system_id.is.null`);
        }
      } else if (!activeSysId && !isPublicPassenger && table !== 'users' && table !== 'companies' && table !== 'system_settings') {
        // Visitante não autenticado não deve ver dados corporativos privados
        return [];
      }

      const { data, error } = await query;

      if (error) {
        if (isNetworkError(error)) {
          updateStatus({ isOffline: true, lastError: error.message });
        }
        
        // Se a consulta no PostgreSQL do Supabase falhar, recupera imediatamente da nuvem do Supabase Storage
        const cloudData = await fetchTableFromCloudStorage<T>(table);
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
          setLocalData(table, cloudData);
          updateStatus({ isOffline: false, lastError: null });
          return cloudData;
        }

        return getLocalData<T>(table);
      }

      updateStatus({ isOffline: false, lastError: null });
      if (data && Array.isArray(data)) {
        const enriched = data.map((item: any) => {
          if (table === 'system_settings' && item?.value) {
            try {
              const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
              if (parsed && typeof parsed === 'object') {
                return { ...item, ...parsed };
              }
            } catch {}
          }
          if (table === 'imp_cards' && item?.ai_art_url && typeof item.ai_art_url === 'string' && item.ai_art_url.startsWith('abbr:')) {
            return {
              ...item,
              abbreviation: item.ai_art_url.replace('abbr:', '')
            };
          }
          if (table === 'routes' && Array.isArray(item?.sections)) {
            const meta = item.sections.find((s: any) => s && s.__route_meta__);
            if (meta) {
              return {
                ...item,
                empresa_autuante: item.empresa_autuante || meta.empresa_autuante,
                empresa_autuante_id: item.empresa_autuante_id || meta.empresa_autuante_id
              };
            }
          }
          if (table === 'companies') {
            return {
              ...item,
              city: item.city || item.cidade || item.address_city,
              state: item.state || item.uf || item.address_state,
              trade_name: item.trade_name || item.nome_fantasia,
              corporate_name: item.corporate_name || item.razao_social
            };
          }
          return item;
        });

        // Se system_settings não retornou com filtro específico, tenta recuperar configuração global do Supabase
        if (enriched.length === 0 && table === 'system_settings') {
          const { data: globalSettings } = await supabase.from('system_settings').select('*').limit(1);
          if (globalSettings && globalSettings.length > 0) {
            const raw = globalSettings[0];
            let parsedVal: any = {};
            try {
              if (raw.value) parsedVal = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
            } catch {}
            const fallbackItem = [{ ...raw, ...parsedVal }] as T[];
            setLocalData(table, fallbackItem);
            return fallbackItem;
          }
        }

        // Persistência local atua estritamente como espelho do banco de dados em nuvem
        setLocalData(table, enriched);
        return enriched as T[];
      }

      return [];
    } catch (e: any) {
      if (isNetworkError(e)) {
        updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
        return getLocalData<T>(table);
      }
      const cloudData = await fetchTableFromCloudStorage<T>(table).catch(() => null);
      if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
        setLocalData(table, cloudData);
        return cloudData;
      }
      return getLocalData<T>(table);
    }
  },

  fetchAllGlobal: async <T>(table: TableName): Promise<T[]> => {
    return db.fetchAll<T>(table, { bypassSystemId: true });
  },

  clearLocalCache: () => {
    try {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('vialivre_db_') || key.startsWith('vialivre_deleted_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch {}
  },

  // CRIAÇÃO DIRETA NA NUVEM COM SUPORTE A RECURSÃO RLS
  create: async <T extends { id?: string; system_id?: string }>(table: TableName, item: Partial<T>): Promise<T | null> => {
    const payload = cleanPayload(table, item, false);
    
    // Geração de ID seguro: shifts e role_configs utilizam identificador gerado pelo banco
    if (table === 'role_configs' || table === 'shifts') {
      delete payload.id;
    } else if (!payload.id || !isValidUUID(payload.id)) {
      if (table !== 'system_settings') {
        payload.id = generateUUID();
      }
    }
    
    // Vinculação obrigatória ao system_id ativo da organização do Administrador Raiz
    const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
    if (!payload.system_id || payload.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb' || payload.system_id === 'sys-vialivre-default' || payload.system_id === 'default-sys') {
      payload.system_id = activeSys;
    }

    if (payload.id) {
      removeDeletedId(table, String(payload.id));
    }

    try {
      let currentPayload = { ...payload };
      let finalItem: any = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const { data, error } = await supabase.from(table).insert(currentPayload).select();
          if (!error && data && data.length > 0) {
            finalItem = data[0];
            break;
          }

          lastError = error;
          if (!error) break;

          // Se erro de chave duplicada (23505), atualiza o registro existente
          if (error.code === '23505' && currentPayload.id) {
            const { data: uData, error: uErr } = await supabase.from(table).update(currentPayload).eq('id', currentPayload.id).select();
            if (!uErr && uData && uData.length > 0) {
              finalItem = uData[0];
              break;
            }
          }

          // 1. Coluna não existe no cache de schema do PostgreSQL
          const colMatch = (error.message || '').match(/Could not find the '([^']+)' column/i);
          if (colMatch && colMatch[1]) {
            console.warn(`[SUPABASE_AUTO_HEAL] Removendo coluna desconhecida '${colMatch[1]}' na tabela ${table}`);
            delete currentPayload[colMatch[1]];
            continue;
          }

          // 2. Violação de restrição not-null
          const nullMatch = (error.message || '').match(/null value in column \"([^\"]+)\"/i);
          if (nullMatch && nullMatch[1]) {
            const missingCol = nullMatch[1];
            console.warn(`[SUPABASE_AUTO_HEAL] Preenchendo valor padrão para coluna obrigatória '${missingCol}' na tabela ${table}`);
            if (missingCol === 'chassis') currentPayload[missingCol] = '9BW' + Math.random().toString(36).substring(2, 10).toUpperCase() + '0001';
            else if (missingCol === 'cnh_number') currentPayload[missingCol] = '00000000000';
            else if (missingCol === 'cnh_category') currentPayload[missingCol] = 'D';
            else if (missingCol === 'cnh_expiration') currentPayload[missingCol] = '2029-12-31';
            else if (missingCol === 'cpf') currentPayload[missingCol] = '00000000000';
            else if (missingCol === 'departure_time') currentPayload[missingCol] = '08:00';
            else if (missingCol === 'name' || missingCol === 'full_name') currentPayload[missingCol] = 'Registro';
            else if (missingCol === 'state') currentPayload[missingCol] = 'SP';
            else if (missingCol === 'date') currentPayload[missingCol] = new Date().toISOString().substring(0, 10);
            else currentPayload[missingCol] = 'Padrao';
            continue;
          }

          break;
        } catch (attemptErr: any) {
          lastError = attemptErr;
          break;
        }
      }

      if (!finalItem && lastError) {
        console.error(`[SUPABASE_INSERT_ERROR] Erro ao cadastrar na tabela '${table}' no Supabase:`, {
          code: lastError.code,
          message: lastError.message,
          details: lastError.details,
          hint: lastError.hint,
          payload: currentPayload
        });

        // Alerta visual no console e toast para diagnóstico imediato
        dispatchSystemToast(`Erro ao salvar no banco de dados (${table}): ${lastError.message || lastError.code || 'Falha de permissão RLS'}`, 'error');

        // Se for erro de rede offline, salva no cache local e fila
        if (isNetworkError(lastError)) {
          const localList = getLocalData<any>(table);
          const updatedList = [currentPayload, ...localList.filter((x: any) => x.id !== currentPayload.id)];
          setLocalData(table, updatedList);
          await syncTableToCloudStorage(table, updatedList);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: currentPayload } }));
          }
          return currentPayload as T;
        }

        // Falha real do Supabase: lança o erro para impedir que o sistema finja ter persistido na nuvem
        throw new Error(`[Supabase ${table}] ${lastError.message || 'Falha ao gravar no Supabase'}`);
      }

      const savedResult = finalItem || payload;
      const localList = getLocalData<any>(table);
      const updatedList = [savedResult, ...localList.filter((x: any) => x.id !== (savedResult as any).id)];
      setLocalData(table, updatedList);
      syncTableToCloudStorage(table, updatedList).catch(() => {});
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: savedResult } }));
      }
      
      return savedResult as T;
    } catch (e: any) {
      console.error(`[SUPABASE_CREATE_EXCEPTION] Falha ao cadastrar na tabela ${table}:`, e);
      if (!isNetworkError(e)) {
        throw e;
      }
      const localList = getLocalData<any>(table);
      const updatedList = [payload, ...localList.filter((x: any) => x.id !== payload.id)];
      setLocalData(table, updatedList);
      await syncTableToCloudStorage(table, updatedList);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: payload } }));
      }
      return payload as T;
    }
  },

  // ATUALIZAÇÃO DIRETA NA NUVEM
  update: async <T extends { id: string; system_id?: string }>(table: TableName, item: T): Promise<T | null> => {
    const payload = cleanPayload(table, item, true);
    
    if (item.id) {
      removeDeletedId(table, item.id);
    }

    // Vinculação ao system_id se não presente
    const activeSys = currentSystemId || getStoredSystemId() || DEFAULT_SYSTEM_UUID;
    if (!payload.system_id || payload.system_id === '43e370b2-2c60-cf5f-7886-e111e8213ffb' || payload.system_id === 'sys-vialivre-default') {
      payload.system_id = activeSys;
    }

    // EXCLUSÃO AUTOMÁTICA DA CHAVE ANTIGA AO TROCAR A CHAVE DE ACESSO DE UM ADMINISTRADOR
    if (table === 'users' && (payload.activation_key || (item as any).activation_key)) {
      try {
        const newKey = String(payload.activation_key || (item as any).activation_key || '').trim();
        const { data: existingUser } = await supabase.from('users').select('activation_key, role, is_full_admin').eq('id', item.id).maybeSingle();
        if (existingUser && existingUser.activation_key) {
          const oldKey = String(existingUser.activation_key).trim();
          if (oldKey && oldKey.toUpperCase() !== newKey.toUpperCase()) {
            console.log(`[ADMIN_KEY_CHANGE] Detectada troca de chave de acesso do administrador: '${oldKey}' -> '${newKey}'. Excluindo chave antiga automaticamente...`);
            await db.deleteActivationKeyByCode(oldKey);
          }
        }
      } catch (keyEx) {
        console.warn('[ADMIN_KEY_CHANGE_WARN] Falha ao verificar/excluir chave antiga:', keyEx);
      }
    }

    try {
      let currentPayload = { ...payload };
      let finalItem: any = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase.from(table).update(currentPayload).eq('id', item.id).select();
        if (!error && data && data.length > 0) {
          finalItem = data[0];
          break;
        }

        lastError = error;
        if (!error) break;

        const colMatch = (error.message || '').match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1]) {
          console.warn(`[SUPABASE_AUTO_HEAL_UPDATE] Removendo coluna '${colMatch[1]}' na tabela ${table}`);
          delete currentPayload[colMatch[1]];
          continue;
        }
        break;
      }

      if (!finalItem && lastError) {
        console.error(`[SUPABASE_UPDATE_ERROR] Erro ao atualizar na tabela '${table}' no Supabase:`, {
          code: lastError.code,
          message: lastError.message,
          details: lastError.details,
          hint: lastError.hint,
          payload: currentPayload
        });

        dispatchSystemToast(`Erro ao atualizar no banco (${table}): ${lastError.message || lastError.code || 'Falha RLS'}`, 'error');

        if (isNetworkError(lastError)) {
          const localList = getLocalData<any>(table);
          const idx = localList.findIndex((x: any) => x.id === item.id);
          if (idx !== -1) localList[idx] = { ...localList[idx], ...payload };
          else localList.push(payload);
          setLocalData(table, localList);
          await syncTableToCloudStorage(table, localList);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: payload } }));
          }
          return item;
        }

        throw new Error(`[Supabase ${table}] ${lastError.message || 'Falha ao atualizar no Supabase'}`);
      }

      const updatedItem = (finalItem || payload || item) as T;
      const localList = getLocalData<any>(table);
      const idx = localList.findIndex((x: any) => x.id === item.id);
      if (idx !== -1) localList[idx] = updatedItem;
      else localList.push(updatedItem);
      setLocalData(table, localList);
      syncTableToCloudStorage(table, localList).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: updatedItem } }));
      }

      return updatedItem as T;
    } catch (e: any) {
      console.error(`[SUPABASE_UPDATE_EXCEPTION] Falha ao atualizar na tabela ${table}:`, e);
      if (!isNetworkError(e)) {
        throw e;
      }
      const localList = getLocalData<any>(table);
      const idx = localList.findIndex((x: any) => x.id === item.id);
      if (idx !== -1) localList[idx] = { ...localList[idx], ...payload };
      else localList.push(payload);
      setLocalData(table, localList);
      await syncTableToCloudStorage(table, localList);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: payload } }));
      }
      return item;
    }
  },

  // EXCLUSÃO DIRETA NA NUVEM
  delete: async (table: TableName, id: string): Promise<boolean> => {
    if (!id || typeof id !== 'string' || (id as any).nativeEvent || (id as any).target) {
      console.error(`db.delete called with invalid id for table ${table}:`, id);
      return false;
    }

    addDeletedId(table, id);

    const localList = getLocalData<any>(table);
    const updatedList = localList.filter((x: any) => x && x.id !== id);
    setLocalData(table, updatedList);
    syncTableToCloudStorage(table, updatedList).catch(() => {});

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.error(`[SUPABASE_DELETE_ERROR] Erro ao excluir na tabela ${table} no Supabase:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          id
        });
        if (!isNetworkError(error)) {
          dispatchSystemToast(`Erro ao excluir na tabela ${table}: ${error.message || error.code}`, 'error');
        }
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'delete', id } }));
      }
      return true;
    } catch (e: any) {
      console.error(`[SUPABASE_DELETE_EXCEPTION] Erro ao excluir na tabela ${table}:`, e);
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
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return true;
    } catch (error) {
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
        } catch (err) {
          // ignore parse errors on keepalive ping
        }
      };
      sse.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch (e) {
      console.warn('[Realtime] Failed to connect SSE:', e);
    }

    // Direct Supabase Realtime Subscription
    let supabaseChannel: any = null;
    try {
      supabaseChannel = supabase
        .channel('vialivre-realtime-all')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
          if (payload && payload.table) {
            onEvent(payload.table, payload);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[Realtime] Failed to subscribe to Supabase channel:', e);
    }

    // Mobile Synchronization Broadcast Channel for ViaLivre Mobile
    let mobileBroadcastChannel: any = null;
    try {
      mobileBroadcastChannel = supabase
        .channel('vialivre-mobile-sync')
        .on('broadcast', { event: 'vialivre_mobile_event' }, (payload: any) => {
          if (payload?.payload?.table) {
            onEvent(payload.payload.table, payload.payload);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[Realtime] Falha ao assinar canal mobile broadcast:', e);
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
        if (supabaseChannel) {
          try { supabase.removeChannel(supabaseChannel); } catch {}
        }
        if (mobileBroadcastChannel) {
          try { supabase.removeChannel(mobileBroadcastChannel); } catch {}
        }
        window.removeEventListener('vialivre-data-changed', localDataHandler);
      }
    };
  },

  subscribeTable: (table: TableName, onEvent: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void): { unsubscribe: () => void } => {
    try {
      const channelId = `rt-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (p: any) => {
          onEvent({
            eventType: p.eventType as any,
            new: p.new,
            old: p.old
          });
        })
        .subscribe();
      return {
        unsubscribe: () => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            channel.unsubscribe();
          }
        }
      };
    } catch (e) {
      console.warn(`Erro ao assinar Realtime para ${table}:`, e);
      return { unsubscribe: () => {} };
    }
  },

  subscribeTables: (tables: TableName[], onEvent: (table: TableName, payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void): { unsubscribe: () => void } => {
    const subs = tables.map(tbl => db.subscribeTable(tbl, (p) => onEvent(tbl, p)));
    return {
      unsubscribe: () => {
        subs.forEach(s => s.unsubscribe());
      }
    };
  },

  // MÉTODOS DE CONSULTA (Compatibilidade Direta e Aliases getAll...)
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
      console.log(`[DATABASE] Excluindo chave antiga de ativação: ${cleanKey}`);
      const { error } = await supabase
        .from('activation_keys')
        .delete()
        .ilike('key_code', cleanKey);
      
      if (error) {
        console.error('[SUPABASE_DELETE_KEY_ERROR] Erro ao excluir chave antiga no Supabase:', {
          code: error.code,
          message: error.message,
          details: error.details,
          keyCode: cleanKey
        });
      } else {
        console.log(`[SUPABASE] Chave antiga '${cleanKey}' excluída com sucesso do banco de dados.`);
      }

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
      let query = supabase.from('time_tracking').select('*');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) {
        setLocalData('time_tracking', data);
        // Sincronizar cache seguro no IndexedDB
        pontoIndexedDB.cacheTimeEntries(data as TimeEntry[]).catch(() => {});
        return data as TimeEntry[];
      }
    } catch (err) {
      console.warn('Falha na busca de ponto remoto:', err);
    }
    // Tenta IndexedDB primeiro, depois localStorage
    try {
      const idbEntries = await pontoIndexedDB.getCachedTimeEntries(userId);
      if (idbEntries.length > 0) return idbEntries;
    } catch {}
    const local = getLocalData<TimeEntry>('time_tracking');
    return userId ? local.filter(e => (e as any).user_id === userId) : local;
  },

  saveTimeEntry: async (entry: Partial<TimeEntry>): Promise<TimeEntry | null> => {
    return db.create<TimeEntry>('time_tracking', entry);
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase.from('users').select('*').or(`id.eq.${userId},email.eq.${userId}`).maybeSingle();
      if (!error && data) return data as User;
    } catch (e) {
      console.warn('Erro ao carregar perfil do Supabase:', e);
    }
    const localUsers = getLocalData<User>('users');
    return localUsers.find(u => u.id === userId || (u as any).email === userId) || null;
  },

  updateUserProfile: async (userData: Partial<User> & { id: string }): Promise<User | null> => {
    return db.update<User>('users', userData as User);
  },

  // SINCRONIZAÇÃO COM O PROJETO VIALIVRE MOBILE
  getMobileSyncConfig: () => {
    let resolvedUrl = SAFE_DEFAULT_SB_URL;
    let resolvedKey = SAFE_DEFAULT_SB_KEY;
    try {
      if (typeof getCleanSupabaseConfig === 'function') {
        const conf = getCleanSupabaseConfig();
        if (conf?.supabaseUrl) resolvedUrl = conf.supabaseUrl;
        if (conf?.supabaseAnonKey) resolvedKey = conf.supabaseAnonKey;
      } else if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) {
        resolvedUrl = SUPABASE_URL;
        resolvedKey = SUPABASE_ANON_KEY;
      }
    } catch (e) {
      console.warn('[MobileSync] Fallback para credenciais padrão:', e);
    }
    const activeSysId = currentSystemId || getStoredSystemId() || 'sys-vialivre-default';
    return {
      appName: 'ViaLivre Gestão & Mobile Gateway',
      mobileAppTarget: 'ViaLivre Mobile',
      version: '1.5.0',
      supabaseUrl: resolvedUrl,
      supabaseAnonKey: resolvedKey,
      systemId: activeSysId,
      apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      realtimeChannels: [
        'public:trips',
        'public:routes',
        'public:bus_stations',
        'public:notices',
        'public:imp_cards',
        'public:imp_card_recharges',
        'public:tickets',
        'public:daily_logs',
        'public:occurrences'
      ],
      publicPassengerTables: PUBLIC_PASSENGER_TABLES,
      timestamp: Date.now()
    };
  },

  syncWithMobile: async (): Promise<{ success: boolean; syncedCount: number; message: string }> => {
    try {
      // 1. Sincroniza fila de pendências offline com Supabase
      const localResult = await db.syncPendingActions();

      // 2. Dispara broadcast em tempo real para dispositivos ViaLivre Mobile conectados
      try {
        const syncChannel = supabase.channel('vialivre-mobile-sync');
        await syncChannel.subscribe();
        await syncChannel.send({
          type: 'broadcast',
          event: 'vialivre_mobile_event',
          payload: {
            type: 'SYNC_TRIGGER',
            origin: 'vialivre_gestao',
            system_id: currentSystemId || getStoredSystemId(),
            timestamp: Date.now()
          }
        });
        setTimeout(() => {
          try { supabase.removeChannel(syncChannel); } catch {}
        }, 1200);
      } catch (e) {
        console.warn('[Mobile Sync] Broadcast para ViaLivre Mobile:', e);
      }

      // 3. Atualiza timestamps locais e dispara recarregamento de interface
      if (typeof window !== 'undefined') {
        localStorage.setItem('fluxo_session_sync_timestamp', String(Date.now()));
        window.dispatchEvent(new CustomEvent('vialivre-sync-timestamp-updated'));
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        window.dispatchEvent(new CustomEvent('vialivre-mobile-sync-event', {
          detail: { type: 'MANUAL_SYNC', timestamp: Date.now() }
        }));
      }

      return {
        success: true,
        syncedCount: localResult.syncedCount,
        message: 'Sincronização bidirecional com ViaLivre Mobile executada com sucesso!'
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