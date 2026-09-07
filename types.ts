
export enum RouteStatus {
  ACTIVE = 'Ativa',
  INACTIVE = 'Inativa',
  PLANNING = 'Planejamento',
  MAINTENANCE = 'Manutenção'
}

export type ThemeMode = 'light' | 'dark';
export type VehicleClass = 'CONVENCIONAL' | 'CONVENCIONAL_DD' | 'EXECUTIVO' | 'EXECUTIVO_DD' | 'LEITO' | 'LEITO_DD' | 'SEMI_LEITO' | 'SEMI_LEITO_DD' | 'URBANO' | 'CAMA';
export type LedColor = 'AMBAR' | 'BRANCO' | 'VERDE';

export interface PassengerDetails {
  pagantes: number;
  vale_transporte: number;
  imp_card: number;
  gratuitos: number;
}

export type TripStatus = 'Agendada' | 'Em Rota' | 'Em Andamento' | 'Atrasada' | 'Concluída' | 'Cancelada';

export interface Trip {
  id: string;
  system_id?: string;
  route_id: string;
  trip_type?: 'Urbano' | 'Rodoviário';
  driver_id: string;
  driver_name: string;
  fiscal_id?: string;
  fiscal_name?: string;
  conductor_id?: string;
  conductor_name?: string;
  bus_number: string;
  departure_time: string;
  arrival_time_planned?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  trip_date: string;
  status: TripStatus;
  direction?: 'IDA' | 'VOLTA';
  passengers: { [key: string]: PassengerDetails };
  occupied_seats?: number; 
  finished?: boolean;
  user_id?: string;
  initial_turnstile?: number;
  final_turnstile?: number;
  initial_odometer?: number;
  final_odometer?: number;
  fuel_level?: 'RESERVA' | '1/4' | '1/2' | '3/4' | 'CHEIO';
  checklist_ok?: boolean;
  cash_total?: number;
  card_pix_total?: number;
  gratuity_total?: number;
  payment_breakdown?: { [method: string]: number };
  payment_counts?: { [method: string]: number };
  ticket_number?: string;
  initial_ticket_number?: string;
  final_ticket_number?: string;
  current_section_index?: number;
  occupied_seats_list?: number[];
  initial_checkin_done?: boolean;
  final_checkin_done?: boolean;
  created_at?: string;
}

export interface RouteSection {
  name: string;
  origin: string;
  destination: string;
  price: number;
  toll?: number;
  boarding_fee?: number;
  letreiro_texto?: string;
  letreiro_modo?: 'FIXO' | 'ROLANTE';
  letreiro_cor?: LedColor;
  letreiro_velocidade?: number;
}

export interface BusStation {
  id: string;
  system_id?: string;
  name: string;
  address: string;
  platforms: string;
  is_active?: boolean;
  created_at?: string;
}

export interface BusRoute {
  id: string;
  system_id?: string;
  company_id: string;
  prefixo_linha: string;
  code?: string;
  name?: string;
  city?: string;
  origin: string;
  destination: string;
  origin_station_id?: string;
  destination_station_id?: string;
  origin_station_platform?: string;
  destination_station_platform?: string;
  departure_point?: string;
  price: number;
  toll?: number;
  boarding_fee?: number;
  fees?: number;
  duration_minutes: number;
  status: RouteStatus;
  distance_km?: number;
  sections?: RouteSection[];
  stops: string[];
  schedule: {
    weekdays: { time: string; direction: 'IDA' | 'VOLTA'; section_name?: string; legend_symbol?: string; legend_text?: string }[];
    saturday: { time: string; direction: 'IDA' | 'VOLTA'; section_name?: string; legend_symbol?: string; legend_text?: string }[];
    sunday: { time: string; direction: 'IDA' | 'VOLTA'; section_name?: string; legend_symbol?: string; legend_text?: string }[];
  };
  letreiro_principal: string;
  letreiro_principal_modo: 'FIXO' | 'ROLANTE';
  letreiro_principal_cor: LedColor;
  letreiro_principal_velocidade: number;
  via1?: string;
  via1_modo: 'FIXO' | 'ROLANTE';
  via1_cor?: LedColor;
  via2?: string;
  via2_modo: 'FIXO' | 'ROLANTE';
  via2_cor?: LedColor;
  via3?: string;
  via3_modo: 'FIXO' | 'ROLANTE';
  via3_cor?: LedColor;
  lightdot_code: string;
  route_type?: 'URBANO' | 'RODOVIARIA' | 'INTERMUNICIPAL';
  payment_type?: 'QUALQUER_UM' | 'RODOVIARIO_APENAS' | 'URBANO_APENAS';
  payment_methods_accepted?: string[];
  estimated_travel_time_text?: string;
  service_class?: string;
  exibir_codigo_letreiro?: boolean;
  letreiro_cor_preview?: 'AMBAR' | 'BRANCO';
}

