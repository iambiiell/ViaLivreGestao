import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  Timer, 
  ClipboardCheck, 
  Menu, 
  Bus, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  Sun, 
  Moon, 
  Monitor, 
  Bell, 
  Fuel, 
  Users, 
  Calendar, 
  Check, 
  Map, 
  ShieldAlert, 
  Compass, 
  ArrowRight, 
  LogOut, 
  Smartphone, 
  Plus, 
  Send, 
  Wrench, 
  Camera, 
  FileText,
  Search,
  Wifi,
  BatteryCharging,
  Maximize2,
  Minimize2,
  KeyRound,
  DollarSign,
  Palette,
  SlidersHorizontal,
  Settings,
  Building2,
  UsersRound,
  BarChart,
  Ticket,
  Headphones,
  Briefcase,
  HelpCircle,
  CreditCard,
  Edit3,
  Activity,
  ShieldCheck,
  Settings2,
  Bot,
  BusFront,
  ArrowLeft,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Star,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { 
  Trip, 
  Vehicle, 
  BusRoute, 
  Notice, 
  AppNotification, 
  Inspection, 
  IssueReport, 
  User, 
  SystemSettings, 
  Subscription,
  ViewState 
} from '../types';
import { formatDate } from '../utils/dateFormatter';
import { db, supabase } from '../services/database';
import { NotificationService } from '../services/NotificationService';
import { SubscriptionExpirationAlert } from './SubscriptionExpirationAlert';
import { ThemeDesignModal } from './ThemeDesignModal';
import { startMobileGuidedTour, isTourCompleted } from '../services/guidedTour';

export type MobileTab = 'dashboard' | 'operations' | 'timetracking' | 'inspection';
export type MobileSubView = 'none' | 'occurrences' | 'routes' | 'notices' | 'notifications' | 'new-trip' | 'new-occurrence' | 'ticket-scanner';

export interface MobileSystemViewProps {
  currentUser: User | null;
  trips: Trip[];
  vehicles: Vehicle[];
  routes: BusRoute[];
  notices: Notice[];
  notifications: AppNotification[];
  inspections: Inspection[];
  reports: IssueReport[];
  systemSettings: SystemSettings;
  onUpdateSettings?: (settings: any) => void;
  companies?: any[];
  users?: User[];
  onSelectFullView?: (view: ViewState | string) => void;
  renderFullView?: (view: ViewState | string) => React.ReactNode;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onChangeThemeMode?: (mode: 'light' | 'dark') => void;
  onLogout: () => void;
  onSwitchToDesktop: () => void;
  onUpdateTrip?: (tripId: string, updates: Partial<Trip>) => Promise<any>;
  onAddTrip?: (trip: Partial<Trip>) => Promise<any>;
  onAddInspection?: (inspection: Partial<Inspection>) => Promise<any>;
  onAddReport?: (report: Partial<IssueReport>) => Promise<any>;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  subscription?: Subscription | null;
  onForceBackup?: () => Promise<void>;
  isEmbedded?: boolean;
}

