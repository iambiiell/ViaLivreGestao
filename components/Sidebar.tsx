
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, Map, Calendar, LogOut, UsersRound, Building2, ShieldCheck, Bus, ClipboardList, MapPin, UserCircle, X, Menu, Bell, Sun, Moon, BusFront, BarChart, Wrench, Ticket, ClipboardCheck, Settings2, Timer, Banknote, Briefcase, HelpCircle, Headphones, Sparkles, ShieldAlert, Key, CreditCard, PlayCircle, DollarSign, Activity, Palette, Wifi, WifiOff, Cloud, CloudOff, RefreshCw, CheckCircle2, Pipette, Check, Layers, ChevronRight, Search, ArrowRight, User as UserIcon, AlertCircle, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState, User, ThemeMode, RoleConfig, SystemSettings, BusRoute, Vehicle, Notice, Trip, ImpCard } from '../types';
import { db, DbStatus, supabase } from '../services/database';
import { PRESET_THEME_COLORS, resolveThemeColors, isValidHexColor, applyThemeVariables } from '../utils/themeHelper';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  currentUser: User | null;
  userRoleConfig?: RoleConfig | null;
  onUpdateUser?: (user: User) => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  unreadNotificationsCount?: number;
  systemSettings?: SystemSettings | null;
  onUpdateSettings?: (settings: any) => void;
  onChangeThemeMode?: (theme: ThemeMode) => void;
  quickSearch?: string;
  onQuickSearchChange?: (val: string) => void;
  onOpenGuidedTour?: () => void;
  users?: User[];
  vehicles?: Vehicle[];
  routes?: BusRoute[];
  notices?: Notice[];
  trips?: Trip[];
  onEditProfile?: (user: User) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onChangeView, 
  onLogout, 
  isOpen, 
  onClose, 
  onToggle, 
  currentUser, 
  userRoleConfig, 
  themeMode, 
  onToggleTheme, 
  unreadNotificationsCount = 0, 
  systemSettings, 
  onUpdateSettings, 
  onChangeThemeMode, 
  quickSearch: controlledSearch, 
  onQuickSearchChange,
  onOpenGuidedTour,
  users = [],
  vehicles = [],
  routes = [],
  notices = [],
  trips = [],
  onEditProfile
}) => {
  const [showThemePopup, setShowThemePopup] = React.useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>(db.getStatus());
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('fluxo_session_sync_timestamp');
    return saved ? Number(saved) : (db.getStatus().lastSyncAt || Date.now());
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [userVtCard, setUserVtCard] = useState<ImpCard | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Formatar horário da última sincronização para exibição clara
  const lastSyncFormatted = useMemo(() => {
    const target = lastSyncTime || dbStatus.lastSyncAt;
    if (!target) return '';
    try {
      const d = new Date(target);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  }, [lastSyncTime, dbStatus.lastSyncAt]);

  // Synchronize Vale Transporte card balance for current logged-in employee by CPF
  const syncUserVtCard = async () => {
    if (!currentUser?.cpf) {
      setUserVtCard(null);
      return;
    }
    try {
      const cleanCpf = currentUser.cpf.replace(/\D/g, '');
      if (!cleanCpf) return;
      const cards = await db.getImpCards();
      const found = cards.find(c => (c.cpf || '').replace(/\D/g, '') === cleanCpf && !c.is_passenger_buyer) ||
                    cards.find(c => (c.cpf || '').replace(/\D/g, '') === cleanCpf);
      if (found) {
        setUserVtCard(found);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar saldo de VT do usuário:', err);
    }
  };

  useEffect(() => {
    syncUserVtCard();
    const handleUpdate = () => syncUserVtCard();
    window.addEventListener('vialivre-vt-card-updated', handleUpdate);
    window.addEventListener('vialivre-refresh-data', handleUpdate);
    const interval = setInterval(syncUserVtCard, 4000);
    return () => {
      window.removeEventListener('vialivre-vt-card-updated', handleUpdate);
      window.removeEventListener('vialivre-refresh-data', handleUpdate);
      clearInterval(interval);
    };
  }, [currentUser?.cpf]);

  const activeSearch = controlledSearch !== undefined ? controlledSearch : localSearch;

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    onQuickSearchChange?.(val);
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock background scroll when theme popup is active
  useBodyScrollLock(showThemePopup);

  useEffect(() => {
    const unsub = db.subscribeStatus((status) => {
      setDbStatus(status);
      if (status.lastSyncAt) {
        setLastSyncTime(status.lastSyncAt);
      }
    });

    const handleTimestampUpdate = (e: any) => {
      if (e.detail?.timestamp) {
        setLastSyncTime(e.detail.timestamp);
      } else {
        setLastSyncTime(Date.now());
      }
    };

    window.addEventListener('vialivre-sync-timestamp-updated', handleTimestampUpdate);
    window.addEventListener('vialivre-refresh-data', handleTimestampUpdate);

    return () => {
      unsub();
      window.removeEventListener('vialivre-sync-timestamp-updated', handleTimestampUpdate);
      window.removeEventListener('vialivre-refresh-data', handleTimestampUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    if (isRetryingSync) return;
    setIsRetryingSync(true);
    try {
      const syncResult = await db.syncPendingActions();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      window.dispatchEvent(new CustomEvent('vialivre-show-toast', {
        detail: { 
          message: syncResult.syncedCount > 0 
            ? `Sincronizado: ${syncResult.syncedCount} ações salvas` 
            : 'Sistema atualizado e sincronizado', 
          type: 'success' 
        }
      }));
    } catch (e: any) {
      console.warn('Erro ao atualizar banco de dados:', e);
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      window.dispatchEvent(new CustomEvent('vialivre-show-toast', {
        detail: { 
          message: 'Sistema atualizado', 
          type: 'success' 
        }
      }));
    } finally {
      setTimeout(() => setIsRetryingSync(false), 600);
    }
  };
  const allMenuItems = [
    { id: 'operation-center', label: 'CENTRO OPERACIONAL', icon: PlayCircle },
    { id: 'monitoring', label: 'MONITORAMENTO', icon: Activity },
    { id: 'dashboard', label: 'PAINEL GERAL', icon: LayoutDashboard, accessKey: 'access_dashboard' },
    { id: 'management', label: 'GESTÃO GLOBAL', icon: Briefcase, accessKey: 'access_global_management' },
    { id: 'skins', label: 'REPOSITÓRIO DE SKINS', icon: Bus, accessKey: 'access_skins' },
    { id: 'reports-view', label: 'RELATÓRIOS', icon: BarChart },
    { id: 'time-tracking', label: 'PONTO ELETRÔNICO', icon: Timer },
    { id: 'payroll', label: 'HOLERITES (RH)', icon: Banknote },
    { id: 'ticketing', label: 'GUICHÊ DE VENDAS', icon: Ticket, accessKey: 'access_sales' },
    { id: 'ticketing-config', label: 'GESTÃO GUICHÊ', icon: Settings2 },
    { id: 'notices', label: 'MURAL DE AVISOS', icon: Bell },
    { id: 'observations', label: 'OCORRÊNCIAS', icon: ClipboardList },
    { id: 'inspections', label: 'VISTORIAS', icon: ClipboardCheck },
    { id: 'maintenance', label: 'MANUTENÇÃO', icon: Wrench },
    { id: 'companies', label: 'EMPRESAS', icon: Building2 },
    { id: 'cities', label: 'MUNICÍPIOS', icon: MapPin },
    { id: 'bus-stations', label: 'RODOVIÁRIAS', icon: Building2 },
    { id: 'routes', label: 'ITINERÁRIOS', icon: Map },
    { id: 'schedule', label: 'ESCALA DE VIAGENS', icon: Calendar },
    { id: 'dispatcher', label: 'DESPACHANTE', icon: ShieldCheck, accessKey: 'access_dispatcher' },
    { id: 'sac', label: 'Vale Transporte', icon: Headphones },
    { id: 'work-with-us', label: 'TRABALHE CONOSCO', icon: Briefcase },
    { id: 'vehicles', label: 'FROTA DE ÔNIBUS', icon: Bus },
    { id: 'drivers', label: 'COLABORADORES', icon: UsersRound },
    { id: 'recruitment', label: 'RECRUTAMENTO (RH)', icon: Briefcase },
    { id: 'users', label: 'CONTROLE DE ACESSOS', icon: ShieldCheck },
    { id: 'subscriptions', label: 'ASSINATURAS (MASTER)', icon: ShieldAlert },
    { id: 'my-subscription', label: 'MINHA ASSINATURA', icon: CreditCard },
    { id: 'notifications', label: 'ALERTAS E AVISOS', icon: Bell },
    { id: 'guided-tour', label: 'TOURS GUIADOS', icon: Sparkles },
    { id: 'about', label: 'SOBRE O SISTEMA', icon: HelpCircle },
  ];

  const filteredItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (item.id === 'about' || item.id === 'guided-tour') return true;

      const isMasterEmail = currentUser?.email === 'suporte@vialivre.com.br' || currentUser?.email === 'consorcio.imperial.ltda@gmail.com';

      // Case-insensitive role and job title check
      const userRole = (currentUser?.role || '').toUpperCase();
      const userJob = (currentUser?.job_title || '').toUpperCase();
      const isFullAdmin = userRole === 'ADMIN' || currentUser?.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
      const isFiscal = userRole === 'FISCAL' || userJob.includes('FISCAL');
      const isOperationEligible = 
        isFullAdmin || 
        isFiscal ||
        userRole === 'DRIVER' || 
        userRole === 'CONDUCTOR' ||
        userJob.includes('MOTORISTA') || 
        userJob.includes('COBRADOR');

      if (item.id === 'operation-center') {
        return isOperationEligible;
      }

      if (item.id === 'subscriptions') {
        return isFullAdmin || isMasterEmail || currentUser?.email === 'via.nicolau.sa@gmail.com';
      }

      if (item.id === 'dashboard') {
        return isFullAdmin;
      }

      if (item.id === 'my-subscription') {
        return isFullAdmin;
      }

      if (isFullAdmin) return true;

      // Always allow time-tracking, notices, sac, notifications, work-with-us and about for all logged-in workers
      if (['time-tracking', 'notices', 'sac', 'notifications', 'work-with-us', 'about'].includes(item.id)) {
        return true;
      }

      // Check role-based access booleans
      if (userRoleConfig && (item as any).accessKey) {
        const key = (item as any).accessKey;
        if ((userRoleConfig as any)[key] === true) return true;
        if ((userRoleConfig as any)[key] === false) return false;
      }

      if (currentUser?.permissions && currentUser.permissions.length > 0) {
        if (currentUser.permissions.includes(item.id as ViewState)) return true;
      }

      if (userRoleConfig?.permissions && userRoleConfig.permissions.length > 0) {
        if (userRoleConfig.permissions.includes(item.id as ViewState)) return true;
      }

      // Fallback to role-based logic
      const legacyRoles: Record<string, string[]> = {
        'operation-center': ['ADMIN', 'DRIVER', 'CONDUCTOR', 'FISCAL', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'dashboard': ['ADMIN'],
        'management': ['ADMIN', 'RH'],
        'monitoring': ['ADMIN', 'FISCAL', 'DESPACHANTE'],
        'reports-view': ['ADMIN', 'FISCAL', 'RH'],
        'time-tracking': ['ADMIN', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'FISCAL', 'TICKET_AGENT', 'RH', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'payroll': ['ADMIN', 'RH'],
        'ticketing': ['ADMIN', 'TICKET_AGENT', 'CONDUCTOR', 'Cobrador', 'COBRADOR', 'Agente de Guichê'],
        'ticketing-config': ['ADMIN'],
        'notices': ['ADMIN', 'RH', 'DRIVER', 'CONDUCTOR', 'FISCAL', 'MECHANIC', 'TICKET_AGENT', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'observations': ['ADMIN', 'MECHANIC', 'DRIVER', 'CONDUCTOR', 'FISCAL', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'inspections': ['ADMIN', 'MECHANIC', 'FISCAL', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'maintenance': ['ADMIN', 'MECHANIC'],
        'companies': ['ADMIN'],
        'cities': ['ADMIN'],
        'bus-stations': ['ADMIN'],
        'routes': ['ADMIN', 'FISCAL'],
        'schedule': ['ADMIN', 'FISCAL', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'dispatcher': ['ADMIN', 'FISCAL', 'DESPACHANTE'],
        'shifts': ['ADMIN', 'RH'],
        'vehicles': ['ADMIN', 'MECHANIC', 'FISCAL'],
        'drivers': ['ADMIN', 'RH'],
        'recruitment': ['ADMIN', 'RH'],
        'skins': ['ADMIN', 'FISCAL', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'users': ['ADMIN'],
        'sac': ['ADMIN', 'FISCAL', 'TICKET_AGENT', 'RH', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'work-with-us': ['ADMIN', 'RH', 'FISCAL', 'TICKET_AGENT', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'notifications': ['ADMIN', 'RH', 'FISCAL', 'MECHANIC', 'TICKET_AGENT', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
        'about': ['ADMIN', 'RH', 'FISCAL', 'MECHANIC', 'TICKET_AGENT', 'DRIVER', 'CONDUCTOR', 'PASSENGER']
      };

      return legacyRoles[item.id]?.some(r => {
        const rUpper = r.toUpperCase();
        return rUpper === userRole || userRole.includes(rUpper) || userJob.includes(rUpper);
      }) || false;
    }).sort((a, b) => {
      // Custom sort: dashboard first, then operation-center, about last, others alphabetical
      if (a.id === 'dashboard') return -1;
      if (b.id === 'dashboard') return 1;
      if (a.id === 'operation-center') return -1;
      if (b.id === 'operation-center') return 1;
      if (a.id === 'about') return 1;
      if (b.id === 'about') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [currentUser, userRoleConfig]);

  const query = (activeSearch || '').trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!query) return null;

    // 1. Menus e Telas acessíveis
    const matchedMenus = filteredItems.filter(item => 
      item.label.toLowerCase().includes(query) || 
      item.id.toLowerCase().includes(query)
    ).slice(0, 5);

    // 2. Colaboradores / Motoristas / Usuários
    const matchedUsers = (users || []).filter(u => 
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.registration_id && u.registration_id.toLowerCase().includes(query)) ||
      (u.job_title && u.job_title.toLowerCase().includes(query)) ||
      (u.role && u.role.toLowerCase().includes(query)) ||
      (u.cpf && u.cpf.toLowerCase().includes(query))
    ).slice(0, 6);

    // 3. Frota / Veículos
    const matchedVehicles = (vehicles || []).filter(v => 
      (v.plate && v.plate.toLowerCase().includes(query)) ||
      (v.prefix && v.prefix.toLowerCase().includes(query)) ||
      (v.model && v.model.toLowerCase().includes(query)) ||
      (v.type && v.type.toLowerCase().includes(query))
    ).slice(0, 6);

    // 4. Linhas e Itinerários
    const matchedRoutes = (routes || []).filter(r => 
      (r.code && r.code.toLowerCase().includes(query)) ||
      (r.name && r.name.toLowerCase().includes(query)) ||
      (r.origin && r.origin.toLowerCase().includes(query)) ||
      (r.destination && r.destination.toLowerCase().includes(query))
    ).slice(0, 5);

    // 5. Avisos
    const matchedNotices = (notices || []).filter(n => 
      (n.title && n.title.toLowerCase().includes(query)) ||
      (n.content && n.content.toLowerCase().includes(query))
    ).slice(0, 4);

    const totalMatches = matchedMenus.length + matchedUsers.length + matchedVehicles.length + matchedRoutes.length + matchedNotices.length;

    return {
      menus: matchedMenus,
      users: matchedUsers,
      vehicles: matchedVehicles,
      routes: matchedRoutes,
      notices: matchedNotices,
      totalMatches
    };
  }, [query, filteredItems, users, vehicles, routes, notices]);

  const handleSelectSearchResult = (type: 'menu' | 'user' | 'vehicle' | 'route' | 'notice', item: any) => {
    setIsSearchFocused(false);
    setShowMobileSearch(false);
    handleSearchChange('');

    const userRole = (currentUser?.role || '').toUpperCase();
    const isFullAdmin = userRole === 'ADMIN' || currentUser?.is_full_admin;

    if (type === 'menu') {
      onChangeView(item.id as ViewState);
    } else if (type === 'user') {
      if (isFullAdmin || userRole === 'RH') {
        onChangeView('drivers');
      } else {
        onChangeView('time-tracking');
      }
      window.dispatchEvent(new CustomEvent('vialivre-select-user', { detail: item }));
    } else if (type === 'vehicle') {
      onChangeView('vehicles');
      window.dispatchEvent(new CustomEvent('vialivre-select-vehicle', { detail: item }));
    } else if (type === 'route') {
      onChangeView('routes');
      window.dispatchEvent(new CustomEvent('vialivre-select-route', { detail: item }));
    } else if (type === 'notice') {
      onChangeView('notices');
    }
  };

  return (
    <>
    <div className={`w-full h-12 sm:h-14 shadow-sm z-40 flex items-center justify-between px-2 sm:px-10 border-b transition-all duration-300 ${
      systemSettings?.glass_effect !== false 
        ? 'glass-panel !border-b !border-white/80 dark:!border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.06)]' 
        : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-center gap-1 sm:gap-8">
        <button id="tour-menu-toggle" onClick={onToggle} className="p-1.5 sm:p-2 rounded-2xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 transition-all flex"><Menu size={18} className="sm:w-5 sm:h-5" /></button>
        <div id="tour-logo" className="flex items-center gap-1.5 sm:gap-3">
            <div className="logo-sistema h-7 sm:h-9 flex items-center justify-center transition-all">
                <img 
                  src="https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png" 
                  className="h-full w-auto object-contain" 
                  alt="ViaLivre Gestão" 
                  referrerPolicy="no-referrer" 
                />
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tighter text-slate-950 dark:text-white uppercase italic leading-none transition-colors">
              {systemSettings?.system_name ? (
                (systemSettings.system_name.includes('Viação Nicolau S/A') || 
                 systemSettings.system_name.includes('Grupo D\'Rio') || 
                 systemSettings.system_name.toLowerCase().includes('vialivre')) ? (
                  <>Via<span className="text-yellow-500">Livre</span> Gestão</>
                ) : (
                  systemSettings.system_name
                )
              ) : (
                <>Via<span className="text-yellow-500">Livre</span> Gestão</>
              )}
            </h1>
        </div>
      </div>

      {/* Top Quick Search Bar Desktop */}
      <div id="tour-search-bar" ref={searchContainerRef} className="hidden md:flex items-center flex-1 mx-3 lg:mx-6 relative">
        <motion.div 
          layout
          animate={{ 
            maxWidth: isSearchFocused ? '32rem' : '22rem',
            scale: isSearchFocused ? 1.01 : 1
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="w-full relative"
        >
          <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${isSearchFocused ? 'text-yellow-500' : 'text-slate-400 dark:text-zinc-500'}`} />
          <input 
            type="text"
            placeholder="Busca rápida: colaborador, veículo ou linha..."
            value={activeSearch}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsSearchFocused(false);
              } else if (e.key === 'Enter' && searchResults && searchResults.totalMatches > 0) {
                if (searchResults.menus.length > 0) {
                  handleSelectSearchResult('menu', searchResults.menus[0]);
                } else if (searchResults.users.length > 0) {
                  handleSelectSearchResult('user', searchResults.users[0]);
                } else if (searchResults.vehicles.length > 0) {
                  handleSelectSearchResult('vehicle', searchResults.vehicles[0]);
                } else if (searchResults.routes.length > 0) {
                  handleSelectSearchResult('route', searchResults.routes[0]);
                }
              }
            }}
            className={`w-full pl-9 pr-8 py-2 bg-slate-100/90 dark:bg-zinc-900/90 rounded-xl text-[11px] font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all uppercase border-2 ${
              isSearchFocused 
                ? 'border-yellow-400 ring-2 ring-yellow-400/20 bg-white dark:bg-zinc-950 shadow-md' 
                : 'border-slate-200/80 dark:border-zinc-800'
            }`}
          />
          {activeSearch && (
            <button 
              onClick={() => handleSearchChange('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full"
              title="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </motion.div>

        {/* Live Search Results Dropdown */}
        {isSearchFocused && activeSearch.trim().length > 0 && (
          <div className="absolute top-full mt-2 left-0 w-full min-w-[360px] max-w-[480px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[70vh] flex flex-col">
            <div className="p-3 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/70 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                Resultados para "{activeSearch}" ({searchResults?.totalMatches || 0})
              </span>
              <span className="text-[9px] text-slate-400 font-bold">ESC para fechar</span>
            </div>

            <div className="overflow-y-auto p-2 space-y-3 custom-scrollbar">
              {searchResults && searchResults.totalMatches === 0 && (
                <div className="p-6 text-center text-slate-400 dark:text-zinc-500">
                  <Search size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-black uppercase">Nenhum resultado encontrado</p>
                  <p className="text-[10px] mt-1 font-medium">Tente buscar por nome, cargo, matrícula, placa, modelo ou linha.</p>
                </div>
              )}

              {/* Módulos */}
              {searchResults && searchResults.menus.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2.5 py-1 block">
                    Telas e Módulos
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.menus.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectSearchResult('menu', m)}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-yellow-400/15 dark:hover:bg-yellow-400/10 text-left group transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-400 group-hover:text-slate-950 transition-all">
                              <Icon size={14} />
                            </div>
                            <span className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200">{m.label}</span>
                          </div>
                          <ArrowRight size={12} className="text-slate-400 group-hover:text-yellow-500 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colaboradores */}
              {searchResults && searchResults.users.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2.5 py-1 block">
                    Colaboradores ({searchResults.users.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectSearchResult('user', u)}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 font-black text-[10px] shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                            ) : (
                              u.name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">{u.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {u.job_title || u.role} {u.registration_id ? `• Matrícula: ${u.registration_id}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md uppercase shrink-0">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Veículos */}
              {searchResults && searchResults.vehicles.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2.5 py-1 block">
                    Frota & Veículos ({searchResults.vehicles.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.vehicles.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleSelectSearchResult('vehicle', v)}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            <Bus size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">
                              Prefixo {v.prefix || v.plate}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {v.model} • Placa: {v.plate}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0 ${
                          v.status === 'ATIVO' || (v.status as any) === 'OPERATING' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {v.status || 'ATIVO'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Linhas */}
              {searchResults && searchResults.routes.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2.5 py-1 block">
                    Linhas & Itinerários ({searchResults.routes.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.routes.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectSearchResult('route', r)}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Map size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">
                              {r.code} - {r.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {r.origin} ➔ {r.destination}
                            </p>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-slate-400 group-hover:text-yellow-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Avisos */}
              {searchResults && searchResults.notices.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2.5 py-1 block">
                    Avisos & Comunicados ({searchResults.notices.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.notices.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleSelectSearchResult('notice', n)}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                            <Bell size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">{n.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{n.content}</p>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-slate-400 group-hover:text-yellow-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Search Button */}
        <button
          onClick={() => setShowMobileSearch(true)}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          title="Buscar no sistema"
        >
          <Search size={18} />
        </button>

        <button id="tour-notifications" onClick={() => onChangeView('notifications')} className="p-2 sm:p-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 rounded-2xl transition-all relative" title="Notificações">
          <Bell size={20} className="sm:w-5 sm:h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[8px] sm:text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 animate-bounce">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>
        <button id="tour-theme-toggle" onClick={() => setShowThemePopup(true)} className="p-2 sm:p-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 rounded-2xl transition-all" title="Preferências de Design e Cores">
          {themeMode === 'light' ? <Moon size={20} className="sm:w-5 sm:h-5" /> : <Sun size={20} className="text-yellow-400 sm:w-5 sm:h-5" />}
        </button>
        <button 
          id="tour-help-btn"
          onClick={() => onOpenGuidedTour?.()} 
          className="p-2 sm:p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-400/10 rounded-2xl transition-all relative group" 
          title="Tours Guiados & Ajuda Interativa"
        >
          <Sparkles size={20} className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
        </button>

        {/* Vale Transporte do Colaborador / Usuário Sincronizado por CPF */}
        {userVtCard && (
          <div 
            onClick={() => onChangeView('sac')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer shadow-sm"
            title={`Cartão Vale Transporte: ${userVtCard.card_number || userVtCard.name} • Saldo: R$ ${Number(userVtCard.balance || 0).toFixed(2)} (Clique para SAC)`}
          >
            <CreditCard size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-black uppercase tracking-tight">
              VT: R$ {Number(userVtCard.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {currentUser && (() => {
            const isAdmin = currentUser.role === 'ADMIN' || currentUser.is_full_admin || currentUser.job_title?.toUpperCase().includes('ADMINISTRADOR');
            return (
              <div 
                id="tour-user-profile" 
                onClick={() => {
                  if (isAdmin && onEditProfile) {
                    onEditProfile(currentUser);
                  }
                }}
                className={`flex items-center gap-2 sm:gap-3 pr-1 sm:pr-2 py-1 rounded-2xl transition-all ${isAdmin ? 'hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 cursor-pointer group' : 'cursor-default'}`}
                title={isAdmin ? "Clique para editar seu perfil de Administrador" : `Perfil: ${currentUser.full_name}`}
              >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-yellow-400 flex items-center justify-center border-2 border-white dark:border-zinc-800 overflow-hidden shadow-sm transition-colors relative">
                      {currentUser.photo_url ? <img src={currentUser.photo_url} className="w-full h-full object-cover" alt="Perfil"/> : <UserCircle size={20} className="text-white sm:w-5 sm:h-5"/>}
                      {isAdmin && (
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Pencil size={12} />
                        </div>
                      )}
                  </div>
                  <div className="hidden md:block text-left">
                      <p className="text-[10px] font-black uppercase text-slate-950 dark:text-zinc-100 leading-none flex items-center gap-1">
                        {currentUser.full_name?.split(' ')[0]}
                        {isAdmin && <Pencil size={10} className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </p>
                      <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mt-1">
                        {currentUser.role === 'RH' ? 'REC. HUMANOS' : 
                         isAdmin ? 'ADMINISTRADOR' : 
                         currentUser.role}
                      </p>
                  </div>
              </div>
            );
        })()}
        <div className="w-px h-6 sm:h-6 bg-slate-200 dark:bg-zinc-800 mx-1 sm:mx-2 hidden sm:block"></div>
        <button onClick={onLogout} className="p-2 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all" title="Sair do Sistema"><LogOut size={20} className="sm:w-5 sm:h-5" /></button>
      </div>
    </div>

    {createPortal(
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 w-screen h-screen bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-[9998] cursor-pointer"
              onClick={onClose}
            />

            {/* Lateral Drawer - 80% width on mobile */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -300) {
                  onClose();
                }
              }}
              className={`fixed inset-y-0 left-0 w-[80vw] sm:w-[80vw] md:w-[320px] max-w-[380px] h-screen shadow-2xl z-[9999] border-r flex flex-col ${
                systemSettings?.glass_effect !== false 
                  ? 'glass-panel !rounded-none !border-r !border-y-0 !border-l-0 !border-white/80 dark:!border-white/10 shadow-[25px_0_60px_rgba(0,0,0,0.25)]' 
                  : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'
              } transition-colors select-none`}
            >
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-5 sm:px-6 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="logo-sistema w-9 h-9 flex items-center justify-center overflow-hidden shrink-0 rounded-xl bg-yellow-400/10 dark:bg-yellow-400/20 p-1 border border-yellow-400/30">
                    {systemSettings?.system_logo ? (
                      <img 
                        src={systemSettings.system_logo} 
                        className="h-full w-auto object-contain" 
                        alt="Logo" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            const span = document.createElement('span');
                            span.className = 'text-[9px] font-black uppercase italic text-slate-900 dark:text-white';
                            span.innerText = systemSettings?.system_name?.[0] || 'V';
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <BusFront size={22} className="text-yellow-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block font-black text-[12px] tracking-tight uppercase text-slate-950 dark:text-white italic truncate leading-tight">
                      {(systemSettings?.system_name?.includes('Viação Nicolau S/A') || systemSettings?.system_name?.includes('Grupo D\'Rio') || systemSettings?.system_name?.includes('ViaLivre')) ? 'ViaLivre Gestão' : (systemSettings?.system_name || 'ViaLivre Gestão')}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block truncate">
                      Menu Principal
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={onClose} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                  title="Fechar Menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drag Handle Indicator for Mobile */}
              <div className="flex items-center justify-center py-1.5 bg-slate-100/40 dark:bg-zinc-900/30 sm:hidden">
                <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full" />
              </div>

              {/* Menu Items List */}
              <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => { 
                        if (item.id === 'guided-tour') {
                          onOpenGuidedTour?.();
                          onClose();
                        } else {
                          onChangeView(item.id as any); 
                          onClose(); 
                        }
                      }} 
                      className={`w-full flex items-center justify-between px-4 py-3 sm:py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all group ${
                        isActive 
                          ? 'bg-yellow-400 text-slate-950 shadow-md ring-2 ring-yellow-400/40' 
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100/80 dark:hover:bg-zinc-900/80 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isActive ? 'bg-slate-950 text-yellow-400' : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 group-hover:bg-yellow-400/20 group-hover:text-yellow-600'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && (
                        <ChevronRight size={14} className="text-slate-950 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 transition-colors shrink-0 space-y-2.5">
                {currentUser && (() => {
                  const isAdmin = currentUser.role === 'ADMIN' || currentUser.is_full_admin || currentUser.job_title?.toUpperCase().includes('ADMINISTRADOR');
                  return (
                    <div 
                      onClick={() => {
                        if (isAdmin && onEditProfile) {
                          onClose();
                          onEditProfile(currentUser);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60 shadow-sm transition-all ${isAdmin ? 'hover:border-blue-500 cursor-pointer group' : 'cursor-default'}`}
                      title={isAdmin ? "Clique para editar seu perfil de Administrador" : ""}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                          {currentUser.photo_url ? (
                            <img src={currentUser.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserCircle size={20} className="text-slate-950" />
                          )}
                          {isAdmin && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Pencil size={12} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-slate-950 dark:text-white uppercase truncate leading-tight flex items-center gap-1">
                            {currentUser.full_name || currentUser.name || 'Usuário'}
                            {isAdmin && <Pencil size={10} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </p>
                          <p className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider truncate">
                            {currentUser.role === 'RH' ? 'REC. HUMANOS' : 
                             isAdmin ? 'ADMINISTRADOR' : 
                             (currentUser.job_title || currentUser.role)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onLogout();
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 dark:bg-rose-950/40 transition-all shrink-0 active:scale-95"
                        title="Desconectar da conta"
                      >
                        <LogOut size={16} />
                      </button>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      const phone = systemSettings?.support_phone?.replace(/\D/g, '') || '5524978358199';
                      const name = systemSettings?.system_name || 'ViaLivre Gestão';
                      window.open(`https://wa.me/${phone}?text=Olá,%20preciso%20de%20suporte%20no%20sistema%20${encodeURIComponent(name)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 bg-slate-900 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-700 text-white rounded-xl font-black uppercase text-[9px] tracking-wider shadow-sm transition-all active:scale-95"
                  >
                    <HelpCircle size={14} className="text-yellow-400" />
                    <span>Suporte</span>
                  </button>

                  <button 
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[9px] tracking-wider shadow-sm transition-all active:scale-95"
                  >
                    <LogOut size={14} />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

    <AnimatePresence>
      {showThemePopup && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-hidden overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowThemePopup(false);
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`w-full max-w-md rounded-[2.5rem] shadow-2xl border-4 border-yellow-400 p-6 sm:p-7 relative max-h-[90vh] flex flex-col ${
              systemSettings?.glass_effect !== false 
                ? 'glass-panel text-slate-950 dark:text-zinc-100' 
                : 'bg-white dark:bg-zinc-900 text-slate-950 dark:text-zinc-100'
            }`}
          >
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <Palette className="text-yellow-400 animate-pulse" size={24} />
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-950 dark:text-white">Design e Cores</h2>
            </div>
            <button onClick={() => setShowThemePopup(false)} className="p-1.5 bg-slate-50 dark:bg-zinc-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="mt-5 space-y-6 overflow-y-auto custom-scrollbar flex-1 modal-scroll-container pr-1">
            {/* Theme Preset Toggles */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Aparência do Painel</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('light')}
                  className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'light' ? 'border-yellow-400 bg-yellow-50/20 text-slate-900' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200'}`}
                >
                  <Sun size={16} className={themeMode === 'light' ? 'text-yellow-500' : ''} />
                  Modo Claro
                </button>
                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('dark')}
                  className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'dark' ? 'border-yellow-400 bg-yellow-400/10 text-white animate-pulse' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-800'}`}
                >
                  <Moon size={16} className={themeMode === 'dark' ? 'text-yellow-400' : ''} />
                  Modo Escuro
                </button>
              </div>
            </div>

            {/* Glassmorphism Effect Option */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Efeito de Vidro (Glassmorphism)</label>
              <button 
                type="button" 
                id="sidebar-toggle-glass-btn"
                onClick={() => {
                  if (onUpdateSettings) {
                    const isCurrentlyGlass = systemSettings?.glass_effect !== false;
                    onUpdateSettings({
                      ...(systemSettings || {
                        id: 'sys-set-001',
                        system_id: 'sys-vialivre-default',
                        system_name: 'ViaLivre Gestão',
                        company_name: 'ViaLivre Gestão',
                        registration_pattern: 'FLX-000',
                        theme_color: 'yellow',
                        glass_effect: true,
                        support_email: 'via.nicolau.sa@gmail.com'
                      }),
                      glass_effect: !isCurrentlyGlass
                    });
                  }
                }}
                className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-between w-full cursor-pointer select-none ${
                  systemSettings?.glass_effect !== false 
                    ? 'border-yellow-400 bg-yellow-400/10 text-slate-950 dark:text-yellow-400 font-black shadow-sm ring-2 ring-yellow-400/20' 
                    : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/50'
                }`}
              >
                <span className="flex items-center gap-2 font-black">
                  <Layers size={16} className={systemSettings?.glass_effect !== false ? 'text-yellow-400 animate-pulse' : 'text-slate-400'} />
                  Efeito Translúcido (Vidro)
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                    systemSettings?.glass_effect !== false 
                      ? 'bg-yellow-400 text-slate-950 border border-slate-950' 
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}>
                    {systemSettings?.glass_effect !== false ? 'Ativado' : 'Desativado'}
                  </span>
                  <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
                    systemSettings?.glass_effect !== false ? 'bg-yellow-400 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                  }`}>
                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
              </button>
              <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">
                Aplica acabamento translúcido e bordas de sobreposição em todo o sistema.
              </p>
            </div>

            {/* Accessibility Options */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Acessibilidade</label>
              <button 
                type="button" 
                onClick={() => {
                  if (systemSettings && onUpdateSettings) {
                    onUpdateSettings({ ...systemSettings, high_contrast: !systemSettings.high_contrast });
                  }
                }}
                className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-between w-full ${systemSettings?.high_contrast ? 'border-yellow-400 bg-yellow-400/10 text-slate-950 dark:text-yellow-400 font-black' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200 bg-transparent'}`}
              >
                <span className="flex items-center gap-2 font-black">
                  <span className="w-4 h-4 rounded-full border-2 border-current bg-transparent flex items-center justify-center text-[8px] font-black">A</span>
                  Alto Contraste
                </span>
                <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${systemSettings?.high_contrast ? 'bg-yellow-400 text-slate-950 border border-slate-950' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                  {systemSettings?.high_contrast ? 'Ativado' : 'Desativado'}
                </span>
              </button>
              <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">Melhora a legibilidade do sistema para motoristas em ambientes externos sob luz solar direta.</p>
            </div>

            {/* Accent Color Palette & Custom Primary Color Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Cor Primária do Sistema</label>
                {systemSettings?.theme_color && (
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                    {resolveThemeColors(systemSettings.theme_color).hex}
                  </span>
                )}
              </div>

              {/* Seletor de Cor Personalizada via Color Picker nativo */}
              <div className="p-3 mb-3 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      value={resolveThemeColors(systemSettings?.theme_color).hex}
                      onChange={(e) => {
                        const newColor = e.target.value.toLowerCase();
                        applyThemeVariables(newColor);
                        if (onUpdateSettings) {
                          onUpdateSettings({
                            ...(systemSettings || {
                              id: 'sys-set-001',
                              system_id: db.getSystemId() || 'sys-vialivre-default',
                              system_name: 'ViaLivre Gestão',
                              company_name: 'ViaLivre Gestão',
                              registration_pattern: 'FLX-000',
                              theme_color: 'yellow',
                              glass_effect: true,
                              support_email: 'via.nicolau.sa@gmail.com'
                            }),
                            theme_color: newColor
                          });
                        }
                      }}
                      className="w-9 h-9 rounded-xl border-2 border-white dark:border-zinc-700 cursor-pointer shadow-md bg-transparent p-0 overflow-hidden"
                      title="Escolher qualquer cor primária personalizada"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase text-slate-800 dark:text-zinc-200 truncate">Cor Personalizada</p>
                    <p className="text-[8px] font-mono text-slate-400">Clique para abrir o seletor</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="#FACC15"
                    value={resolveThemeColors(systemSettings?.theme_color).isCustom ? (systemSettings?.theme_color || '') : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') && (isValidHexColor(val) || val.length === 4 || val.length === 7)) {
                        const newColor = val.toLowerCase();
                        applyThemeVariables(newColor);
                        if (onUpdateSettings) {
                          onUpdateSettings({
                            ...(systemSettings || {
                              id: 'sys-set-001',
                              system_id: db.getSystemId() || 'sys-vialivre-default',
                              system_name: 'ViaLivre Gestão',
                              company_name: 'ViaLivre Gestão',
                              registration_pattern: 'FLX-000',
                              theme_color: 'yellow',
                              glass_effect: true,
                              support_email: 'via.nicolau.sa@gmail.com'
                            }),
                            theme_color: newColor
                          });
                        }
                      }
                    }}
                    className="w-20 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-[10px] font-mono font-bold uppercase text-center dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
              </div>

              {/* Lista de Cores Pré-definidas */}
              <div className="grid grid-cols-1 gap-2 max-h-[190px] overflow-y-auto pr-1">
                {PRESET_THEME_COLORS.map(palette => {
                  const currentTheme = systemSettings?.theme_color || 'yellow';
                  const isSelected = currentTheme === palette.id || currentTheme.toLowerCase() === palette.primary.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={palette.id}
                      onClick={() => {
                        applyThemeVariables(palette.id);
                        if (onUpdateSettings) {
                          onUpdateSettings({
                            ...(systemSettings || {
                              id: 'sys-set-001',
                              system_id: db.getSystemId() || 'sys-vialivre-default',
                              system_name: 'ViaLivre Gestão',
                              company_name: 'ViaLivre Gestão',
                              registration_pattern: 'FLX-000',
                              theme_color: 'yellow',
                              glass_effect: true,
                              support_email: 'via.nicolau.sa@gmail.com'
                            }),
                            theme_color: palette.id
                          });
                        }
                      }}
                      className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-between w-full ${
                        isSelected 
                          ? 'border-yellow-400 bg-slate-50 dark:bg-zinc-800/50 shadow-sm' 
                          : 'border-slate-100 dark:border-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-4 h-4 rounded-full shadow-sm border border-black/10 shrink-0" 
                          style={{ backgroundColor: palette.primary }} 
                        />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">{palette.name}</span>
                      </div>
                      {isSelected ? (
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#eab308] dark:text-yellow-400 px-2 py-0.5 bg-yellow-400/10 rounded-md flex items-center gap-1">
                          <Check size={10} /> Ativo
                        </span>
                      ) : (
                        <span className="text-[8px] font-mono text-slate-400">{palette.primary}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-3 leading-tight text-center">
                Muda as cores primárias globalmente de forma instantânea para toda a interface do sistema.
              </p>
            </div>
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Mobile Quick Search Overlay Modal */}
    <AnimatePresence>
      {showMobileSearch && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex flex-col p-4 md:hidden">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] w-full mt-4">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
              <Search size={18} className="text-yellow-500 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar colaborador, veículo, linha..."
                value={activeSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none uppercase"
              />
              {activeSearch && (
                <button onClick={() => handleSearchChange('')} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
              <button 
                onClick={() => setShowMobileSearch(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-red-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar flex-1">
              {searchResults && searchResults.totalMatches === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-zinc-500">
                  <Search size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-black uppercase">Nenhum resultado</p>
                  <p className="text-[10px] mt-1">Nenhum item corresponde à pesquisa "{activeSearch}".</p>
                </div>
              )}

              {/* Módulos */}
              {searchResults && searchResults.menus.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2 block">
                    Telas e Módulos
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.menus.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectSearchResult('menu', m)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-yellow-400/15 dark:hover:bg-yellow-400/10 text-left transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-yellow-400/20 text-yellow-600 dark:text-yellow-400">
                              <Icon size={16} />
                            </div>
                            <span className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200">{m.label}</span>
                          </div>
                          <ArrowRight size={14} className="text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colaboradores */}
              {searchResults && searchResults.users.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2 block">
                    Colaboradores ({searchResults.users.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectSearchResult('user', u)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 font-black text-xs shrink-0">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">{u.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.job_title || u.role}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md uppercase shrink-0">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Veículos */}
              {searchResults && searchResults.vehicles.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2 block">
                    Frota & Veículos ({searchResults.vehicles.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.vehicles.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleSelectSearchResult('vehicle', v)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                            <Bus size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">Prefixo {v.prefix || v.plate}</p>
                            <p className="text-[10px] text-slate-400 truncate">{v.model} • {v.plate}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase bg-emerald-500/10 text-emerald-600 shrink-0">
                          {v.status || 'ATIVO'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Linhas */}
              {searchResults && searchResults.routes.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest px-2 block">
                    Linhas & Itinerários ({searchResults.routes.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {searchResults.routes.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectSearchResult('route', r)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                            <Map size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase">{r.code} - {r.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{r.origin} ➔ {r.destination}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Sidebar;