export interface Occurrence {
  id: string;
  system_id?: string;
  user_id: string;
  type: 'ADVERTENCIA' | 'ATESTADO' | 'FALTA' | 'ATRASO' | 'SUSPENSAO' | 'OUTROS';
  date: string;
  description: string;
  hours_lost?: string; // For delays
  is_justified?: boolean;
  created_at: string;
}

export type Route = BusRoute;
export type OccurrenceReport = Occurrence;

export interface User {
  id: string;
  system_id?: string;
  full_name?: string;
  name?: string;
  role: UserRole;
  email?: string;
  login_acesso?: string;
  senha_acesso?: string;
  phone?: string;
  photo_url?: string; 
  avatar_url?: string;
  cpf?: string;
  pis?: string;
  registration_id?: string;
  unidade?: string;
  blood_type?: string;
  birth_date?: string;
  admission_date?: string;
  resignation_date?: string;
  work_municipality_id?: string;
  license_type?: string;
  license_validity?: string;
  cep?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  job_title?: string;
  work_shift_type?: '6x1' | '5x1' | '5x2' | '12x36';
  company_id?: string;
  daily_hours_target?: string;
  standard_clock_in?: string;
  standard_clock_out?: string;
  standard_interval?: string;
  saturday_clock_in?: string;
  saturday_clock_out?: string;
  saturday_interval?: string;
  sunday_clock_in?: string;
  sunday_clock_out?: string;
  sunday_interval?: string;
  notification_preferences?: {
    schedule?: boolean;
    delay?: boolean;
    maintenance?: boolean;
    inspection?: boolean;
    occurrence?: boolean;
    ticketing?: boolean;
  };
  permissions?: ViewState[];
  is_full_admin?: boolean;
  activation_key?: string;
  cnh_limit?: number;
  occurrences?: Occurrence[];
  status?: 'ACTIVE' | 'INACTIVE' | string;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'ADMIN' | 'DRIVER' | 'RH' | 'MECHANIC' | 'FISCAL' | 'TICKET_AGENT' | 'CONDUCTOR' | 'PASSENGER';

export interface RoleConfig {
  id: string;
  system_id?: string;
  name: string;
  base_role: UserRole;
  base_salary: number;
  standard_shift: string;
  permissions: ViewState[];
  access_sales?: boolean;
  access_driver_guide?: boolean;
  access_global_management?: boolean;
  access_monitoring?: boolean;
}

export interface DriverLog {
  id: string;
  system_id?: string;
  driver_id: string;
  vehicle_id: string;
  log_type: 'INITIAL' | 'FINAL';
  odometer_start: number;
  odometer_end: number;
  damage_reported: boolean;
  notes: string;
  created_at: string;
  start_time?: string;
  end_time?: string;
  fuel_level_start?: string;
  tire_condition_ok?: boolean;
  lights_condition_ok?: boolean;
  documents_ok?: boolean;
  trip_occurrences?: string;
  internal_cleaning_ok?: boolean;
  damage_details?: string;
  oil_water_ok?: boolean;
  toll_expenses?: number;
}

export interface AppNotification {
  id: string;
  system_id?: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: 'SCHEDULE' | 'DELAY' | 'MAINTENANCE' | 'ROUTE' | 'SYSTEM' | 'TICKETING' | 'OCCURRENCE' | 'TIME_TRACKING';
  target_role?: string;
  is_read: boolean;
  created_at: string;
  link?: ViewState;
  metadata?: any;
}

export type ViewState = 'dashboard' | 'routes' | 'schedule' | 'drivers' | 'companies' | 'users' | 'vehicles' | 'observations' | 'cities' | 'notices' | 'reports-view' | 'maintenance' | 'ticketing' | 'inspections' | 'ticketing-config' | 'time-tracking' | 'payroll' | 'management' | 'shifts' | 'notifications' | 'dispatcher' | 'sac' | 'work-with-us' | 'recruitment' | 'about' | 'skins' | 'subscriptions' | 'license-management' | 'my-subscription' | 'system-config' | 'driver-view' | 'passenger-view' | 'driver-urban' | 'driver-road' | 'conductor' | 'operation-center' | 'monitoring' | 'bus-stations';

export interface ActivationKey {
  id: string;
  system_id?: string;
  key_code: string;
  plan_type: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'LIFETIME' | 'TRIAL';
  price: number;
  duration_months: number;
  duration_type?: 'MONTHS' | 'DAYS';
  duration_days?: number;
  is_used: boolean;
  activated_at?: string;
  expires_at?: string;
  activated_by_system_id?: string;
  activated_by_user_id?: string;
  activated_by_name?: string;
  owner_email?: string;
  company_name?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  system_id: string;
  plan_type: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'LIFETIME' | 'TRIAL';
  activated_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELED';
  created_at: string;
  key_code?: string;
  key_id?: string;
  activated_by_name?: string;
  activated_by_user_id?: string;
  owner_email?: string;
  company_name?: string;
}

export interface Notice {
  id: string;
  system_id?: string;
  title: string;
  content: string;
  category: string;
  protocol?: string;
  is_active: boolean;
  target_role?: string; // 'ALL', 'DRIVER', 'PASSENGER', etc.
  attachment_info?: string;
  created_at?: string;
  start_date?: string;
  end_date?: string;
}

export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  role: string;
  created_at: string;
}