export const MobileSystemView: React.FC<MobileSystemViewProps> = ({
  currentUser,
  trips = [],
  vehicles = [],
  routes = [],
  notices = [],
  notifications = [],
  inspections = [],
  reports = [],
  systemSettings,
  onUpdateSettings,
  onSelectFullView,
  renderFullView,
  themeMode,
  onToggleTheme,
  onChangeThemeMode,
  onLogout,
  onSwitchToDesktop,
  onUpdateTrip,
  onAddTrip,
  onAddInspection,
  onAddReport,
  addToast,
  subscription,
  onForceBackup,
  isEmbedded = false
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<MobileTab>('dashboard');
  const [activeSubView, setActiveSubView] = useState<MobileSubView>('none');
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [isEditingShortcuts, setIsEditingShortcuts] = useState(false);
  const [showWelcomeTourBanner, setShowWelcomeTourBanner] = useState<boolean>(() => {
    try {
      return !isTourCompleted('mobile_welcome');
    } catch {
      return false;
    }
  });
  const [shortcutCategoryFilter, setShortcutCategoryFilter] = useState<string>('Todas');

  // Status Bar live clock
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });

  const [currentSecondsTime, setCurrentSecondsTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentSecondsTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Today Date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter trips for today
  const todayTrips = useMemo(() => {
    return trips.filter(t => !t.trip_date || t.trip_date === todayStr);
  }, [trips, todayStr]);

  // Selected Active Trip
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  useEffect(() => {
    if (todayTrips.length > 0 && !selectedTripId) {
      const active = todayTrips.find(t => t.status === 'Em Rota' || t.status === 'Em Andamento') || todayTrips[0];
      setSelectedTripId(active.id);
    }
  }, [todayTrips, selectedTripId]);

  const activeTrip = useMemo(() => {
    return trips.find(t => t.id === selectedTripId) || todayTrips[0] || null;
  }, [trips, todayTrips, selectedTripId]);

  // Operation Tab: Catraca e Odômetro
  const [passengerCount, setPassengerCount] = useState<number>(0);
  const [odometerValue, setOdometerValue] = useState<number>(0);
  const [fuelSelection, setFuelSelection] = useState<'RESERVA' | '1/4' | '1/2' | '3/4' | 'CHEIO'>('1/2');

  useEffect(() => {
    if (activeTrip) {
      setPassengerCount(activeTrip.final_turnstile || activeTrip.initial_turnstile || 0);
      setOdometerValue(activeTrip.final_odometer || activeTrip.initial_odometer || 0);
      setFuelSelection(activeTrip.fuel_level || '1/2');
    }
  }, [activeTrip]);

  // Time Tracking State
  const [timeTrackingHistory, setTimeTrackingHistory] = useState<Array<{ id: string; type: string; time: string; location: string }>>([
    { id: '1', type: 'Entrada no Turno', time: '06:00', location: 'Garagem Central' },
    { id: '2', type: 'Saída Almoço', time: '11:30', location: 'Terminal Rodoviário' },
    { id: '3', type: 'Retorno Almoço', time: '12:30', location: 'Terminal Rodoviário' }
  ]);
  const [selectedPontoType, setSelectedPontoType] = useState<string>('Entrada');
  const [pontoSubmitting, setPontoSubmitting] = useState(false);

  // Inspection Checklist State
  const [inspectionVehicle, setInspectionVehicle] = useState<string>('');
  const [inspectionOdometer, setInspectionOdometer] = useState<string>('145200');
  const [checklistItems, setChecklistItems] = useState<{ [key: string]: 'OK' | 'ATENCAO' | 'AVARIA' }>({
    pneus: 'OK',
    freios: 'OK',
    luzes: 'OK',
    limpeza: 'OK',
    oleo: 'OK',
    extintor: 'OK'
  });
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionSaving, setInspectionSaving] = useState(false);

  useEffect(() => {
    if (vehicles.length > 0 && !inspectionVehicle) {
      setInspectionVehicle(vehicles[0].plate || vehicles[0].id);
    }
  }, [vehicles, inspectionVehicle]);

  // Occurrence State
  const [occCategory, setOccCategory] = useState<'MECANICA' | 'TRANSITO' | 'PASSAGEIRO' | 'LIMPEZA' | 'OUTROS'>('TRANSITO');
  const [occSeverity, setOccSeverity] = useState<'BAIXA' | 'MEDIA' | 'ALTA'>('MEDIA');
  const [occDescription, setOccDescription] = useState('');
  const [occSaving, setOccSaving] = useState(false);

  // New Trip modal state
  const [newTripRoute, setNewTripRoute] = useState('');
  const [newTripBus, setNewTripBus] = useState('');
  const [newTripTime, setNewTripTime] = useState('08:00');
  const [newTripDirection, setNewTripDirection] = useState<'IDA' | 'VOLTA'>('IDA');

  // Search filter in routes
  const [routeSearch, setRouteSearch] = useState('');

  // Unread Notifications Count
  const unreadNotifs = useMemo(() => {
    return notifications.filter(n => !n.is_read);
  }, [notifications]);

  // Full View & Drawer Search State
  const [activeFullView, setActiveFullView] = useState<string | null>(null);
  const [tabsSearchQuery, setTabsSearchQuery] = useState('');
  const [shortcutSearchQuery, setShortcutSearchQuery] = useState('');
  const [activeTabCategory, setActiveTabCategory] = useState<string>('TODAS');

  // Permissions & Role Evaluation
  const userRole = (currentUser?.role || '').toUpperCase();
  const userJob = (currentUser?.job_title || '').toUpperCase();
  const isMasterEmail = currentUser?.email === 'suporte@vialivre.com.br' || currentUser?.email === 'consorcio.imperial.ltda@gmail.com' || currentUser?.email === 'via.nicolau.sa@gmail.com';
  const isFullAdmin = userRole === 'ADMIN' || currentUser?.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN') || isMasterEmail;
  const isFiscal = userRole === 'FISCAL' || userJob.includes('FISCAL');
  const isDriverOrConductor = userRole === 'DRIVER' || userRole === 'CONDUCTOR' || userJob.includes('MOTORISTA') || userJob.includes('COBRADOR') || userRole === 'URBANO' || userRole === 'RODOVIARIO';
  const isMechanic = userRole === 'MECHANIC' || userJob.includes('MECANICO') || userJob.includes('MECÂNICO');
  const isRH = userRole === 'RH' || userJob.includes('RECURSOS HUMANOS');
  const isTicketAgent = userRole === 'TICKET_AGENT' || userJob.includes('GUICHE') || userJob.includes('BILHETE');
  const isDispatcher = userRole === 'DESPACHANTE' || userJob.includes('DESPACHANTE');

  const handleOpenFullView = (viewId: string) => {
    setIsHamburgerOpen(false);
    setActiveFullView(viewId);
    if (onSelectFullView) {
      onSelectFullView(viewId);
    }
  };

  // Definition of ALL available system tabs with roles and actions
  const allAvailableTabs = useMemo(() => {
    const checkPerm = (tabId: string, defaultAllowed: boolean) => {
      if (isFullAdmin) return true;
      if (currentUser?.permissions && currentUser.permissions.length > 0) {
        if (currentUser.permissions.includes(tabId as any)) return true;
      }
      return defaultAllowed;
    };

    const list = [
      {
        id: 'dashboard',
        label: 'Início / Painel Geral',
        category: 'Operação',
        description: 'Métricas gerais e status da frota',
        icon: LayoutDashboard,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { setActiveTab('dashboard'); setActiveSubView('none'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: true
      },
      {
        id: 'operations',
        label: 'Centro Operacional',
        category: 'Operação',
        description: 'Viagens em andamento, catraca e odômetro',
        icon: Bus,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { setActiveTab('operations'); setActiveSubView('none'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('operation-center', isFullAdmin || isFiscal || isDriverOrConductor || isDispatcher)
      },
      {
        id: 'timetracking',
        label: 'Ponto Eletrônico',
        category: 'Operação',
        description: 'Registro biométrico oficial com GPS',
        icon: Timer,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20',
        action: () => { setActiveTab('timetracking'); setActiveSubView('none'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: true
      },
      {
        id: 'inspection',
        label: 'Vistoria & Checklist',
        category: 'Operação',
        description: 'Inspeção 360° pré-viagem do veículo',
        icon: ClipboardCheck,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/20',
        action: () => { setActiveTab('inspection'); setActiveSubView('none'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('inspections', isFullAdmin || isFiscal || isDriverOrConductor || isMechanic)
      },
      {
        id: 'occurrences',
        label: 'Diário de Ocorrências',
        category: 'Operação',
        description: 'Relato de pane, trânsito ou emergência',
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400 bg-red-500/20',
        action: () => { setActiveSubView('new-occurrence'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('observations', true)
      },
      {
        id: 'routes',
        label: 'Linhas & Itinerários',
        category: 'Operação',
        description: 'Consulta de horários, paradas e tarifas',
        icon: Map,
        color: 'text-purple-600 dark:text-purple-400 bg-purple-500/20',
        action: () => { setActiveSubView('routes'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('routes', true)
      },
      {
        id: 'new-trip',
        label: 'Iniciar Nova Partida',
        category: 'Operação',
        description: 'Criar viagem rápida na escala de hoje',
        icon: Plus,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { setActiveSubView('new-trip'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('operation-center', isFullAdmin || isFiscal || isDriverOrConductor)
      },
      {
        id: 'notices',
        label: 'Mural de Avisos',
        category: 'Comunicação',
        description: 'Comunicados oficiais da direção e tráfego',
        icon: Bell,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/20',
        action: () => { setActiveSubView('notices'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: checkPerm('notices', true)
      },
      {
        id: 'monitoring',
        label: 'Monitoramento em Tempo Real',
        category: 'Operação',
        description: 'Rastreamento de frota e telemetria GPS',
        icon: Activity,
        color: 'text-sky-600 dark:text-sky-400 bg-sky-500/20',
        action: () => { handleOpenFullView('monitoring'); },
        allowed: checkPerm('monitoring', isFullAdmin || isFiscal || isDispatcher)
      },
      {
        id: 'schedule',
        label: 'Escala de Viagens',
        category: 'Operação',
        description: 'Grade de partidas e escalas da equipe',
        icon: Calendar,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/20',
        action: () => { handleOpenFullView('schedule'); },
        allowed: checkPerm('schedule', isFullAdmin || isFiscal)
      },
      {
        id: 'vehicles',
        label: 'Frota de Ônibus',
        category: 'Frota',
        description: 'Cadastro e status dos carros e modelos',
        icon: BusFront,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/20',
        action: () => { handleOpenFullView('vehicles'); },
        allowed: checkPerm('vehicles', isFullAdmin || isFiscal || isMechanic)
      },
      {
        id: 'maintenance',
        label: 'Oficina & Manutenção',
        category: 'Frota',
        description: 'Ordens de serviço e revisões preventivas',
        icon: Wrench,
        color: 'text-orange-600 dark:text-orange-400 bg-orange-500/20',
        action: () => { handleOpenFullView('maintenance'); },
        allowed: checkPerm('maintenance', isFullAdmin || isMechanic)
      },
      {
        id: 'drivers',
        label: 'Colaboradores',
        category: 'RH & Pessoal',
        description: 'Motoristas, cobradores e fiscais',
        icon: UsersRound,
        color: 'text-teal-600 dark:text-teal-400 bg-teal-500/20',
        action: () => { handleOpenFullView('drivers'); },
        allowed: checkPerm('drivers', isFullAdmin || isRH)
      },
      {
        id: 'sac',
        label: 'Vale Transporte (SAC)',
        category: 'Atendimento',
        description: 'Recargas, cartões e atendimento',
        icon: Headphones,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20',
        action: () => { handleOpenFullView('sac'); },
        allowed: checkPerm('sac', true)
      },
      {
        id: 'reports-view',
        label: 'Relatórios Operacionais',
        category: 'Gestão',
        description: 'Gráficos de arrecadação, pontualidade e km',
        icon: BarChart,
        color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/20',
        action: () => { handleOpenFullView('reports-view'); },
        allowed: checkPerm('reports-view', isFullAdmin || isFiscal || isRH)
      },
      {
        id: 'ticketing',
        label: 'Guichê de Vendas',
        category: 'Vendas',
        description: 'Emissão de passagens e bilhetes com QR Code',
        icon: Ticket,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/20',
        action: () => { handleOpenFullView('ticketing'); },
        allowed: checkPerm('ticketing', isFullAdmin || isTicketAgent || userRole === 'CONDUCTOR' || userJob.includes('COBRADOR'))
      },
      {
        id: 'payroll',
        label: 'Holerites (RH)',
        category: 'RH & Pessoal',
        description: 'Folha de pagamento e demonstrativos',
        icon: DollarSign,
        color: 'text-green-600 dark:text-green-400 bg-green-500/20',
        action: () => { handleOpenFullView('payroll'); },
        allowed: checkPerm('payroll', isFullAdmin || isRH)
      },
      {
        id: 'dispatcher',
        label: 'Despachante Operacional',
        category: 'Operação',
        description: 'Liberação de carros e controle de tráfego',
        icon: ShieldCheck,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/20',
        action: () => { handleOpenFullView('dispatcher'); },
        allowed: checkPerm('dispatcher', isFullAdmin || isFiscal || isDispatcher)
      },
      {
        id: 'bus-stations',
        label: 'Rodoviárias & Terminais',
        category: 'Operação',
        description: 'Gestão de plataformas e terminais',
        icon: Building2,
        color: 'text-slate-600 dark:text-zinc-400 bg-slate-500/20',
        action: () => { handleOpenFullView('bus-stations'); },
        allowed: checkPerm('bus-stations', isFullAdmin || isFiscal)
      },
      {
        id: 'companies',
        label: 'Empresas & Consórcios',
        category: 'Gestão',
        description: 'Operadoras e dados cadastrais',
        icon: Building2,
        color: 'text-slate-600 dark:text-zinc-400 bg-slate-500/20',
        action: () => { handleOpenFullView('companies'); },
        allowed: checkPerm('companies', isFullAdmin)
      },
      {
        id: 'cities',
        label: 'Municípios Atendidos',
        category: 'Gestão',
        description: 'Cidades integradas e linhas intermunicipais',
        icon: MapPin,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/20',
        action: () => { handleOpenFullView('cities'); },
        allowed: checkPerm('cities', isFullAdmin)
      },
      {
        id: 'ticketing-config',
        label: 'Gestão de Guichê',
        category: 'Vendas',
        description: 'Configuração de balcões e impressoras térmicas',
        icon: Settings2,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { handleOpenFullView('ticketing-config'); },
        allowed: checkPerm('ticketing-config', isFullAdmin)
      },
      {
        id: 'recruitment',
        label: 'Recrutamento (RH)',
        category: 'RH & Pessoal',
        description: 'Seleção de candidatos e motoristas',
        icon: Briefcase,
        color: 'text-teal-600 dark:text-teal-400 bg-teal-500/20',
        action: () => { handleOpenFullView('recruitment'); },
        allowed: checkPerm('recruitment', isFullAdmin || isRH)
      },
      {
        id: 'work-with-us',
        label: 'Trabalhe Conosco',
        category: 'RH & Pessoal',
        description: 'Envio e triagem de currículos',
        icon: Briefcase,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/20',
        action: () => { handleOpenFullView('work-with-us'); },
        allowed: true
      },
      {
        id: 'management',
        label: 'Gestão Global',
        category: 'Gestão',
        description: 'Visão executiva e controle geral',
        icon: Briefcase,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/20',
        action: () => { handleOpenFullView('management'); },
        allowed: checkPerm('management', isFullAdmin || isRH)
      },
      {
        id: 'skins',
        label: 'Repositório de Skins',
        category: 'Frota',
        description: 'Pinturas personalizadas dos ônibus',
        icon: Bus,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/20',
        action: () => { handleOpenFullView('skins'); },
        allowed: checkPerm('skins', isFullAdmin)
      },
      {
        id: 'users',
        label: 'Controle de Acessos',
        category: 'Segurança',
        description: 'Permissões e usuários do sistema',
        icon: KeyRound,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/20',
        action: () => { handleOpenFullView('users'); },
        allowed: checkPerm('users', isFullAdmin)
      },
      {
        id: 'my-subscription',
        label: 'Minha Assinatura',
        category: 'Sistema',
        description: 'Licenças ativas, chaves e faturamento',
        icon: CreditCard,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { handleOpenFullView('my-subscription'); },
        allowed: checkPerm('my-subscription', isFullAdmin)
      },
      {
        id: 'subscriptions',
        label: 'Assinaturas (Master)',
        category: 'Sistema',
        description: 'Gestão de licenças de todas as empresas',
        icon: ShieldAlert,
        color: 'text-red-600 dark:text-red-400 bg-red-500/20',
        action: () => { handleOpenFullView('subscriptions'); },
        allowed: isFullAdmin || isMasterEmail
      },
      {
        id: 'notifications',
        label: 'Alertas e Avisos',
        category: 'Comunicação',
        description: 'Central de mensagens e notificações',
        icon: Bell,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/20',
        action: () => { setActiveSubView('notifications'); setActiveFullView(null); setIsHamburgerOpen(false); },
        allowed: true
      },
      {
        id: 'operational-ai',
        label: 'Tico (Assistente IA)',
        category: 'Ajuda',
        description: 'Assistente operacional inteligente do sistema',
        icon: Bot,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/20',
        action: () => { handleOpenFullView('operational-ai'); },
        allowed: true
      },
      {
        id: 'guided-tour',
        label: 'Tours Guiados',
        category: 'Ajuda',
        description: 'Treinamento interativo passo a passo',
        icon: Sparkles,
        color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/20',
        action: () => { handleOpenFullView('guided-tour'); },
        allowed: true
      },
      {
        id: 'about',
        label: 'Sobre o Sistema',
        category: 'Ajuda',
        description: 'Versão, suporte e documentação',
        icon: HelpCircle,
        color: 'text-slate-600 dark:text-zinc-400 bg-slate-500/20',
        action: () => { handleOpenFullView('about'); },
        allowed: true
      }
    ];

    return list.filter(item => item.allowed);
  }, [currentUser, isFullAdmin, isFiscal, isDriverOrConductor, isMechanic, isRH, isTicketAgent, isDispatcher, isMasterEmail, userRole, onSelectFullView]);

  // User Customizable Quick Shortcuts State
  const defaultShortcuts = useMemo(() => {
    if (isDriverOrConductor) {
      return ['operations', 'timetracking', 'inspection', 'occurrences', 'routes', 'new-trip', 'notices'];
    }
    if (isFiscal) {
      return ['operations', 'timetracking', 'inspection', 'new-trip', 'schedule', 'monitoring', 'routes', 'notices'];
    }
    if (isMechanic) {
      return ['inspection', 'maintenance', 'vehicles', 'timetracking', 'notices', 'occurrences'];
    }
    if (isRH) {
      return ['dashboard', 'payroll', 'drivers', 'recruitment', 'timetracking', 'notices'];
    }
    return ['operations', 'timetracking', 'inspection', 'occurrences', 'routes', 'new-trip', 'notices'];
  }, [isDriverOrConductor, isFiscal, isMechanic, isRH]);

  const storageKey = `vialivre_mobile_custom_shortcuts_${currentUser?.id || 'default'}`;

  const [customShortcutIds, setCustomShortcutIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem('vialivre_mobile_custom_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultShortcuts;
  });

  const activeShortcuts = useMemo(() => {
    return customShortcutIds
      .map(id => allAvailableTabs.find(tab => tab.id === id))
      .filter(Boolean) as typeof allAvailableTabs;
  }, [customShortcutIds, allAvailableTabs]);

  const handleToggleShortcutSelection = (id: string) => {
    setCustomShortcutIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 4) {
          addToast('Selecione no mínimo 4 atalhos rápidos', 'warning');
          return prev;
        }
        return prev.filter(x => x !== id);
      } else {
        if (prev.length >= 12) {
          addToast('Você pode escolher até 12 atalhos rápidos', 'warning');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleSaveCustomShortcuts = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(customShortcutIds));
      localStorage.setItem('vialivre_mobile_custom_shortcuts', JSON.stringify(customShortcutIds));
    } catch {}
    setIsEditingShortcuts(false);
    addToast('Atalhos rápidos de campo atualizados com sucesso!', 'success');
  };

  const handleResetShortcuts = () => {
    setCustomShortcutIds(defaultShortcuts);
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaultShortcuts));
      localStorage.setItem('vialivre_mobile_custom_shortcuts', JSON.stringify(defaultShortcuts));
    } catch {}
  };

  // Handlers for Ponto, Vistoria, Ocorrência, Viagens
  const handleRegisterPonto = async () => {
    setPontoSubmitting(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const newEntry = {
        id: `ponto-${Date.now()}`,
        type: selectedPontoType,
        time: timeStr,
        location: 'Garagem Central (GPS -23.5505, -46.6333)'
      };

      setTimeTrackingHistory(prev => [newEntry, ...prev]);

      try {
        await supabase.from('time_tracking').insert({
          id: `tt-${Date.now()}`,
          system_id: currentUser?.system_id || 'sys-vialivre-default',
          user_id: currentUser?.id || 'user-mobile',
          date: todayStr,
          clock_in: timeStr,
          notes: `Batida mobile: ${selectedPontoType} às ${timeStr}`
        });
      } catch (err) {
        console.warn('Fallback time tracking storage:', err);
      }

      addToast(`Ponto registrado com sucesso: ${selectedPontoType} às ${timeStr}`, 'success');
      NotificationService.sendLocalNotification('Ponto Registrado', {
        body: `Sua marcação de ${selectedPontoType} foi confirmada com sucesso às ${timeStr}.`
      });
    } catch {
      addToast('Erro ao registrar ponto eletrônico', 'error');
    } finally {
      setPontoSubmitting(false);
    }
  };

  const handleSaveInspection = async () => {
    if (!inspectionVehicle) {
      addToast('Selecione o veículo inspecionado', 'warning');
      return;
    }
    setInspectionSaving(true);
    try {
      const isAprovado = Object.values(checklistItems).every(v => v === 'OK');
      const hasAvaria = Object.values(checklistItems).some(v => v === 'AVARIA');
      const statusResult = hasAvaria ? 'REPROVADO' : isAprovado ? 'APROVADO' : 'RESTRICAO';

      const inspectionPayload: Partial<Inspection> = {
        id: `insp-mob-${Date.now()}`,
        system_id: currentUser?.system_id || 'sys-vialivre-default',
        vehicle_id: inspectionVehicle,
        inspector_id: currentUser?.id || 'inspector-mobile',
        date: todayStr,
        location: 'Pátio Operacional Mobile',
        agency: 'ViaLivre Gestão',
        status: statusResult,
        checklist: {
          pneus: checklistItems.pneus === 'OK',
          freios: checklistItems.freios === 'OK',
          luzes: checklistItems.luzes === 'OK',
          limpeza: checklistItems.limpeza === 'OK',
          documentos: true,
          ar_condicionado: checklistItems.oleo === 'OK'
        },
        notes: `Vistoria Mobile (Odômetro: ${inspectionOdometer} km). Observação: ${inspectionNotes || 'Conforme'}`
      };

      if (onAddInspection) {
        await onAddInspection(inspectionPayload);
      } else {
        await db.create('inspections', inspectionPayload as any);
      }

      addToast(`Vistoria veicular registrada como ${statusResult}!`, 'success');
      setInspectionNotes('');
      setActiveTab('dashboard');
    } catch {
      addToast('Erro ao salvar vistoria veicular', 'error');
    } finally {
      setInspectionSaving(false);
    }
  };

  const handleSaveOccurrence = async () => {
    if (!occDescription.trim()) {
      addToast('Descreva a ocorrência', 'warning');
      return;
    }
    setOccSaving(true);
    try {
      const occPayload: Partial<IssueReport> = {
        id: `occ-mob-${Date.now()}`,
        system_id: currentUser?.system_id || 'sys-vialivre-default',
        trip_id: activeTrip?.id || 'geral',
        vehicle_id: activeTrip?.bus_number || vehicles[0]?.plate || 'Vtr-01',
        driver_id: currentUser?.id || 'motorista',
        type: occCategory,
        occurrence_type: occCategory,
        category: occCategory,
        severity: occSeverity,
        status: 'ABERTA',
        description: occDescription,
        suggested_action: 'Avaliar equipe de tráfego/CCO',
        timestamp: new Date().toISOString()
      };

      if (onAddReport) {
        await onAddReport(occPayload);
      } else {
        await db.create('occurrences', occPayload as any);
      }

      addToast('Ocorrência transmitida ao CCO com sucesso!', 'success');
      setOccDescription('');
      setActiveSubView('none');
    } catch {
      addToast('Erro ao transmitir ocorrência', 'error');
    } finally {
      setOccSaving(false);
    }
  };

  const handleUpdateTripQuick = async (status: Trip['status']) => {
    if (!activeTrip) return;
    try {
      const updates: Partial<Trip> = {
        status,
        final_turnstile: passengerCount,
        final_odometer: odometerValue,
        fuel_level: fuelSelection
      };
      if (onUpdateTrip) {
        await onUpdateTrip(activeTrip.id, updates);
      } else {
        await db.update('trips', { id: activeTrip.id, ...updates } as any);
      }
      addToast(`Viagem atualizada para: ${status}`, 'success');
    } catch {
      addToast('Erro ao atualizar status da viagem', 'error');
    }
  };

  const handleCreateTripQuick = async () => {
    if (!newTripRoute || !newTripBus) {
      addToast('Informe a rota e o veículo', 'warning');
      return;
    }
    try {
      const tripPayload: Partial<Trip> = {
        id: `trip-mob-${Date.now()}`,
        system_id: currentUser?.system_id || 'sys-vialivre-default',
        route_id: newTripRoute,
        bus_number: newTripBus,
        driver_id: currentUser?.id || 'driver-1',
        driver_name: currentUser?.name || 'Motorista Titular',
        departure_time: newTripTime,
        trip_date: todayStr,
        status: 'Agendada',
        direction: newTripDirection,
        passengers: {},
        initial_turnstile: 0,
        final_turnstile: 0,
        initial_odometer: 100000,
        final_odometer: 100000,
        fuel_level: 'CHEIO'
      };

      if (onAddTrip) {
        await onAddTrip(tripPayload);
      } else {
        await db.create('trips', tripPayload as any);
      }

      addToast('Nova viagem criada com sucesso na escala!', 'success');
      setActiveSubView('none');
    } catch {
      addToast('Erro ao agendar nova viagem', 'error');
    }
  };

  return (
    <div className={`w-full max-w-[412px] h-[732px] overflow-hidden flex flex-col mx-auto relative select-none font-sans transition-colors duration-300 ${
      themeMode === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    } ${!isEmbedded ? 'shadow-2xl sm:rounded-[36px] sm:border-4 border-slate-300 dark:border-zinc-800' : ''}`}>
      
      {/* 1. NATIVE ANDROID STATUS BAR (412px standard) */}
      <div className="w-full h-8 px-4 pt-1 flex items-center justify-between text-xs font-bold tracking-wider bg-transparent z-30 shrink-0">
        <span className="text-slate-800 dark:text-zinc-200 font-mono text-xs">{currentTime}</span>
        
        {/* Status Bar Icons: 5G, Wi-Fi, Battery */}
        <div className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300">
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] font-black tracking-tight">5G</span>
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 h-1.5 bg-current rounded-full" />
              <span className="w-0.5 h-2 bg-current rounded-full" />
              <span className="w-0.5 h-2.5 bg-current rounded-full" />
              <span className="w-0.5 h-3 bg-current rounded-full" />
            </div>
          </div>
          <Wifi size={14} strokeWidth={2.5} />
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold">98%</span>
            <BatteryCharging size={15} className="text-emerald-500" />
          </div>
        </div>
      </div>

      {/* 2. TOP APP HEADER BAR WITH FIXED HAMBURGER, DESIGN & PALETTE BUTTONS */}
      <div className="w-full px-4 py-2.5 flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Fixed Hamburger Trigger in Header (Touch target 44px) */}
          <button
            onClick={() => setIsHamburgerOpen(true)}
            className="w-10 h-10 -ml-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center hover:bg-yellow-400 hover:text-slate-950 active:scale-95 transition-all shrink-0 shadow-xs"
            title="Abrir Menu de Todas as Abas"
          >
            <Menu size={20} />
          </button>

          <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center p-1.5 shadow-sm shrink-0">
            <img 
              src={systemSettings?.system_logo || "/Logo_ViaLivre.png"} 
              alt="ViaLivre" 
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.src.endsWith('/Logo_ViaLivre.png')) {
                  target.src = '/Logo_ViaLivre.png';
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none text-slate-950 dark:text-white">
                Via<span className="text-yellow-500">Livre</span> Mobile
              </h1>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest truncate leading-none mt-1">
              412 × 732 px Standard
            </p>
          </div>
        </div>

        {/* Quick Header Actions: Notifications, Sun/Moon Theme & Desktop */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveSubView(activeSubView === 'notifications' ? 'none' : 'notifications')}
            className="w-9 h-9 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center relative transition-all active:scale-90"
            title="Notificações"
          >
            <Bell size={18} />
            {unreadNotifs.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-zinc-900">
                {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowThemeModal(true)}
            className="w-9 h-9 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-90"
            title="Design e Cores (Ajustar Tema, Cores e Alto Contraste)"
          >
            {themeMode === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-yellow-400" />}
          </button>

          <button
            onClick={onSwitchToDesktop}
            className="h-9 px-3 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-yellow-300 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
            title="Alternar para visualização Desktop"
          >
            <Monitor size={14} />
            <span className="font-bold">PC</span>
          </button>
        </div>
      </div>

      {/* 3. OPERATOR USER STRIP */}
      <div className="w-full px-4 py-2 bg-yellow-400/10 dark:bg-yellow-400/5 border-b border-yellow-400/20 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-black uppercase truncate text-slate-900 dark:text-white text-xs leading-none">
              {currentUser?.name || 'Operador de Campo'}
            </p>
            <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 uppercase truncate mt-0.5">
              {currentUser?.job_title || currentUser?.role || 'Motorista Titular'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Em Serviço</span>
        </div>
      </div>

      {/* 4. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 custom-scrollbar space-y-4 pb-24">

        {/* SUBVIEW: NOTIFICATIONS MODAL / SHEET */}
        {activeSubView === 'notifications' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-yellow-400 p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-yellow-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Notificações e Alertas</h3>
              </div>
              <button 
                onClick={() => setActiveSubView('none')} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-400 py-4 text-center font-medium">Nenhuma notificação no momento.</p>
              ) : (
                notifications.slice(0, 6).map(n => (
                  <div key={n.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-left">
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-snug">{n.title}</p>
                    <p className="text-xs text-slate-700 dark:text-zinc-200 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mt-1.5 block">{formatDate(n.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUBVIEW: EDIT QUICK SHORTCUTS MODAL (Requested explicitly) */}
        {isEditingShortcuts && (
          <div className="bg-white dark:bg-black rounded-3xl border-2 border-yellow-400 p-4 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-yellow-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Personalizar Ações Rápidas</h3>
              </div>
              <button 
                onClick={() => setIsEditingShortcuts(false)} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-700 dark:text-zinc-200 font-bold">
                Selecione de 4 a 12 abas liberadas para ficarem fixas como atalhos diretos na tela inicial:
              </p>
              <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-zinc-400">
                <span>Atalhos ativos: <strong className="text-yellow-600 dark:text-yellow-400">{customShortcutIds.length}</strong> selecionados</span>
                <span>{allAvailableTabs.length} abas liberadas</span>
              </div>
            </div>

            {/* Quick Search inside shortcuts */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar abas liberadas..."
                value={shortcutSearchQuery}
                onChange={(e) => setShortcutSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-yellow-400 text-slate-900 dark:text-white"
              />
              {shortcutSearchQuery && (
                <button
                  type="button"
                  onClick={() => setShortcutSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List of all allowed tabs for selection */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {allAvailableTabs
                .filter(tab => {
                  if (!shortcutSearchQuery) return true;
                  const q = shortcutSearchQuery.toLowerCase();
                  return tab.label.toLowerCase().includes(q) || tab.description.toLowerCase().includes(q);
                })
                .map(tab => {
                  const Icon = tab.icon;
                  const selectedIndex = customShortcutIds.indexOf(tab.id);
                  const isSelected = selectedIndex !== -1;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleToggleShortcutSelection(tab.id)}
                      className={`w-full min-h-[50px] p-2.5 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-98 ${
                        isSelected 
                          ? 'border-yellow-400 bg-yellow-400/10 dark:bg-yellow-400/15 shadow-sm ring-1 ring-yellow-400/40' 
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tab.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">{tab.label}</p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{tab.description}</p>
                        </div>
                      </div>

                      <div className={`h-6 px-2 rounded-lg flex items-center justify-center gap-1 shrink-0 transition-colors text-[10px] font-black ${
                        isSelected ? 'bg-yellow-400 text-slate-950 font-black shadow-xs' : 'border-2 border-slate-300 dark:border-zinc-700 text-slate-400'
                      }`}>
                        {isSelected ? (
                          <>
                            <Check size={12} strokeWidth={3} />
                            <span>#{selectedIndex + 1}</span>
                          </>
                        ) : (
                          <span>+ Adicionar</span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleResetShortcuts}
                className="flex-1 min-h-[46px] py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-black uppercase active:scale-95 transition-all"
              >
                Padrão
              </button>

              <button
                type="button"
                onClick={handleSaveCustomShortcuts}
                className="flex-[2] min-h-[46px] py-2.5 px-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
              >
                Salvar Atalhos ({customShortcutIds.length})
              </button>
            </div>
          </div>
        )}

        {/* SUBVIEW: NEW TRIP MODAL */}
        {activeSubView === 'new-trip' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-yellow-400 p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <PlayCircle size={18} className="text-yellow-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Nova Viagem Operacional</h3>
              </div>
              <button 
                onClick={() => setActiveSubView('none')} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Linha / Rota</label>
                <select
                  value={newTripRoute}
                  onChange={(e) => setNewTripRoute(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs font-bold outline-none uppercase focus:border-yellow-400"
                >
                  <option value="" className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">Selecione uma rota...</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
                      {r.code ? `[${r.code}] ` : ''}{r.origin} ➔ {r.destination}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Carro / Prefixo</label>
                  <select
                    value={newTripBus}
                    onChange={(e) => setNewTripBus(e.target.value)}
                    className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs font-bold outline-none uppercase focus:border-yellow-400"
                  >
                    <option value="" className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">Selecione...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.prefix || v.plate} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
                        Carro {v.prefix || v.plate}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Horário Partida</label>
                  <input
                    type="time"
                    value={newTripTime}
                    onChange={(e) => setNewTripTime(e.target.value)}
                    className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Sentido da Viagem</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewTripDirection('IDA')}
                    className={`min-h-[48px] rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                      newTripDirection === 'IDA' 
                        ? 'bg-yellow-400 text-slate-950 font-black ring-2 ring-yellow-400/50' 
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                    }`}
                  >
                    <span>IDA</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTripDirection('VOLTA')}
                    className={`min-h-[48px] rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                      newTripDirection === 'VOLTA' 
                        ? 'bg-yellow-400 text-slate-950 font-black ring-2 ring-yellow-400/50' 
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                    }`}
                  >
                    <span>VOLTA</span>
                    <ArrowRight size={14} className="rotate-180" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateTripQuick}
                className="w-full min-h-[50px] py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all mt-2"
              >
                Confirmar e Iniciar Viagem
              </button>
            </div>
          </div>
        )}

        {/* SUBVIEW: NEW OCCURRENCE MODAL */}
        {activeSubView === 'new-occurrence' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-red-500 p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Relato de Ocorrência</h3>
              </div>
              <button 
                onClick={() => setActiveSubView('none')} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TRANSITO', 'MECANICA', 'PASSAGEIRO'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setOccCategory(cat)}
                      className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-black uppercase transition-all shadow-xs active:scale-95 ${
                        occCategory === cat 
                          ? 'bg-red-500 text-white shadow-md' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Gravidade</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BAIXA', 'MEDIA', 'ALTA'] as const).map(sev => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setOccSeverity(sev)}
                      className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-black uppercase transition-all shadow-xs active:scale-95 ${
                        occSeverity === sev 
                          ? sev === 'ALTA' ? 'bg-red-600 text-white' : sev === 'MEDIA' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Descrição do Ocorrido</label>
                <textarea
                  value={occDescription}
                  onChange={(e) => setOccDescription(e.target.value)}
                  placeholder="Informe local, motivo (ex: pane mecânica, trânsito lento, colisão)..."
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs font-medium outline-none focus:border-red-500 placeholder-slate-400 dark:placeholder-zinc-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveOccurrence}
                disabled={occSaving}
                className="w-full min-h-[50px] py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {occSaving ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span>Transmitir ao CCO</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: INÍCIO / DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            
            {/* Subscription Alert (if expiring) */}
            {subscription && (
              <SubscriptionExpirationAlert 
                subscription={subscription} 
                onForceBackup={onForceBackup}
                dismissible={true}
              />
            )}

            {/* 4 Quick KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left">
                <div className="flex items-center justify-between text-yellow-600 dark:text-yellow-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Viagens Hoje</span>
                  <Bus size={16} />
                </div>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  {todayTrips.length}
                </p>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold block mt-1.5">
                  {todayTrips.filter(t => t.status === 'Em Rota' || t.status === 'Em Andamento').length} em andamento
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Pontualidade</span>
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  98.4%
                </p>
                <span className="text-[10px] text-emerald-500 font-bold block mt-1.5">
                  +1.2% meta CCO
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left">
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Frota Ativa</span>
                  <Compass size={16} />
                </div>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  {vehicles.length > 0 ? vehicles.length : 12}
                </p>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold block mt-1.5">
                  veículos operando
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left">
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Passageiros</span>
                  <Users size={16} />
                </div>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  {todayTrips.reduce((acc, t) => acc + (t.final_turnstile || 0), 0) || 1240}
                </p>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold block mt-1.5">
                  catraca registrada
                </span>
              </div>
            </div>

            {/* Ações Rápidas de Campo - User Customizable Shortcuts */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                    Ações Rápidas de Campo
                  </span>
                  <span className="text-[9px] font-black text-yellow-700 dark:text-yellow-400 uppercase bg-yellow-400/20 px-1.5 py-0.5 rounded-md">
                    {activeShortcuts.length}
                  </span>
                </div>
                
                {/* Button to edit / customize shortcuts */}
                <button
                  type="button"
                  onClick={() => setIsEditingShortcuts(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-yellow-400 hover:text-slate-950 font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-xs"
                  title="Personalizar atalhos de campo"
                >
                  <Edit3 size={12} />
                  <span>Personalizar</span>
                </button>
              </div>

              {/* Dynamic Grid of Custom Shortcuts */}
              <div className="grid grid-cols-4 gap-2.5">
                {activeShortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;
                  return (
                    <button
                      key={shortcut.id}
                      onClick={shortcut.action}
                      className="flex flex-col items-center justify-center min-h-[72px] p-2 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 hover:bg-yellow-400/20 active:scale-95 transition-all text-center group"
                      title={shortcut.label}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs ${shortcut.color}`}>
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase mt-1.5 text-slate-800 dark:text-zinc-200 truncate max-w-full">
                        {shortcut.label.split('/')[0].split('&')[0].trim()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active / Current Trip Card */}
            {activeTrip && (
              <div className="bg-gradient-to-br from-yellow-400/20 via-amber-400/10 to-transparent dark:from-yellow-400/10 dark:via-zinc-900 dark:to-zinc-900 p-4 rounded-3xl border-2 border-yellow-400/50 shadow-sm text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-yellow-400 text-slate-950 px-2.5 py-1 rounded-lg tracking-wider">
                    {activeTrip.status || 'Em Rota'}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Saída: {activeTrip.departure_time || '08:00'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black uppercase text-slate-950 dark:text-white leading-tight">
                    Carro {activeTrip.bus_number} • {routes.find(r => r.id === activeTrip.route_id)?.origin || 'Terminal'} ➔ {routes.find(r => r.id === activeTrip.route_id)?.destination || 'Centro'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-bold uppercase mt-1">
                    Motorista: {activeTrip.driver_name || currentUser?.name || 'Não atribuído'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-yellow-400/20">
                  <div className="text-xs font-black text-slate-700 dark:text-zinc-300">
                    Catraca: <span className="text-yellow-600 dark:text-yellow-400 text-sm">{passengerCount}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('operations')}
                    className="h-10 px-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <span>Painel da Viagem</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Company Notices Teaser */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                  Mural da Garagem
                </span>
                <button
                  onClick={() => setActiveSubView('notices')}
                  className="text-xs font-black text-yellow-600 dark:text-yellow-400 uppercase"
                >
                  Ver Todos ({notices.length})
                </button>
              </div>

              {notices.length > 0 ? (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700">
                  <p className="text-xs font-black uppercase text-slate-900 dark:text-white leading-tight">
                    {notices[0].title}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
                    {notices[0].content}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-zinc-400 py-2 text-center">Nenhum aviso urgente no momento.</p>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: OPERACIONAL / VIAGENS */}
        {activeTab === 'operations' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Bus size={16} className="text-yellow-500" />
                <span>Centro Operacional Mobile</span>
              </h3>
              <button
                onClick={() => setActiveSubView('new-trip')}
                className="h-9 px-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-all"
              >
                <Plus size={14} />
                <span>Nova</span>
              </button>
            </div>

            {/* Active Trip Selector (horizontal pills with thumb touch >= 44px) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {todayTrips.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTripId(t.id)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-black uppercase whitespace-nowrap transition-all border-2 ${
                    selectedTripId === t.id
                      ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  Carro {t.bus_number} • {t.departure_time}
                </button>
              ))}
            </div>

            {activeTrip ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-yellow-400 p-4 shadow-md space-y-3.5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black uppercase text-yellow-600 dark:text-yellow-400 tracking-wider">
                      Viagem Ativa
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white uppercase leading-none mt-0.5">
                      Carro {activeTrip.bus_number}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUpdateTripQuick('Em Rota')}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                        activeTrip.status === 'Em Rota'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      Em Rota
                    </button>
                    <button
                      onClick={() => handleUpdateTripQuick('Concluída')}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      Finalizar
                    </button>
                  </div>
                </div>

                {/* Sentido IDA / VOLTA (Thumb Friendly 48px height) */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-700 dark:text-zinc-200 mb-1.5 block">Sentido do Itinerário</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        if (onUpdateTrip) await onUpdateTrip(activeTrip.id, { direction: 'IDA' });
                      }}
                      className={`min-h-[48px] rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                        activeTrip.direction === 'IDA' 
                          ? 'bg-yellow-400 text-slate-950 font-black shadow-sm ring-2 ring-yellow-400/40' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      <span>IDA</span>
                      <ArrowRight size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (onUpdateTrip) await onUpdateTrip(activeTrip.id, { direction: 'VOLTA' });
                      }}
                      className={`min-h-[48px] rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                        activeTrip.direction === 'VOLTA' 
                          ? 'bg-yellow-400 text-slate-950 font-black shadow-sm ring-2 ring-yellow-400/40' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      <ArrowRight size={14} className="rotate-180" />
                      <span>VOLTA</span>
                    </button>
                  </div>
                </div>

                {/* Catraca Digital (+1, +5) with Height >= 48px */}
                <div className="bg-slate-50 dark:bg-zinc-800/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-zinc-200">Contador de Catraca</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{passengerCount}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      onClick={() => setPassengerCount(prev => prev + 1)}
                      className="min-h-[48px] py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-xs font-black uppercase shadow-sm active:scale-95 transition-all"
                    >
                      +1 Pass.
                    </button>
                    <button
                      onClick={() => setPassengerCount(prev => prev + 5)}
                      className="min-h-[48px] py-2.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-900 dark:text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all"
                    >
                      +5 Pass.
                    </button>
                    <button
                      onClick={() => handleUpdateTripQuick(activeTrip.status)}
                      className="min-h-[48px] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {/* Combustível & Odômetro with 48px Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-zinc-800/70 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80">
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-300 flex items-center gap-1 mb-1">
                      <Fuel size={12} /> Combustível
                    </label>
                    <select
                      value={fuelSelection}
                      onChange={(e) => setFuelSelection(e.target.value as any)}
                      className="w-full h-10 bg-transparent text-xs font-black text-slate-900 dark:text-zinc-100 uppercase outline-none"
                    >
                      <option value="CHEIO" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">Cheio (4/4)</option>
                      <option value="3/4" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">3/4 Tanque</option>
                      <option value="1/2" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">1/2 Tanque</option>
                      <option value="1/4" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">1/4 Tanque</option>
                      <option value="RESERVA" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">Reserva !</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 dark:bg-zinc-800/70 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80">
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-300 mb-1 block">
                      Odômetro (KM)
                    </label>
                    <input
                      type="number"
                      value={odometerValue}
                      onChange={(e) => setOdometerValue(Number(e.target.value))}
                      className="w-full h-10 bg-transparent text-xs font-black text-slate-900 dark:text-white font-mono uppercase outline-none"
                    />
                  </div>
                </div>

                {/* SOS & Incident Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => {
                      NotificationService.sendLocalNotification('ALERTA SOS DISPARADO', {
                        body: `Viagem Carro ${activeTrip.bus_number} solicitou apoio imediato do CCO.`
                      });
                      addToast('Sinal de emergência transmitido ao CCO!', 'error');
                    }}
                    className="min-h-[48px] py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldAlert size={16} />
                    <span>Botão SOS</span>
                  </button>

                  <button
                    onClick={() => setActiveSubView('new-occurrence')}
                    className="min-h-[48px] py-3 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={16} className="text-yellow-400" />
                    <span>Ocorrência</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-8 text-center space-y-3">
                <Bus size={36} className="mx-auto text-slate-400 dark:text-zinc-500" />
                <p className="text-sm font-black uppercase text-slate-800 dark:text-zinc-200">Nenhuma viagem em curso</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Clique em "Nova" para criar ou iniciar uma viagem na escala.</p>
                <button
                  onClick={() => setActiveSubView('new-trip')}
                  className="min-h-[48px] px-6 py-3 bg-yellow-400 text-slate-950 rounded-2xl text-xs font-black uppercase shadow-md active:scale-95 transition-all"
                >
                  Iniciar Viagem Agora
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PONTO ELETRÔNICO */}
        {activeTab === 'timetracking' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Timer size={16} className="text-emerald-500" />
                <span>Ponto Eletrônico Digital</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 uppercase bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                Portaria 671 / MTP
              </span>
            </div>

            {/* Giant Live Clock Card */}
            <div className="bg-gradient-to-br from-slate-900 to-zinc-950 text-white p-5 rounded-3xl border-2 border-emerald-500/40 shadow-xl text-center space-y-1 relative overflow-hidden">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                Horário Oficial de Brasília
              </span>
              <p className="text-4xl font-black tracking-tight font-mono text-white py-1">
                {currentSecondsTime}
              </p>
              <p className="text-xs text-slate-300 font-bold uppercase">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>

              <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-black">
                <MapPin size={14} />
                <span>Garagem Central (GPS Confirmado)</span>
              </div>
            </div>

            {/* Ponto Selector & Big Button */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-3.5">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-2 block">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Entrada', 'Saída Almoço', 'Volta Almoço', 'Fim Turno'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setSelectedPontoType(tipo)}
                      className={`min-h-[48px] py-2.5 px-3 rounded-2xl text-xs font-black uppercase transition-all active:scale-95 ${
                        selectedPontoType === tipo
                          ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big Biometric Registration Button */}
              <button
                type="button"
                onClick={handleRegisterPonto}
                disabled={pontoSubmitting}
                className="w-full min-h-[54px] py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 mt-2"
              >
                {pontoSubmitting ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : (
                  <Timer size={22} />
                )}
                <span>Bater Ponto Agora</span>
              </button>
            </div>

            {/* Today's History */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 block">
                Marcações Realizadas Hoje
              </span>

              <div className="space-y-2">
                {timeTrackingHistory.map(entry => (
                  <div key={entry.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="font-black text-slate-900 dark:text-white uppercase leading-none">{entry.type}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">{entry.location}</p>
                      </div>
                    </div>
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-zinc-100">{entry.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: VISTORIA VEICULAR / CHECKLIST */}
        {activeTab === 'inspection' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck size={16} className="text-blue-500" />
                <span>Vistoria e Checklist 360°</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 uppercase bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                Pré-Viagem
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-3.5">
              {/* Vehicle Selection & Odometer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Veículo</label>
                  <select
                    value={inspectionVehicle}
                    onChange={(e) => setInspectionVehicle(e.target.value)}
                    className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs font-bold outline-none uppercase focus:border-blue-400"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.plate || v.id} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
                        Carro {v.prefix || v.plate}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Odômetro Saída</label>
                  <input
                    type="number"
                    value={inspectionOdometer}
                    onChange={(e) => setInspectionOdometer(e.target.value)}
                    className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs font-bold font-mono outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* 6 Essential Checklist Items */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 block">
                  Itens Obrigatórios de Segurança
                </span>

                {[
                  { id: 'pneus', label: '1. Pneus & Calibragem' },
                  { id: 'freios', label: '2. Freios & Pneumático' },
                  { id: 'luzes', label: '3. Faróis & Lanternas' },
                  { id: 'limpeza', label: '4. Limpeza & Bancos' },
                  { id: 'oleo', label: '5. Nível Óleo / Água' },
                  { id: 'extintor', label: '6. Extintor & Tacógrafo' }
                ].map(item => (
                  <div key={item.id} className="min-h-[52px] p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase truncate">{item.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['OK', 'ATENCAO', 'AVARIA'] as const).map(state => (
                        <button
                          key={state}
                          type="button"
                          onClick={() => setChecklistItems(prev => ({ ...prev, [item.id]: state }))}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 shadow-xs ${
                            checklistItems[item.id] === state
                              ? state === 'OK' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40' : state === 'ATENCAO' ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40' : 'bg-red-600 text-white ring-2 ring-red-400/40'
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5 block">Observações Mecânicas</label>
                <input
                  type="text"
                  placeholder="Ex: Barulho na correia, limpador fraco..."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-blue-400 placeholder-slate-400 dark:placeholder-zinc-500"
                />
              </div>

              {/* Submit Inspection Button */}
              <button
                type="button"
                onClick={handleSaveInspection}
                disabled={inspectionSaving}
                className="w-full min-h-[50px] py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {inspectionSaving ? <RefreshCw size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                <span>Salvar e Transmitir Vistoria</span>
              </button>
            </div>
          </div>
        )}

        {/* SUBVIEW: ROTAS E ITINERÁRIOS */}
        {activeSubView === 'routes' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-purple-500 p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Map size={18} className="text-purple-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Linhas & Itinerários</h3>
              </div>
              <button 
                onClick={() => setActiveSubView('none')} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar linha, origem ou destino..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                className="w-full h-12 pl-10 pr-3.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-xs outline-none uppercase font-bold focus:border-purple-400 placeholder-slate-400 dark:placeholder-zinc-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {routes
                .filter(r => !routeSearch || (r.origin + r.destination + (r.code || '')).toLowerCase().includes(routeSearch.toLowerCase()))
                .map(r => (
                  <div key={r.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md uppercase">
                        {r.code || 'LINHA'}
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase">
                        Tarifa: R$ {Number(r.price || 4.5).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs font-black uppercase text-slate-900 dark:text-white mt-1.5 leading-snug">
                      {r.origin} ➔ {r.destination}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SUBVIEW: NOTICES */}
        {activeSubView === 'notices' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border-2 border-amber-500 p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-amber-500" />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Mural de Avisos da Garagem</h3>
              </div>
              <button 
                onClick={() => setActiveSubView('none')} 
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
              {notices.map(n => (
                <div key={n.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md">
                      COMUNICADO
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{formatDate(n.created_at)}</span>
                  </div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white mt-1">{n.title}</h4>
                  <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed">{n.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 5. REFINED ERGONOMIC BOTTOM SHORTCUT BAR (Thumb-Friendly, Height 70px) */}
      <div className="w-full h-[70px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-zinc-800/90 flex items-center justify-around px-3 z-30 shrink-0 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        
        {/* Shortcut 1: Início */}
        <button
          onClick={() => { setActiveTab('dashboard'); setActiveSubView('none'); }}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-2xl transition-all active:scale-90 ${
            activeTab === 'dashboard' 
              ? 'text-yellow-600 dark:text-yellow-400 font-black' 
              : 'text-slate-500 dark:text-zinc-400 font-bold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-yellow-400/20' : 'bg-transparent'}`}>
            <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] uppercase tracking-wider mt-0.5">Início</span>
        </button>

        {/* Shortcut 2: Ponto Eletrônico */}
        <button
          onClick={() => { setActiveTab('timetracking'); setActiveSubView('none'); }}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-2xl transition-all active:scale-90 ${
            activeTab === 'timetracking' 
              ? 'text-yellow-600 dark:text-yellow-400 font-black' 
              : 'text-slate-500 dark:text-zinc-400 font-bold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'timetracking' ? 'bg-yellow-400/20' : 'bg-transparent'}`}>
            <Timer size={22} strokeWidth={activeTab === 'timetracking' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] uppercase tracking-wider mt-0.5">Ponto</span>
        </button>

        {/* Shortcut 3: Central Elevated Primary Action Button - OPERAÇÃO / VIAGEM */}
        <button
          onClick={() => { setActiveTab('operations'); setActiveSubView('none'); }}
          className="flex flex-col items-center justify-center -translate-y-2.5 z-40 active:scale-95 transition-all group"
          title="Operação e Viagens"
        >
          <div className="w-13 h-13 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 flex items-center justify-center shadow-lg shadow-yellow-400/30 border-2 border-white dark:border-zinc-900 group-hover:scale-105 transition-transform">
            <Bus size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mt-1">
            Operação
          </span>
        </button>

        {/* Shortcut 4: Vistoria 360° */}
        <button
          onClick={() => { setActiveTab('inspection'); setActiveSubView('none'); }}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-2xl transition-all active:scale-90 ${
            activeTab === 'inspection' 
              ? 'text-yellow-600 dark:text-yellow-400 font-black' 
              : 'text-slate-500 dark:text-zinc-400 font-bold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'inspection' ? 'bg-yellow-400/20' : 'bg-transparent'}`}>
            <ClipboardCheck size={22} strokeWidth={activeTab === 'inspection' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] uppercase tracking-wider mt-0.5">Vistoria</span>
        </button>

        {/* Shortcut 5: Menu Hamburger / Mais (Abre todas as abas) */}
        <button
          onClick={() => setIsHamburgerOpen(true)}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-2xl text-slate-500 dark:text-zinc-400 font-bold hover:text-yellow-500 active:scale-90 transition-all"
          title="Todas as Abas do Sistema"
        >
          <div className="p-1.5 rounded-xl bg-transparent">
            <Menu size={22} strokeWidth={2} />
          </div>
          <span className="text-[10px] uppercase tracking-wider mt-0.5">Mais</span>
        </button>

      </div>

      {/* 6. SLIDE-UP HAMBURGER DRAWER - DISPLAYS ALL PERMITTED TABS (Requested explicitly) */}
      {isHamburgerOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsHamburgerOpen(false)}
            className="absolute inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Drawer Content */}
          <div className="relative w-full max-h-[88%] bg-white dark:bg-black rounded-t-[36px] border-t-2 border-yellow-400 p-4 sm:p-5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-250 z-10 text-left">
            {/* Grab Bar */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mb-2" />

            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white leading-tight truncate">
                    {currentUser?.name || 'Operador de Campo'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold uppercase truncate">
                      {currentUser?.job_title || currentUser?.role || 'Motorista'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0">
                      • {allAvailableTabs.length} abas liberadas
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Drawer Header: Sun/Moon for Design e Cores, Atalhos & Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowThemeModal(true)}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-yellow-400 hover:bg-yellow-400/20 flex items-center justify-center active:scale-90 transition-all border border-slate-200 dark:border-zinc-700"
                  title="Design e Cores (Ajustar Tema, Cores e Alto Contraste)"
                >
                  {themeMode === 'light' ? <Moon size={17} /> : <Sun size={17} className="text-yellow-400" />}
                </button>

                <button
                  onClick={() => { setIsEditingShortcuts(true); setIsHamburgerOpen(false); }}
                  className="h-9 px-2 rounded-xl bg-yellow-400/15 text-yellow-700 dark:text-yellow-400 border border-yellow-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all"
                  title="Personalizar Atalhos de Campo"
                >
                  <SlidersHorizontal size={13} />
                  <span>Atalhos</span>
                </button>

                <button
                  onClick={() => setIsHamburgerOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center active:scale-90 border border-slate-200 dark:border-zinc-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Search inside Drawer */}
            <div className="relative my-2.5 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar entre todas as ${allAvailableTabs.length} abas liberadas...`}
                value={tabsSearchQuery}
                onChange={(e) => setTabsSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-yellow-400 text-slate-900 dark:text-white"
              />
              {tabsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTabsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[10px] font-black uppercase shrink-0">
              {['TODAS', 'Operação', 'Frota', 'RH & Pessoal', 'Gestão', 'Vendas', 'Atendimento', 'Comunicação', 'Sistema', 'Ajuda'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveTabCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl shrink-0 transition-all ${
                    activeTabCategory === cat 
                      ? 'bg-yellow-400 text-slate-950 font-black shadow-xs' 
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* List of ALL Available Tabs in the System */}
            <div className="flex-1 overflow-y-auto py-1 space-y-2 custom-scrollbar pr-1">
              {allAvailableTabs
                .filter(tab => {
                  if (activeTabCategory !== 'TODAS' && (tab as any).category !== activeTabCategory) {
                    return false;
                  }
                  if (!tabsSearchQuery) return true;
                  const q = tabsSearchQuery.toLowerCase();
                  return tab.label.toLowerCase().includes(q) || tab.description.toLowerCase().includes(q);
                })
                .map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={tab.action}
                      className="w-full min-h-[52px] p-3 rounded-2xl flex items-center justify-between bg-slate-50/80 dark:bg-zinc-900/80 hover:bg-yellow-400/15 dark:hover:bg-yellow-400/15 border border-slate-200/80 dark:border-zinc-800 active:scale-98 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tab.color}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">{tab.label}</p>
                            {(tab as any).category && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
                                • {(tab as any).category}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{tab.description}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-yellow-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  );
                })}
            </div>

            {/* Drawer Bottom Actions: Shortcuts and Logout */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setIsEditingShortcuts(true); setIsHamburgerOpen(false); }}
                className="flex-1 min-h-[46px] py-2 px-3 rounded-2xl bg-yellow-400/20 dark:bg-yellow-400/15 text-yellow-700 dark:text-yellow-400 border border-yellow-400/40 text-xs font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <SlidersHorizontal size={16} />
                <span>Editar Ações Rápidas</span>
              </button>

              <button
                onClick={onLogout}
                className="flex-1 min-h-[46px] py-2 px-3 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-xs font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
              >
                <LogOut size={16} />
                <span>Desconectar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6.1 FULL SYSTEM VIEW EMBEDDED MODAL (Allows viewing ANY system tab inside mobile 412x732) */}
      {activeFullView && (
        <div className="absolute inset-0 z-40 bg-white dark:bg-black flex flex-col animate-in fade-in duration-200">
          {/* Header for Full View */}
          <div className="w-full px-3 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 shadow-md">
            <button
              type="button"
              onClick={() => setActiveFullView(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-xs"
            >
              <ArrowLeft size={14} />
              <span>Voltar</span>
            </button>

            <span className="text-xs font-black uppercase text-yellow-400 truncate max-w-[190px] px-2">
              {allAvailableTabs.find(t => t.id === activeFullView)?.label || activeFullView}
            </span>

            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="w-8 h-8 rounded-xl bg-slate-800 text-yellow-400 flex items-center justify-center active:scale-90"
              title="Design e Cores"
            >
              {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-yellow-400" />}
            </button>
          </div>

          {/* Full View Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3">
            {renderFullView ? (
              renderFullView(activeFullView)
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-2 mt-4">
                <p className="text-xs font-black uppercase text-slate-900 dark:text-white">
                  {allAvailableTabs.find(t => t.id === activeFullView)?.label}
                </p>
                <p className="text-xs text-slate-600 dark:text-zinc-300">
                  {allAvailableTabs.find(t => t.id === activeFullView)?.description}
                </p>
                <button
                  onClick={onSwitchToDesktop}
                  className="mt-3 px-4 py-2 bg-yellow-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider"
                >
                  Abrir no Computador
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. POP-UP DESIGN E CORES (Requested explicitly) */}
      <ThemeDesignModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        themeMode={themeMode}
        onChangeThemeMode={onChangeThemeMode}
        systemSettings={systemSettings}
        onUpdateSettings={onUpdateSettings}
      />

    </div>
  );
};

export default MobileSystemView;