export interface City {
  id: string;
  system_id?: string;
  name: string; 
  state: string;
  code: number; 
}

export interface Company {
  id: string;
  system_id?: string;
  name: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  active: boolean;
  contact_email: string;
  contact_phone: string;
  logo_url?: string;
  cep?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_complement?: string;
}

export interface TicketBooth {
  id: string;
  system_id?: string;
  company_id: string;
  bus_station_id?: string;
  station_name?: string;
  name: string;
  cnpj: string;
  ie?: string;
  cep?: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_complement?: string;
  phone: string;
  email: string;
  booth_manager?: string;
  active: boolean;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  system_id?: string;
  prefix: string; 
  plate: string;
  model: string; 
  chassis: string; 
  company_name: string; 
  base_city: string; 
  vehicle_type: string; 
  type?: string;
  bus_number?: string;
  vehicle_class: VehicleClass;
  is_accessible: boolean; 
  status: 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
  year_fab: string;
  last_inspection: string;
  company_id?: string;
  capacity?: number;
  skin_id?: string;
  current_turnstile_count?: number;
  route_id?: string;
  default_route_id?: string;
}

export interface DriverGuide {
  id: string;
  trip_id: string;
  driver_id: string;
  driver_name: string;
  date: string;
  departure_time: string;
  arrival_time?: string;
  vehicle_number: string;
  paying_passengers: number;
  free_passengers: number;
  initial_turnstile?: number;
  final_turnstile?: number;
  observations: string;
  has_damage: boolean;
  damage_type?: 'CARROCERIA' | 'INTERNO' | 'CADEIRANTE' | 'OUTROS';
  created_at: string;
}

export interface TicketSale {
  id: string;
  system_id?: string;
  trip_id: string;
  seat_number: number;
  passenger_name: string;
  passenger_cpf: string;
  passenger_birth: string;
  passenger_phone: string;
  passenger_email: string;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  payment_method: 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'IMPCARD' | 'PIX' | 'VALE_TRANSPORTE' | 'VALE TRANSPORTE';
  coupon_applied?: string;
  total_price: number;
  price_base?: number;
  price_toll?: number;
  price_boarding_fee?: number;
  price_fees?: number;
  discount_value?: number;
  vehicle_model?: string;
  vehicle_prefix?: string;
  company_data?: {
    name: string;
    cnpj: string;
    ie?: string;
    address: string;
    address_street?: string;
    address_number?: string;
    address_city?: string;
    address_state?: string;
  };
  status?: 'booked' | 'boarded' | 'disembarked' | 'canceled';
  section_origin?: string;
  section_destination?: string;
  is_presale?: boolean;
  route_id?: string;
  trip_date?: string;
  departure_time?: string;
  direction?: 'IDA' | 'VOLTA';
  created_at: string;
  responsible_name?: string;
  responsible_birth?: string;
  relationship?: string;
  seller_name?: string;
  sold_by?: string;
  booth_id?: string;
  route_data?: any;
  trip_data?: any;
  origin_name?: string;
  destination_name?: string;
  passenger_document?: string;
  booth_data?: {
    name: string;
    cnpj: string;
    address: string;
    phone: string;
  };
  // Joins
  routes?: { origin: string; destination: string; name: string };
  trips?: { departure_time: string; bus_number: string };
  users?: { full_name: string };
}

export interface IssueReport {
  id: string;
  system_id?: string;
  trip_id: string;
  type: string;
  occurrence_type?: string; 
  description: string;
  category: 'MECANICA' | 'TRANSITO' | 'PASSAGEIRO' | 'LIMPEZA' | 'OUTROS';
  severity: 'BAIXA' | 'MEDIA' | 'ALTA';
  status: 'ABERTA' | 'Concluído' | 'Precisa-se de manutenção' | 'Em manutenção';
  suggested_action: string;
  technician_report?: string;
  estimated_cost_web?: number;
  timestamp: string;
  vehicle_id?: string;
  driver_id?: string;
}

export interface Inspection {
  id: string;
  system_id?: string;
  vehicle_id: string;
  inspector_id: string;
  date: string;
  location: string;
  agency: string;
  status: 'APROVADO' | 'REPROVADO' | 'RESTRICAO';
  checklist: {
    pneus: boolean;
    freios: boolean;
    luzes: boolean;
    limpeza: boolean;
    documentos: boolean;
    ar_condicionado: boolean;
  };
  notes?: string;
}

export interface PaymentMethodConfig {
  id: string;
  label: string;
  is_road_only: boolean;
}

export interface TicketingConfig {
  id: string;
  system_id?: string;
  payment_methods: string[];
  payment_methods_config?: PaymentMethodConfig[];
  credit_installments: number;
  credit_surcharge: number;
  min_installment_value: number;
  boarding_box: string;
  active_coupons: { code: string, numeric_code?: string, discount: number, type: 'FIXED' | 'PERCENT', conditions?: string }[];
  class_seats: { [key: string]: number };
  custom_vehicle_classes?: { id: string, label: string }[];
}

export interface MaintenanceRecord {
  id: string;
  system_id?: string;
  vehicle_id: string;
  description: string;
  cost: number;
  date: string;
  performed_by: string;
  service_type?: 'PREVENTIVA' | 'CORRETIVA' | 'PNEUS' | 'OLEO' | 'ELETRICA' | 'OUTROS';
  ai_parts_identified?: string;
  technical_report?: string;
}

export interface PayrollRubric {
  id: string;
  system_id?: string;
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'INFO';
  description?: string;
  has_conditions?: boolean;
  condition_value?: string;
  condition_symbol?: string;
  condition_base_rubric_id?: string;
}

export interface TimeEntry {
  id: string;
  system_id?: string;
  user_id: string;
  date: string;
  clock_in: string;
  break_start?: string;
  break_end?: string;
  clock_out?: string;
  total_daily_hours?: number;
  notes?: string;
  created_at?: string;
}

export interface PayrollRecord {
  id: string;
  user_id: string;
  month_year: string;
  earnings_total: number;
  deductions_total: number;
  net_value: number;
  items: any[];
  created_at: string;
}

export interface PassengerForm {
    full_name: string;
    cpf: string;
    birth_date: string;
    phone: string;
    email: string;
    cep: string; 
    street: string; 
    number: string; 
    complement: string; 
    neighborhood: string; 
    city: string; 
    state: string;
    seat_number: number;
    responsible_name?: string;
    responsible_birth_date?: string;
    relationship?: string;
}

export interface Driver {
  id: string;
  name: string;
  license_type: 'A' | 'B' | 'C' | 'D' | 'E';
  availability: { [day: string]: { start: string; end: string }[] };
}

export interface Shift {
  id: string;
  system_id?: string;
  driver_id: string;
  route_id: string;
  start_time: string;
  end_time: string;
  date: string;
  scale_type?: string;
  standard_interval?: string;
  saturday_clock_in?: string;
  saturday_clock_out?: string;
  saturday_interval?: string;
  sunday_clock_in?: string;
  sunday_clock_out?: string;
  sunday_interval?: string;
  daily_hours_target?: string;
}

export interface ShiftSwapRequest {
  id: string;
  requester_shift_id: string;
  requested_shift_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SystemSettings {
  id: string;
  system_id?: string;
  registration_pattern: string; // e.g., "FLX-000"
  registration_template?: string; // e.g., "{M}.{Y}.{R}"
  company_name?: string;
  default_route_price?: number;
  default_bus_capacity?: number;
  support_phone?: string;
  support_email?: string;
  system_name?: string;
  system_logo?: string;
  system_url?: string;
  theme_color?: string;
  maintenance_intervals?: { [vehicleType: string]: number };
  high_contrast?: boolean;
  glass_effect?: boolean;
  custom_shortcuts?: { [key: string]: string };
}

export interface Skin {
  id: string;
  system_id?: string;
  company_id: string;
  skin_name: string;
  bus_model: string;
  file_url: string;
  created_at?: string;
}

export type ImpCardType = 'Vale Transporte' | 'Idoso' | 'Escolar' | 'Especial';

export interface UserFine {
  id: string;
  system_id?: string;
  user_id: string;
  vehicle_id?: string;
  trip_id?: string;
  infraction_notice: string; // Auto de Infração
  date_time: string;
  description: string;
  amount: number;
  due_date: string;
  points: number;
  location?: string;
  status: 'PENDENTE' | 'PAGO' | 'RECURSO';
  created_at: string;
}

export interface JobApplication {
  id: string;
  system_id?: string;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  cpf: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_cep: string;
  address_complement?: string;
  desired_position: string;
  experience_summary: string;
  exp1_company?: string;
  exp1_role?: string;
  exp1_admission_date?: string;
  exp1_resignation_date?: string;
  exp1_reason_for_leaving?: string;
  exp1_last_salary?: string;
  exp1_activities?: string;
  exp2_company?: string;
  exp2_role?: string;
  exp2_admission_date?: string;
  exp2_resignation_date?: string;
  exp2_reason_for_leaving?: string;
  exp2_last_salary?: string;
  exp2_activities?: string;
  exp3_company?: string;
  exp3_role?: string;
  exp3_admission_date?: string;
  exp3_resignation_date?: string;
  exp3_reason_for_leaving?: string;
  exp3_last_salary?: string;
  exp3_activities?: string;
  has_cnh: boolean;
  cnh_type?: 'D' | 'E';
  knows_signage?: boolean;
  resume_url?: string;
  photo_url?: string;
  status: 'Triagem' | 'Entrevista' | 'Aprovado' | 'Reprovado';
  is_first_job?: boolean;
  confirmed?: boolean;
  created_at: string;
}

export interface JobVacancy {
  id: string;
  system_id?: string;
  job_title: string;
  requirements: string;
  activities: string;
  benefits: string;
  contact_info: string;
  company_id?: string;
  company_name?: string;
  created_at: string;
  is_active: boolean;
}

export interface ImpCard {
  id: string;
  system_id?: string;
  type: ImpCardType;
  card_number: string;
  photo_url?: string;
  right_logo_url?: string;
  ai_art_url?: string;
  name: string;
  surname: string;
  cpf: string;
  rg: string;
  birth_date: string;
  cep: string;
  address_street: string;
  address_number: string;
  address_complement?: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  phone: string;
  email: string;
  balance: number;
  
  // Escolar specific
  school_photo_3x4_url?: string;
  school_declaration_url?: string;
  school_type?: 'Pública' | 'Privada';
  
  // Especial specific
  cadunico_resumo_url?: string;
  laudo_medico_url?: string;
  exames_complementares_url?: string;
  medico_ficha_preenchida?: boolean;
  pericia_realizada?: boolean;
  beneficio_liberado?: boolean;
  
  // Minor specific (Guardian)
  guardian_name?: string;
  guardian_surname?: string;
  guardian_cpf?: string;
  guardian_rg?: string;
  guardian_birth_date?: string;
  guardian_relationship?: string;
  
  // Passenger buyer & responsible
  is_passenger_buyer?: boolean;
  responsible_name?: string;
  responsible_birth_date?: string;
  relationship?: string;
  
  password?: string;
  created_at: string;
  updated_at?: string;
  occurrences?: Occurrence[];
}

export type ImpCardPaymentMethod = 'BOLETO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'DINHEIRO';

export interface ImpCardRecharge {
  id: string;
  system_id?: string;
  card_id: string;
  amount: number;
  payment_method: ImpCardPaymentMethod;
  created_at: string;
}
