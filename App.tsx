
import React, { Component, useState, useEffect, useCallback, ErrorInfo, ReactNode, useRef } from 'react';
import { Loader2, BusFront, X, AlertTriangle, CheckCircle2, Coffee, Sparkles, AlertCircle, RefreshCw, Zap, ChevronRight, Home, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Topbar from './components/Sidebar'; 
import Dashboard from './components/Dashboard';
import TripSchedule from './components/TripSchedule';
import LoginScreen from './components/LoginScreen';
import RouteManager from './components/RouteManager';
import DriverManager from './components/DriverManager';
import CompanyManager from './components/CompanyManager';
import UserManager from './components/UserManager';
import VehicleManager from './components/VehicleManager';
import ObservationManager from './components/ObservationManager';
import CityManager from './components/CityManager';
import BusStationManager from './components/BusStationManager';
import NoticeManager from './components/NoticeManager';
import ReportManager from './components/ReportManager';
import MaintenanceManager from './components/MaintenanceManager';
import TicketAgentInterface from './components/TicketAgentInterface';
import InspectionManager from './components/InspectionManager';
import TicketingConfigManager from './components/TicketingConfigManager';
import PassengerInterface from './components/PassengerInterface';
import MobileBottomNav from './components/MobileBottomNav';
import TimeTrackingManager, { getLocalDateStr } from './components/TimeTrackingManager';
import PayrollManager from './components/PayrollManager';
import ManagementView from './components/ManagementView';
import DriverShiftManager from './components/DriverShiftManager';
import DriverView from './components/DriverView';
import OperationTabs from './components/OperationTabs';
import NotificationManager from './components/NotificationManager';
import RecruitmentPanel from './components/RecruitmentPanel';
import SkinRepository from './components/SkinRepository';
import { NotificationService } from './services/NotificationService';
import { MockNotificationService } from './services/MockNotificationService';
import SystemConfigManager from './components/SystemConfigManager';
import DispatcherManager from './components/DispatcherManager';
import SACManager from './components/SACManager';
import JobApplicationForm from './components/JobApplicationForm';
import TrafficViolationManager from './components/TrafficViolationManager';
import OrientationOverlay from './components/OrientationOverlay';
import { APP_VERSION, isNewerVersion } from './utils/versionHelper';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import SubscriptionManager from './components/SubscriptionManager';
import LicenseManagement from './components/LicenseManagement';
import UserSubscription from './components/UserSubscription';
import SubscriptionExpired from './components/SubscriptionExpired';
import { SystemLoadingScreen } from './components/SystemLoadingScreen';
import { WelcomeLoadingScreen } from './components/WelcomeLoadingScreen';
import { TabTransitionLoader } from './components/TabTransitionLoader';
import { GlobalTopProgressBar } from './components/GlobalTopProgressBar';
import GuidedTourModal from './components/GuidedTourModal';
import { ViewState, BusRoute, Trip, User, Company, Vehicle, IssueReport, City, Notice, ThemeMode, TicketSale, Inspection, TicketingConfig, RoleConfig, AppNotification, Shift, SystemSettings, UserFine, Subscription, Skin, TimeEntry, TicketBooth, BusStation } from './types';
import { db, supabase, TableName } from './services/database';
import { resolveThemeColors, applyThemeVariables, applyThemeMode } from './utils/themeHelper';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.error("[CRITICAL_RENDER_ERROR]", error, errorInfo); 
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-10 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={64} className="text-yellow-400 mb-6" />
          <h1 className="text-2xl font-black uppercase mb-4">Falha Crítica de Renderização</h1>
          <div className="bg-black/50 p-6 rounded-2xl text-left font-mono text-xs text-red-400 mb-8 w-full max-w-2xl overflow-auto">
            {this.state.error?.toString()}
          </div>
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase">Recarregar Sistema</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_CONFIG: TicketingConfig = {
  id: 'da4d93ab-b6e9-4556-918d-21861dd26726',
  payment_methods: ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'IMPCARD'],
  credit_installments: 12,
  credit_surcharge: 0,
  min_installment_value: 1,
  boarding_box: 'Plataforma 01',
  active_coupons: [],
  class_seats: { 'CONVENCIONAL': 44, 'CONVENCIONAL_DD': 64, 'EXECUTIVO': 42, 'EXECUTIVO_DD': 56, 'LEITO': 28, 'LEITO_DD': 36, 'SEMI_LEITO': 32, 'SEMI_LEITO_DD': 44, 'URBANO': 44, 'CAMA': 18 }
};

const ViewContent: React.FC<{ 
  currentView: ViewState | string; 
  commonProps: any;
  handleAction: (action: any, table: any, data: any) => Promise<any>;
}> = ({ currentView, commonProps, handleAction }) => {
  const { 
    currentUser, routes, trips, users, companies, vehicles, reports, cities, notices, 
    inspections, ticketingConfig, addToast, roleConfigs, importUserData, setImportUserData,
    notificationMetadata, setNotificationMetadata, handleNotificationClick, loadInitialData, userFines, systemSettings, skins, shifts, notifications,
    handleSendSystemNotification, setCurrentView, handleAddTrip, handleUpdateTrip, handleDeleteTrip
  } = commonProps;

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': {
        const userRole = (currentUser?.role || '').toUpperCase();
        const userJob = (currentUser?.job_title || '').toUpperCase();
        const isFullAdmin = userRole === 'ADMIN' || currentUser?.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
        if (!isFullAdmin) {
          return <TimeTrackingManager currentUser={currentUser} users={users} addToast={addToast} />;
        }
        return <Dashboard {...commonProps} allTrips={trips} />;
      }
      case 'drivers': 
        return <DriverManager 
          {...commonProps} 
          drivers={users} 
          roleConfigs={roleConfigs} 
          registrationPattern={systemSettings?.registration_pattern} 
          registrationTemplate={systemSettings?.registration_template} 
          initialUserData={importUserData}
          onClearInitialData={() => setImportUserData(null)}
          onAddDriver={u => {
            handleAction('create', 'users', u);
            setImportUserData(null);
          }} 
          onUpdateDriver={u => handleAction('update', 'users', u)} 
          onDeleteDriver={id => handleAction('delete', 'users', id)} 
          userFines={userFines}
          onAddFine={(v) => handleAction('create', 'user_fines', v)}
        />;
      case 'companies': return <CompanyManager {...commonProps} onAddCompany={c => handleAction('create', 'companies', c)} onUpdateCompany={c => handleAction('update', 'companies', c)} onDeleteCompany={id => handleAction('delete', 'companies', id)} onAddBooth={b => handleAction('create', 'ticket_booths', b)} onUpdateBooth={b => handleAction('update', 'ticket_booths', b)} onDeleteBooth={id => handleAction('delete', 'ticket_booths', id)} />;
      case 'routes': return <RouteManager {...commonProps} trips={trips} onAddRoute={r => handleAction('create', 'routes', r)} onUpdateRoute={r => handleAction('update', 'routes', r)} onDeleteRoute={id => handleAction('delete', 'routes', id)} />;
      case 'schedule': return <TripSchedule {...commonProps} drivers={users} onAddTrip={handleAddTrip} onUpdateTrip={handleUpdateTrip} onDeleteTrip={handleDeleteTrip} onSendSMS={handleSendSystemNotification} userFines={userFines} />;
      case 'users': 
        return <UserManager 
          {...commonProps} 
          companies={companies}
          roleConfigs={roleConfigs} 
          initialUserData={importUserData}
          onClearInitialData={() => setImportUserData(null)}
          onAddUser={u => {
            handleAction('create', 'users', u);
            setImportUserData(null);
          }} 
          onUpdateUser={u => handleAction('update', 'users', u)} 
          onDeleteUser={id => handleAction('delete', 'users', id)} 
        />;
      case 'vehicles': return <VehicleManager {...commonProps} onAddVehicle={v => handleAction('create', 'vehicles', v)} onUpdateVehicle={v => handleAction('update', 'vehicles', v)} onDeleteVehicle={id => handleAction('delete', 'vehicles', id)} skins={skins} />;
      case 'observations': return <ObservationManager {...commonProps} initialOccurrenceId={notificationMetadata?.occurrenceId} onResolveReport={(id, metadata) => handleAction('update', 'occurrences', { id, status: 'Concluído', technician_report: metadata })} onDeleteReport={id => handleAction('delete', 'occurrences', id)} />;
      case 'cities': return <CityManager {...commonProps} onAddCity={c => handleAction('create', 'cities', c)} onUpdateCity={c => handleAction('update', 'cities', c)} onDeleteCity={id => handleAction('delete', 'cities', id)} />;
      case 'bus-stations': return <BusStationManager 
        {...commonProps} 
        onAddStation={s => handleAction('create', 'bus_stations', s)} 
        onUpdateStation={s => handleAction('update', 'bus_stations', s)} 
        onDeleteStation={id => handleAction('delete', 'bus_stations', id)} 
      />;
      case 'notices': return <NoticeManager {...commonProps} onAddNotice={n => handleAction('create', 'notices', n)} onDeleteNotice={id => handleAction('delete', 'notices', id)} />;
      case 'reports-view': return <ReportManager {...commonProps} onDeleteTrip={handleDeleteTrip} />;
      case 'maintenance': return <MaintenanceManager {...commonProps} />;
      case 'ticketing': return <TicketAgentInterface 
        {...commonProps} 
        onExit={() => setCurrentView(notificationMetadata?.isPassengerTicketing ? 'passenger-view' : 'dashboard')} 
        initialTripId={notificationMetadata?.trip_id} 
        initialRouteId={notificationMetadata?.route_id}
        initialPassengerData={notificationMetadata?.passengerData}
        isPassengerView={notificationMetadata?.isPassengerTicketing}
      />;
      case 'inspections': return <InspectionManager {...commonProps} onAddInspection={i => handleAction('create', 'inspections', i)} onUpdateInspection={i => handleAction('update', 'inspections', i)} onDeleteInspection={id => handleAction('delete', 'inspections', id)} />;
      case 'ticketing-config': return <TicketingConfigManager initialConfig={ticketingConfig} onUpdateConfig={c => handleAction('update', 'ticketing_config', c)} addToast={addToast} />;
      case 'time-tracking': return <TimeTrackingManager currentUser={currentUser} users={users} addToast={addToast} />;
      case 'payroll': return <PayrollManager users={users} companies={companies} addToast={addToast} />;
      case 'management': return <ManagementView addToast={addToast} currentUser={currentUser} />;
      case 'shifts': return <DriverShiftManager shifts={shifts} drivers={users} routes={routes} onAddShift={s => handleAction('create', 'shifts', s)} onUpdateShift={s => handleAction('update', 'shifts', s)} onDeleteShift={id => handleAction('delete', 'shifts', id)} addToast={addToast} />;
      case 'notifications': 
        return <NotificationManager 
          notifications={notifications} 
          currentUser={currentUser}
          addToast={addToast} 
          onRefresh={loadInitialData} 
          onNotificationClick={handleNotificationClick}
          onDeleteNotification={id => handleAction('delete', 'notifications', id)}
        />;
      case 'dispatcher': return <DispatcherManager currentUser={currentUser} addToast={addToast} />;
      case 'sac': return <SACManager addToast={addToast} />;
      case 'license-management': 
        if (!currentUser?.is_full_admin) return <Dashboard {...commonProps} allTrips={trips} />;
        return <LicenseManagement currentUser={currentUser} addToast={addToast} />;
      case 'subscriptions':
        if (currentUser?.email !== 'via.nicolau.sa@gmail.com') return <Dashboard {...commonProps} allTrips={trips} />;
        return <SubscriptionManager currentUser={currentUser} addToast={addToast} />;
      case 'my-subscription': return <UserSubscription currentUser={currentUser} addToast={addToast} />;
      case 'system-config': return <SystemConfigManager addToast={addToast} />;
      case 'skins': return <SkinRepository currentUser={currentUser} companies={companies} skins={skins} />;
      case 'recruitment': 
        return <RecruitmentPanel 
          addToast={addToast} 
          currentUser={currentUser}
          initialApplicationId={notificationMetadata?.applicationId}
          onImportToCollaborators={(userData) => {
            setImportUserData(userData);
            setCurrentView('drivers');
          }}
        />;
      case 'driver-view': return <DriverView {...commonProps} onUpdateTrip={handleUpdateTrip} />;
      case 'monitoring': return <OperationTabs {...commonProps} initialTab="OVERVIEW" onUpdateTrip={handleUpdateTrip} />;
      case 'operation-center': return <OperationTabs {...commonProps} onUpdateTrip={handleUpdateTrip} />;
      case 'traffic-violations': return <TrafficViolationManager userFines={userFines} drivers={users} vehicles={vehicles} onAddViolation={v => handleAction('create', 'user_fines', v)} onDeleteViolation={id => handleAction('delete', 'user_fines', id)} onUpdateViolation={v => handleAction('update', 'user_fines', v)} addToast={addToast} />;
      case 'work-with-us': return <JobApplicationForm addToast={addToast} currentUser={currentUser} onSuccess={() => setCurrentView('dashboard')} />;
      case 'driver-urban': return <DriverView {...commonProps} forcedRole="URBANO" onUpdateTrip={handleUpdateTrip} />;
      case 'driver-road': return <DriverView {...commonProps} forcedRole="RODOVIARIO" onUpdateTrip={handleUpdateTrip} />;
      case 'conductor': return <DriverView {...commonProps} forcedRole="COBRADOR" onUpdateTrip={handleUpdateTrip} />;
      case 'passenger-view': return <PassengerInterface {...commonProps} onExit={() => setCurrentView('dashboard')} onOpenTicketing={(tripId, passengerData, routeId) => {
        setNotificationMetadata(prev => ({ 
          ...prev, 
          trip_id: tripId, 
          route_id: routeId,
          passengerData: passengerData,
          isPassengerTicketing: true
        }));
        setCurrentView('ticketing');
      }} />;
      case 'about': return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm transition-colors">
          <div className="max-w-2xl mx-auto text-center">
              <div className="logo-sistema w-24 h-24 bg-yellow-400 rounded-[2rem] mx-auto mb-8 flex items-center justify-center shadow-xl border-4 border-slate-900 overflow-hidden transition-all">
                {systemSettings?.system_logo ? (
                  <img 
                    src={`${systemSettings.system_logo.split('?')[0]}?t=${Date.now()}`} 
                    className="h-full w-auto object-contain" 
                    alt={systemSettings?.system_name || "ViaLivre Gestão"} 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className="text-4xl font-black italic text-slate-900">{(systemSettings?.system_name?.[0] || 'V').toUpperCase()}</span>
                )}
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-zinc-100 uppercase italic tracking-tighter mb-4">
                {systemSettings?.system_name || 'ViaLivre Gestão'}
              </h2>
              <p className="text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[10px] mb-12">Sistema Integrado de Gestão de Transportes</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Versão do Sistema</p>
                  <p className="text-lg font-black text-slate-900 dark:text-zinc-100">v2.0</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Desenvolvedor</p>
                  <p className="text-lg font-black text-slate-900 dark:text-zinc-100">ViaLivre Gestão</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700 md:col-span-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Suporte Técnico</p>
                  <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-zinc-700/50 pb-4 mb-4">
                    <a href={`mailto:${systemSettings?.support_email || 'via.nicolau.sa@gmail.com'}`} className="text-lg font-black text-slate-900 dark:text-zinc-100 hover:text-yellow-600 transition-colors uppercase">
                      {systemSettings?.support_email || 'via.nicolau.sa@gmail.com'}
                    </a>
                    <a href="https://wa.me/5521995421447?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20sistema%20ViaLivre%20Gest%C3%A3o" target="_blank" rel="noopener noreferrer" className="text-sm font-black text-yellow-600 hover:underline">
                      (21) 9 9542-1447
                    </a>
                  </div>
                  
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <RefreshCw size={12} className="text-yellow-400" /> Orientações e Suporte
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-xs text-slate-900 dark:text-zinc-100 uppercase italic">Recomeçar Tutorial de Boas-vindas</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-relaxed">
                        Reativa o passo a passo interativo de primeiro acesso das ferramentas administrativas.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('fluxo_tutorial_seen');
                        addToast("Tutorial redefinido com sucesso! O passo a passo será exibido no próximo login ou recarregamento.", "success");
                      }}
                      className="px-6 py-3.5 bg-slate-900 dark:bg-zinc-700 hover:bg-slate-850 dark:hover:bg-zinc-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0 border border-slate-800 dark:border-zinc-600"
                    >
                      <RefreshCw size={12} />
                      Recomeçar Tutorial
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  const getViewLabel = (view: string) => {
    const labels: Record<string, string> = {
      'dashboard': 'Dashboard',
      'operation-center': 'Centro Operacional',
      'monitoring': 'Monitoramento',
      'management': 'Gestão Global',
      'routes': 'Itinerários',
      'schedule': 'Escala de Viagens',
      'users': 'Controle de Acessos',
      'companies': 'Empresas',
      'vehicles': 'Frota de Ônibus',
      'drivers': 'Colaboradores',
      'ticketing': 'Guichê de Vendas',
      'sac': 'Vale Transporte',
      'notices': 'Mural de Avisos',
      'observations': 'Ocorrências',
      'inspections': 'Vistorias',
      'maintenance': 'Manutenção',
      'cities': 'Municípios',
      'reports-view': 'Relatórios',
      'payroll': 'Holerites',
      'time-tracking': 'Ponto Eletrônico',
      'ticketing-config': 'Gestão Guichê',
      'dispatcher': 'Despachante',
      'recruitment': 'Recrutamento',
      'work-with-us': 'Trabalhe Conosco',
      'about': 'Sobre o Sistema'
    };
    return labels[view] || view;
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Breadcrumb Section */}
      <div className="px-10 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm border-b border-slate-100 dark:border-zinc-900 transition-colors">
        {(() => {
          const userRole = (currentUser?.role || '').toUpperCase();
          const userJob = (currentUser?.job_title || '').toUpperCase();
          const isFullAdmin = userRole === 'ADMIN' || currentUser?.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
          const homeView = isFullAdmin ? 'dashboard' : 'time-tracking';
          return (
            <button onClick={() => setCurrentView(homeView)} className="hover:text-yellow-600 flex items-center gap-1.5 transition-colors">
              <Home size={12} /> Home
            </button>
          );
        })()}
        {currentView !== 'dashboard' && currentView !== 'time-tracking' && (
          <>
            <ChevronRight size={10} className="text-slate-300 dark:text-zinc-800" />
            <span className="text-slate-900 dark:text-white">{getViewLabel(currentView as string)}</span>
          </>
        )}
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView as string}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 1.02 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const ROLE_TUTORIALS: Record<string, {
  title: string;
  subtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  quote: string;
  features: { l: string; d: string }[];
}> = {
  ADMIN: {
    title: "Bem-vindo ao ViaLivre Gestão!",
    subtitle: "Tutorial de Primeiro Acesso para Administradores de Frota",
    step1Title: "Configuração Básica do Painel",
    step1Desc: "Para permitir o correto funcionamento operacional, as abas Colaboradores, Empresas, Itinerários e Municípios devem ser povoadas primeiro. Elas criam o alicerce de rotas e equipes.",
    step2Title: "Operação e Supervisão Integrada",
    step2Desc: "Utilize a Escala de Viagens para designar veículos, motoristas e horários. Visualize em tempo real o andamento e registre incidentes com os despachantes.",
    quote: '"O sucesso da sua operação começa com dados bem cadastrados e processos organizados. Vamos começar?"',
    features: [
      { l: "Dashboard Geral", d: "Visão analítica de passageiros e faturamento diário" },
      { l: "Gestão Global", d: "Controle de cargos, permissões e redefinição de tutorial" },
      { l: "Itinerários & Frota", d: "Pontos de parada, linhas, veículos e vistorias" },
      { l: "Fechamento Financeiro", d: "Folha de pagamento e monitoramento de rubricas" },
      { l: "Controle de Despacho", d: "Atribuição e liberação em garagem" },
      { l: "SAC & Ouvidoria", d: "Atendimento ao cliente e suporte especializado" }
    ]
  },
  DRIVER: {
    title: "Portal de Bordo do Motorista!",
    subtitle: "Guia de Inicialização e Registro de Jornada",
    step1Title: "Ponto Eletrônico e Jornada",
    step1Desc: "Antes de ver ou iniciar qualquer viagem, você deve registrar o seu Ponto de Entrada (Clock-In) na aba correspondente do sistema. Isso libera as suas escalas.",
    step2Title: "Programação e Escalas",
    step2Desc: "Acesse as escalas de viagem designadas para você hoje. Acompanhe a viatura designada, paradas obrigatórias, itinerário detalhado e relate quaisquer ocorrências no percurso.",
    quote: '"Direção defensiva de alta qualidade e pontualidade garantem um transporte público exemplar. Boa viagem!"',
    features: [
      { l: "Ponto Digital", d: "Registro rápido e seguro da entrada e saída de turno" },
      { l: "Minhas Escalas", d: "Quadro de horários e ônibus escalados para o seu CPF" },
      { l: "Relato de Alertas", d: "Envio rápido de avisos sobre problemas na via" },
      { l: "Quadro de Avisos", d: "Notícias e mudanças operacionais emitidas pela central" },
      { l: "Diário de Bordo", d: "Envio de ocorrências ou falhas veiculares do motorista" },
      { l: "SAC & Rotas", d: "Consulta de rotas e contato direto com a empresa" }
    ]
  },
  CONDUCTOR: {
    title: "Jornada de Trabalho do Cobrador!",
    subtitle: "Guia Operacional e Fiscalização de Tarifas",
    step1Title: "Registro de Expediente",
    step1Desc: "Sempre inicie o seu turno batendo a Entrada no Ponto Eletrônico. Dessa forma, suas escalas de faturamento e ônibus vinculados ficam liberados.",
    step2Title: "Controle de Tarifa e Vendas",
    step2Desc: "Monitore o embarque de passageiros, faça a conferência de passes escolares, gratuidades ou carregamento dos cartões de transporte integrados no veículo.",
    quote: '"Sua atenção no fluxo de passageiros e no controle de faturamento é fundamental para a saúde operacional do trajeto."',
    features: [
      { l: "Ponto Eletrônico", d: "Abertura e fechamento oficial de expediente" },
      { l: "Escalas do Cobrador", d: "Viagens marcadas em que você fará a assistência de embarque" },
      { l: "Quadro de Avisos", d: "Instruções diretas do despachante ou da diretoria" },
      { l: "Ocorrências de Viagem", d: "Comunique rapidamente qualquer conflito ou sinistro" },
      { l: "Histórico de Ponto", d: "Audite suas próprias horas trabalhadas com clareza" },
      { l: "Contato de Suporte", d: "Suporte imediato de garagem e RH no menu de ajuda" }
    ]
  },
  FISCAL: {
    title: "Painel de Fiscalização Ativa!",
    subtitle: "Controle de Linhas, Cumprimento de Horários e Segurança",
    step1Title: "Abertura de Serviços",
    step1Desc: "Informe o início do seu dia registrando o Ponto. O aplicativo habilitará as ferramentas de fiscalização de garagem, partidas e inspeção de viaturas.",
    step2Title: "Cumprimento de Horários e Vistoria",
    step2Desc: "Registre o estado físico dos ônibus antes de partirem. Verifique se o itinerário está correto, se os horários de partida batem e emita advertências ou multas.",
    quote: '"A regularidade do serviço e o cumprimento rígido de horários dependem da precisão do seu olhar clínico. Bom trabalho!"',
    features: [
      { l: "Acompanhamento Ativo", d: "Tabelas de partidas e verificação de frotas em trânsito" },
      { l: "Inspeções de Veículo", d: "Checklists completos de segurança e conservação do ônibus" },
      { l: "Eventos Operacionais", d: "Anotação rápida de avarias, sinistros ou atrasos na linha" },
      { l: "Histórico de Multas", d: "Monitoramento de multas emitidas para motoristas" },
      { l: "Avisos Gerais", d: "Criação de notícias corporativas urgentes para colaboradores" },
      { l: "Rotas & Itinerários", d: "Conferência rápida e visual de quilometragem e tempos" }
    ]
  },
  AGENTE: {
    title: "Terminal de Bilheteria ConsImp!",
    subtitle: "Emissão de Passagens e Gestão de Tarifas Comerciais",
    step1Title: "Venda Rápida e Poltronas",
    step1Desc: "Selecione a viagem desejada, clique nos assentos disponíveis de forma interativa e informe a classe (Ex: Convencional, Luxo). Insira os dados do passageiro para emitir.",
    step2Title: "Controle de Cartão e Recarga",
    step2Desc: "Agilize a carga de créditos para passageiros físicos. Informe o número do cartão, adicione o valor desejado (PIX, Crédito, Débito ou Dinheiro) e valide o bilhete térmico.",
    quote: '"Um atendimento cordial e processos de emissão rápidos reduzem filas e encantam o usuário final. Boas vendas!"',
    features: [
      { l: "Bilhetagem Rápida", d: "Emissão de passagens e geração de QR code impresso" },
      { l: "Configuração de Poltronas", d: "Defina a quantidade de assentos de acordo com a classe do ônibus" },
      { l: "SAC & Chamados", d: "Ajude na tratativa de reclamações e resoluções no balcão" },
      { l: "Controle de Vouchers", d: "Gestão de passagens emitidas e reimpressão de comprovantes" },
      { l: "Status das Partidas", d: "Acompanhe vagas disponíveis por ônibus em viagem futura" },
      { l: "Quadro de Avisos", d: "Alertas corporativos urgentes para guichês em rodoviárias" }
    ]
  },
  DESPACHANTE: {
    title: "Central de Despacho Operacional!",
    subtitle: "Controle Dinâmico de Tráfego, Escala e Veículos em Garagem",
    step1Title: "Liberação de Veículos",
    step1Desc: "Acompanhe as viagens prontas para partida. Associe ônibus mecânicos saudáveis sob escalas corretas e valide a presença da tripulação antes de cada partida.",
    step2Title: "Monitoramento de Eventos",
    step2Desc: "Identifique carros retidos por falha, quebras no trajeto, multas e envie comunicados imediatos para que motoristas fiquem cientes em tempo real no app.",
    quote: '"Você é o coração da operação logística. Manter a garagem ativa e os horários em dia é o nosso combustível!"',
    features: [
      { l: "Quadro de Despacho", d: "Tabela viva de partidas, permissões de viagem e liberação" },
      { l: "Manutenção da Frota", d: "Controle preventivo e corretivo e status dos carros" },
      { l: "Painel de Incidentes", d: "Histórico e registro de problemas no percurso" },
      { l: "Gestão de Escalas", d: "Distribuição equitativa de Motoristas e Cobradores" },
      { l: "Avisos de Emergência", d: "Disparos instantâneos de notícias para a equipe de rua" },
      { l: "Itinerários Operacionais", d: "Mapa de frotagem e rotas cadastradas por linha" }
    ]
  },
  RH: {
    title: "Gestão Estratégica de Pessoas & RH!",
    subtitle: "Administração de Contratações, Holerites e Auditoria de Ponto",
    step1Title: "Gestão Profissional",
    step1Desc: "Acompanhe fichas completas de contratação, cargos, datas de admissão, validades de CNH para motoristas e redefina acessos setoriais do sistema.",
    step2Title: "Folha de Pagamento Inteligente",
    step2Desc: "Apure mensalmente ou semanalmente as horas extras, faltas e aplique rubricas salariais devidas (deduções ou benefícios) para emissão de holerites fiscais.",
    quote: '"Cuidar do bem-estar dos colaboradores e manter a conformidade trabalhista gera uma equipe de alta dedicação."',
    features: [
      { l: "Talentos & Recrutamento", d: "Acompanhamento de vagas em aberto e currículos recebidos" },
      { l: "Folha de Pagamento", d: "Lançamento de rubricas personalizadas e geração de holerites" },
      { l: "Auditoria de Ponto", d: "Controle detalhado de horas, entradas, saídas e justificativas" },
      { l: "Cargos e Funções", d: "Configuração de privilégios para cada colaborador" },
      { l: "Comunicação Interna", d: "Publicação de avisos administrativos de RH para a equipe" },
      { l: "Skins e Identidade", d: "Acompanhe e configure a imagem visual da frota corporativa" }
    ]
  }
};

// Session & Data Version Management Helpers for robust multi-device synchronization
const SESSION_USER_KEY = 'fluxo_session_user';
const SESSION_SYNC_TIMESTAMP_KEY = 'fluxo_session_sync_timestamp';
const SESSION_VERSION_KEY = 'fluxo_session_version';

const computeUserVersion = (user: Partial<User> | null | undefined): string => {
  if (!user) return '0';
  const perms = Array.isArray(user.permissions) ? user.permissions.slice().sort().join(',') : '';
  const parts = [
    user.id || '',
    user.updated_at || user.created_at || '',
    user.role || '',
    user.job_title || '',
    user.is_full_admin ? 'admin' : 'user',
    user.status || '',
    user.system_id || '',
    user.registration_id || '',
    user.cpf || '',
    user.email || '',
    user.full_name || user.name || '',
    user.photo_url || '',
    perms
  ];
  return parts.join('|');
};

const saveSessionMetadata = (user: User, customVersion?: string) => {
  try {
    const version = customVersion || computeUserVersion(user);
    const now = Date.now().toString();
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_SYNC_TIMESTAMP_KEY, now);
    localStorage.setItem(SESSION_VERSION_KEY, version);
    window.dispatchEvent(new CustomEvent('vialivre-sync-timestamp-updated', { 
      detail: { timestamp: Number(now), version } 
    }));
  } catch (e) {
    console.warn('Erro ao salvar metadados de sessão no localStorage:', e);
  }
};

const clearSessionMetadata = () => {
  try {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_SYNC_TIMESTAMP_KEY);
    localStorage.removeItem(SESSION_VERSION_KEY);
    localStorage.removeItem('fluxo_current_view');
    localStorage.removeItem('vialivre_logged_in_card');
    localStorage.removeItem('vialivre_passenger_session');
  } catch (e) {}
};

const App: React.FC = () => {

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [isPassengerMode, setIsPassengerMode] = useState(false);
  const [showPassengerTicketing, setShowPassengerTicketing] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState | string>(() => {
    try {
      const savedUserStr = localStorage.getItem('fluxo_session_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        const userRole = (u.role || '').toUpperCase();
        const userJob = (u.job_title || '').toUpperCase();
        const isFullAdmin = userRole === 'ADMIN' || u.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
        if (!isFullAdmin) return 'time-tracking';
      }
      return localStorage.getItem('fluxo_current_view') || 'dashboard';
    } catch {
      return 'time-tracking';
    }
  }); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showGuidedTourModal, setShowGuidedTourModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleOpenTourEvent = () => setShowGuidedTourModal(true);
    window.addEventListener('vialivre-open-tour', handleOpenTourEvent);
    return () => window.removeEventListener('vialivre-open-tour', handleOpenTourEvent);
  }, []);
  const [themeMode, setThemeMode] = useState<ThemeMode>((localStorage.getItem('fluxo_theme') as ThemeMode) || 'light');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errorModal, setErrorModal] = useState<{ message: string } | null>(null);
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGoodbye, setShowGoodbye] = useState(false);

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [trips, setTrps] = useState<Trip[]>([]);

  async function handleAddTrip(newTrip: Partial<Trip>) {
    try {
      const payload = {
        ...newTrip,
        passengers: newTrip.passengers && typeof newTrip.passengers === 'object' ? JSON.stringify(newTrip.passengers) : newTrip.passengers,
        system_id: currentUser?.system_id || newTrip.system_id
      };
      const saved = await db.create('trips', payload);
      if (saved) {
        setTrps(prev => [saved as Trip, ...prev.filter(t => t.id !== (saved as Trip).id)]);
        loadInitialData();
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        return saved;
      }
      return null;
    } catch (err: any) {
      addToast(err?.message || 'Erro ao criar viagem', 'error');
      throw err;
    }
  }

  async function handleUpdateTrip(updatedTrip: Partial<Trip> & { id: string }) {
    try {
      const payload = {
        ...updatedTrip,
        passengers: updatedTrip.passengers && typeof updatedTrip.passengers === 'object' ? JSON.stringify(updatedTrip.passengers) : updatedTrip.passengers,
        system_id: currentUser?.system_id || updatedTrip.system_id
      };
      const saved = await db.update('trips', payload);
      if (saved) {
        setTrps(prev => prev.map(t => t.id === updatedTrip.id ? (saved as Trip) : t));
        loadInitialData();
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        return saved;
      }
      return null;
    } catch (err: any) {
      addToast(err?.message || 'Erro ao atualizar viagem', 'error');
      throw err;
    }
  }

  async function handleDeleteTrip(id: string) {
    try {
      await db.delete('trips', id);
      setTrps(prev => prev.filter(t => t.id !== id));
      loadInitialData();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      return true;
    } catch (err: any) {
      addToast(err?.message || 'Erro ao excluir viagem', 'error');
      throw err;
    }
  }
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [ticketBooths, setTicketBooths] = useState<TicketBooth[]>([]);
  const [busStations, setBusStations] = useState<BusStation[]>([]);
  const [ticketingConfig, setTicketingConfig] = useState<TicketingConfig | null>(DEFAULT_CONFIG);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationMetadata, setNotificationMetadata] = useState<any>(null);
  const [importUserData, setImportUserData] = useState<Partial<User> | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userFines, setUserFines] = useState<UserFine[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('vialivre_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const compLower = (parsed.company_name || '').trim().toLowerCase();
        const sysLower = (parsed.system_name || '').trim().toLowerCase();
        if (
          !parsed.system_name ||
          (compLower && sysLower === compLower) ||
          sysLower.includes('viação') ||
          sysLower.includes('viacao') ||
          sysLower.includes('nicolau') ||
          sysLower.includes("d'rio") ||
          sysLower.includes('consorcio imperial') ||
          sysLower.includes('consórcio imperial') ||
          sysLower.includes('transportes')
        ) {
          parsed.system_name = 'ViaLivre Gestão';
          try {
            localStorage.setItem('vialivre_system_settings', JSON.stringify(parsed));
          } catch {}
        }
        return parsed;
      }
    } catch (e) {}
    return {
      id: 'sys-set-001',
      system_id: 'sys-vialivre-default',
      system_name: 'ViaLivre Gestão',
      company_name: 'ViaLivre Gestão',
      registration_pattern: 'FLX-000',
      theme_color: 'yellow',
      glass_effect: true,
      support_email: 'via.nicolau.sa@gmail.com'
    };
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showTrialWarning, setShowTrialWarning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null);
  const [githubUpdateVersion, setGithubUpdateVersion] = useState<string | null>(null);

  const debounceTimers = useRef<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    if (systemSettings?.high_contrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [systemSettings?.high_contrast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tecla ESC: Fecha sidebar ou modais se estiverem abertos
      if (e.key === 'Escape') {
        if (isSidebarOpen) setIsSidebarOpen(false);
        window.dispatchEvent(new CustomEvent('close-all-modals'));
      }

      // Tecla ENTER: Navegação similar a TAB
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
          // Allow default behavior for checkboxes and radio buttons if needed, or just let them move focus
          if (target.getAttribute('type') === 'checkbox' || target.getAttribute('type') === 'radio') {
              return;
          }

          const isPassword = target.getAttribute('type') === 'password';
          const isLoginScreen = !!target.closest('.login-screen-vialivre');

          e.preventDefault();
          const form = target.closest('form');
          if (form) {
            const elements = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea, button'))
              .filter(el => {
                const style = window.getComputedStyle(el);
                return !el.hasAttribute('disabled') && style.display !== 'none' && style.visibility !== 'hidden';
              });
            const index = elements.indexOf(target);

            // Auto-login logic for Login Screen
            if (isLoginScreen && form.getAttribute('id') === 'login-form-main') {
              const loginInputs = form.querySelectorAll('input');
              const isFilled = Array.from(loginInputs).every(inp => inp.value.trim().length > 0);
              if (isFilled && (index === elements.length - 1 || isPassword)) {
                form.requestSubmit();
                return;
              }
            }

            if (index > -1 && index < elements.length - 1) {
              (elements[index + 1] as HTMLElement).focus();
            } else if (index === elements.length - 1) {
              const confirmCheck = form.querySelector('input[type="checkbox"][id*="confirm"]') as HTMLElement;
              const saveBtn = form.querySelector('button[type="submit"]') as HTMLElement;
              if (confirmCheck) confirmCheck.focus();
              else if (saveBtn) saveBtn.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Lock body scroll whenever global modals are open
  useBodyScrollLock(Boolean(errorModal || showTrialWarning || showTutorial));

  // Effect to apply dynamic theme color palettes, custom primary colors, and glassmorphism setting globally
  useEffect(() => {
    applyThemeVariables(systemSettings?.theme_color);
    const root = document.documentElement;

    if (systemSettings?.glass_effect === false) {
      root.classList.add('glass-disabled');
      root.classList.remove('glass-enabled');
    } else {
      root.classList.remove('glass-disabled');
      root.classList.add('glass-enabled');
    }

    if (systemSettings?.high_contrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [systemSettings]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleViewChange = (e: any) => {
        setCurrentView(e.detail);
        if (e.metadata) setNotificationMetadata(e.metadata);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('change-view', handleViewChange);
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('change-view', handleViewChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('fluxo_current_view', currentView);
  }, [currentView]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    let rawMsg = typeof message === 'string' ? message : String(message || '');
    rawMsg = rawMsg.trim().replace(/\s+/g, ' ');

    // Truncate or summarize any warning, error, info or success message to maximum 60 characters
    const MAX_LENGTH = 60;
    const cleanMsg = rawMsg.length > MAX_LENGTH 
      ? rawMsg.slice(0, MAX_LENGTH - 3).trim() + '...' 
      : rawMsg;

    const id = Date.now() + Math.random();
    setToasts(prev => [...(prev || []), { id, message: cleanMsg, type }]);
    setTimeout(() => { 
      setToasts(prev => (prev || []).filter(t => t.id !== id)); 
    }, 3200);
  }, []);

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  const checkGithubVersion = useCallback(async () => {
    // 1. Check if there is a simulated version in localStorage (for debug/testing)
    const simulatedVersion = localStorage.getItem('vialivre_simulated_github_update');
    if (simulatedVersion) {
      if (simulatedVersion === 'NONE') {
        setGithubUpdateVersion(null);
      } else if (isNewerVersion(simulatedVersion, APP_VERSION)) {
        setGithubUpdateVersion(simulatedVersion);
      } else {
        setGithubUpdateVersion(null);
      }
      return;
    }

    // 2. Query actual GitHub releases endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://api.github.com/repos/vianicolausa/ViaLivre-Gestao/releases/latest', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const latestTag = data.tag_name;
        // Only show banner if there is a published release tag strictly newer than current app version
        if (latestTag && !data.draft && isNewerVersion(latestTag, APP_VERSION)) {
          setGithubUpdateVersion(latestTag);
        } else {
          setGithubUpdateVersion(null);
        }
      } else {
        setGithubUpdateVersion(null);
      }
    } catch (e) {
      console.warn('Falha silenciosa ao verificar atualizações do GitHub:', e);
      setGithubUpdateVersion(null);
    }
  }, []);

   const loadInitialData = useCallback(async () => {
    const activeUser = currentUserRef.current;
    try {
      const [r, t, u, c, v, rep, cit, n, insp, cfg, roles, notifs, sfts, settings, fines, subs, skns, tt, booths, bst] = await Promise.allSettled([
        db.getRoutes(), db.getTrips(), db.getUsers(), db.getCompanies(), db.getVehicles(), db.getReports(), db.getCities(), db.getNotices(), db.getInspections(), db.getTicketingConfig(), db.getRoleConfigs(), db.getNotifications(), db.getShifts(), db.getSystemSettings(), db.getUserFines(), db.getSubscriptions(), db.getSkins(), db.fetchAll<TimeEntry>('time_tracking' as any), db.getTicketBooths(), db.getBusStations()
      ]);
      
      if (r.status === 'fulfilled') setRoutes(r.value || []);
      if (t.status === 'fulfilled') setTrps(t.value || []);
      if (u.status === 'fulfilled') {
        const freshUsers = u.value || [];
        setUsers(freshUsers);
        // Automatic profile, version & registration data sync for collaborator across devices
        if (activeUser) {
          const freshUser = freshUsers.find(usr => usr.id === activeUser.id);
          if (freshUser) {
            const serverVersion = computeUserVersion(freshUser);
            const localVersion = localStorage.getItem(SESSION_VERSION_KEY);
            const isServerVersionDifferent = serverVersion !== localVersion;

            const hasEssentialDiff = 
              freshUser.full_name !== activeUser.full_name ||
              freshUser.name !== activeUser.name ||
              freshUser.role !== activeUser.role ||
              freshUser.job_title !== activeUser.job_title ||
              freshUser.photo_url !== activeUser.photo_url ||
              freshUser.system_id !== activeUser.system_id ||
              freshUser.is_full_admin !== activeUser.is_full_admin ||
              freshUser.status !== activeUser.status ||
              freshUser.registration_id !== activeUser.registration_id ||
              JSON.stringify(freshUser.permissions || []) !== JSON.stringify(activeUser.permissions || []);

            if (isServerVersionDifferent || hasEssentialDiff) {
              const merged = {
                ...freshUser,
                permissions: freshUser.permissions || activeUser.permissions || []
              };
              setCurrentUser(merged);
              currentUserRef.current = merged;
              saveSessionMetadata(merged, serverVersion);

              // Reavaliar acesso à tela caso os privilégios tenham sido modificados
              const newRole = (merged.role || '').toUpperCase();
              const newJob = (merged.job_title || '').toUpperCase();
              const isNowAdmin = newRole === 'ADMIN' || merged.is_full_admin || newJob.includes('ADMINISTRADOR') || newJob.includes('ADMIN');
              if (!isNowAdmin && currentView === 'dashboard') {
                setCurrentView('time-tracking');
              }
            } else {
              localStorage.setItem(SESSION_SYNC_TIMESTAMP_KEY, Date.now().toString());
              window.dispatchEvent(new CustomEvent('vialivre-sync-timestamp-updated', { 
                detail: { timestamp: Date.now(), version: localVersion } 
              }));
            }
          }
        }
      }
      if (c.status === 'fulfilled') setCompanies(c.value || []);
      if (v.status === 'fulfilled') setVehicles(v.value || []);
      if (rep.status === 'fulfilled') setReports(rep.value || []);
      if (cit.status === 'fulfilled') setCities(cit.value || []);
      if (n.status === 'fulfilled') setNotices(n.value || []);
      if (insp.status === 'fulfilled') setInspections(insp.value || []);
      if (booths.status === 'fulfilled') setTicketBooths(booths.value || []);
      if (bst.status === 'fulfilled') setBusStations(bst.value || []);
      if (cfg.status === 'fulfilled' && cfg.value && cfg.value.length > 0) setTicketingConfig(cfg.value[0]);
      if (roles.status === 'fulfilled') {
        const roleData = roles.value || [];
        setRoleConfigs(roleData);
        
        // Sync currentUser permissions stably from role config if defined
        if (activeUser && roleData.length > 0) {
          const targetJob = (activeUser.job_title || activeUser.role || '').toUpperCase();
          const roleConf = roleData.find(rc => rc.name?.toUpperCase() === targetJob);
          if (roleConf && roleConf.permissions && roleConf.permissions.length > 0) {
            const currentPerms = activeUser.permissions || [];
            const hasDiff = roleConf.permissions.some(p => !currentPerms.includes(p)) || currentPerms.some(p => !roleConf.permissions?.includes(p));
            if (hasDiff) {
              const updated = { ...activeUser, permissions: roleConf.permissions };
              setCurrentUser(updated);
              try {
                localStorage.setItem('fluxo_session_user', JSON.stringify(updated));
              } catch (e) {}
            }
          }
        }
      }
      if (notifs.status === 'fulfilled') setNotifications(notifs.value || []);
      if (sfts.status === 'fulfilled') setShifts(sfts.value || []);
      if (fines.status === 'fulfilled') setUserFines(fines.value || []);
      if (skns.status === 'fulfilled') setSkins(skns.value || []);
      if (tt.status === 'fulfilled' && activeUser) {
        const today = getLocalDateStr();
        const todayEntry = (tt.value as TimeEntry[] || []).find(e => e.date === today && e.user_id === activeUser.id);
        const isFullAdmin = activeUser.role === 'ADMIN' || activeUser.is_full_admin || (activeUser.job_title || '').toUpperCase().includes('ADMINISTRADOR');
        setIsClockedIn(isFullAdmin ? true : !!todayEntry?.clock_in);
      } else if (tt.status === 'rejected' || !activeUser) {
        const isFullAdmin = activeUser?.role === 'ADMIN' || activeUser?.is_full_admin || (activeUser?.job_title || '').toUpperCase().includes('ADMINISTRADOR');
        setIsClockedIn(isFullAdmin ? true : false);
      }
      if (subs.status === 'fulfilled') {
        if (subs.value && subs.value.length > 0) {
          const activeSub = subs.value[0] as Subscription;
          setSubscription(activeSub);
          
          // Check for 6th day trial warning
          if (activeSub.plan_type === 'TRIAL' && activeSub.status === 'ACTIVE') {
            const expiresAt = new Date(activeSub.expires_at);
            const now = new Date();
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // If 1 day left (6th day of 7), and user is admin
            if (diffDays === 1 && !localStorage.getItem(`vialivre_trial_warned_${activeSub.id}`)) {
              setShowTrialWarning(true);
            }
          }
        } else if (activeUser && db.getSystemId() && activeUser.role === 'ADMIN') {
          // Auto-create 7-day trial if no subscription exists
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + 7);
          const newTrial: Partial<Subscription> = {
            system_id: db.getSystemId()!,
            plan_type: 'TRIAL' as any,
            activated_at: new Date().toISOString(),
            expires_at: trialExpires.toISOString(),
            status: 'ACTIVE' as any,
            created_at: new Date().toISOString()
          };
          db.create('subscriptions', newTrial).then(s => {
            if (s) setSubscription(s as Subscription);
          });
        }
      }
      if (settings.status === 'fulfilled' && settings.value && settings.value.length > 0) {
        const s = { ...settings.value[0] };
        if (s.system_logo) {
          s.system_logo = `${s.system_logo.split('?')[0]}?t=${Date.now()}`;
        }
        const compLower = (s.company_name || '').trim().toLowerCase();
        const sysLower = (s.system_name || '').trim().toLowerCase();
        if (
          !s.system_name ||
          (compLower && sysLower === compLower) ||
          sysLower.includes('viação') ||
          sysLower.includes('viacao') ||
          sysLower.includes('nicolau') ||
          sysLower.includes("d'rio") ||
          sysLower.includes('consorcio imperial') ||
          sysLower.includes('consórcio imperial') ||
          sysLower.includes('transportes')
        ) {
          s.system_name = 'ViaLivre Gestão';
        }
        setSystemSettings(s);
      }
    } catch (e) {
      addToast("Erro ao conectar com o banco de dados.", "error");
    } finally { 
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const handleSyncComplete = (e: CustomEvent) => {
      const syncedCount = e.detail?.syncedCount;
      if (syncedCount && syncedCount > 0) {
        addToast(`Sincronizado: ${syncedCount} ${syncedCount === 1 ? 'item salvo' : 'itens salvos'}`, 'success');
      }
    };

    const handleRefreshData = () => {
      loadInitialData();
    };

    const handleShowToast = (e: CustomEvent) => {
      if (e.detail?.message) {
        addToast(e.detail.message, e.detail.type || 'info');
      }
    };

    const handleDataChanged = () => {
      loadInitialData();
    };

    window.addEventListener('vialivre-sync-complete' as any, handleSyncComplete as any);
    window.addEventListener('vialivre-refresh-data' as any, handleRefreshData as any);
    window.addEventListener('vialivre-data-changed' as any, handleDataChanged as any);
    window.addEventListener('vialivre-show-toast' as any, handleShowToast as any);

    return () => {
      window.removeEventListener('vialivre-sync-complete' as any, handleSyncComplete as any);
      window.removeEventListener('vialivre-refresh-data' as any, handleRefreshData as any);
      window.removeEventListener('vialivre-data-changed' as any, handleDataChanged as any);
      window.removeEventListener('vialivre-show-toast' as any, handleShowToast as any);
    };
  }, [addToast, loadInitialData]);

  const handleRealtimeEvent = useCallback((table: string, payload: any) => {
    const { eventType, new: newItem, old: oldItem } = payload;

    const syncList = (prev: any[]) => {
      const currentList = Array.isArray(prev) ? prev : [];
      if (eventType === 'INSERT' && newItem) {
        const exists = currentList.some(item => item.id === newItem.id);
        return exists ? currentList.map(item => item.id === newItem.id ? newItem : item) : [newItem, ...currentList];
      }
      if (eventType === 'UPDATE' && newItem) {
        const exists = currentList.some(item => item.id === newItem.id);
        return exists ? currentList.map(item => item.id === newItem.id ? newItem : item) : [newItem, ...currentList];
      }
      if (eventType === 'DELETE') {
        const targetId = oldItem?.id || newItem?.id;
        return currentList.filter(item => item.id !== targetId);
      }
      return currentList;
    };

    switch (table) {
      case 'trips': 
        setTrps(syncList); 
        if (eventType === 'INSERT' && currentUser && newItem) {
          if (newItem.driver_id === currentUser.id || newItem.conductor_id === currentUser.id || newItem.fiscal_id === currentUser.id) {
            addToast(`VOCÊ TEM UMA NOVA ESCALA: ${newItem.departure_time} - Carro ${newItem.bus_number}`, 'success');
            NotificationService.sendLocalNotification("Nova Escala de Viagem", { 
              body: `Você foi escalado para a viagem das ${newItem.departure_time} (Viatura ${newItem.bus_number}).`
            });
          }
        }
        break;
      case 'occurrences': setReports(syncList); break;
      case 'users': 
        setUsers(syncList);
        if (currentUser) {
          if (eventType === 'UPDATE' && newItem && newItem.id === currentUser.id) {
            const newVersion = computeUserVersion(newItem);
            const mergedUser = {
              ...newItem,
              permissions: newItem.permissions || currentUser.permissions || []
            };
            setCurrentUser(mergedUser);
            currentUserRef.current = mergedUser;
            saveSessionMetadata(mergedUser, newVersion);

            // Reavaliar acesso à tela caso privilégios tenham sido alterados
            const userRole = (mergedUser.role || '').toUpperCase();
            const userJob = (mergedUser.job_title || '').toUpperCase();
            const isFullAdmin = userRole === 'ADMIN' || mergedUser.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
            if (!isFullAdmin && currentView === 'dashboard') {
              setCurrentView('time-tracking');
            }

            // Forçar recarga imediata sem debounce para sincronizar instantaneamente todas as abas e permissões
            loadInitialData();
            return;
          } else if (eventType === 'DELETE' && (oldItem?.id === currentUser.id || newItem?.id === currentUser.id)) {
            clearSessionMetadata();
            handleSetUser(null);
            return;
          }
        }
        break;
      case 'routes': setRoutes(syncList); break;
      case 'companies': setCompanies(syncList); break;
      case 'vehicles': setVehicles(syncList); break;
      case 'cities': setCities(syncList); break;
      case 'notices': 
        setNotices(syncList); 
        if (eventType === 'INSERT' && newItem) {
          const userRole = currentUser?.role || 'PASSENGER';
          if (userRole === 'ADMIN' || newItem.target_role === 'ALL' || newItem.target_role === userRole) {
            const notificationBody = newItem.attachment_info 
              ? `${newItem.content}\n\nAnexo: ${newItem.attachment_info}`
              : newItem.content;
            addToast(`Novo Alerta: ${newItem.title}`, 'info');
            NotificationService.sendLocalNotification(newItem.title, { body: notificationBody });
          }
        }
        break;
      case 'inspections': setInspections(syncList); break;
      case 'shifts': setShifts(syncList); break;
      case 'driver_logs': 
        window.dispatchEvent(new CustomEvent('vialivre-driverlogs-updated', { detail: { eventType, newItem, oldItem } }));
        break;
      case 'ticket_sales':
        window.dispatchEvent(new CustomEvent('vialivre-ticketsales-updated', { detail: { eventType, newItem, oldItem } }));
        break;
      case 'payroll_rubrics':
        window.dispatchEvent(new CustomEvent('vialivre-rubrics-updated', { detail: { eventType, newItem, oldItem } }));
        break;
      case 'ticket_booths': setTicketBooths(syncList); break;
      case 'bus_stations': setBusStations(syncList); break;
      case 'traffic_violations': setUserFines(syncList); break;
      case 'user_fines': setUserFines(syncList); break;
      case 'notifications': 
        setNotifications(syncList); 
        if (eventType === 'INSERT' && newItem) {
          const matchesRole = !newItem.target_role || newItem.target_role === 'ALL' || newItem.target_role === currentUser?.role || currentUser?.role === 'ADMIN' || newItem.user_id === currentUser?.id;
          if (matchesRole) {
            addToast(`Novo Alerta: ${newItem.title}`, newItem.type === 'ERROR' ? 'error' : newItem.type === 'WARNING' ? 'warning' : 'info');
            NotificationService.sendLocalNotification(newItem.title || 'Novo Alerta - ViaLivre', {
              body: newItem.message || 'Novo comunicado no sistema.',
              icon: 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png'
            });
          }
        }
        break;
      case 'skins': setSkins(syncList); break;
      case 'time_tracking': 
        window.dispatchEvent(new CustomEvent('vialivre-timetracking-updated', { detail: { eventType, newItem, oldItem } }));
        if (currentUser) {
          const isFullAdmin = currentUser.role === 'ADMIN' || currentUser.is_full_admin || (currentUser.job_title || '').toUpperCase().includes('ADMINISTRADOR');
          if (isFullAdmin) {
            setIsClockedIn(true);
          } else {
            const today = getLocalDateStr();
            if (eventType === 'INSERT' && newItem?.user_id === currentUser.id && newItem?.date === today) {
              setIsClockedIn(!!newItem.clock_in);
            } else if (eventType === 'UPDATE' && newItem?.user_id === currentUser.id && newItem?.date === today) {
              setIsClockedIn(!!newItem.clock_in);
            } else if (eventType === 'DELETE' && (oldItem?.user_id === currentUser.id || newItem?.user_id === currentUser.id) && (oldItem?.date === today || newItem?.date === today)) {
              setIsClockedIn(false);
            }
          }
        }
        break;
      case 'system_settings':
        if (newItem) {
          setSystemSettings(newItem);
          try {
            localStorage.setItem('vialivre_system_settings', JSON.stringify(newItem));
          } catch (e) {}
          applyThemeVariables(newItem.theme_color);
        }
        break;
      case 'role_configs': 
        setRoleConfigs(syncList); 
        if (currentUser) {
          loadInitialData();
          return;
        }
        break;
      case 'activation_keys': 
        db.getSubscriptions().then(subs => subs && subs.length > 0 && setSubscription(subs[0]));
        break;
      case 'subscriptions':
        db.getSubscriptions().then(subs => subs && subs.length > 0 && setSubscription(subs[0]));
        break;
      case 'ticketing_config': 
        db.getTicketingConfig().then(cfg => cfg && cfg.length > 0 && setTicketingConfig(cfg[0]));
        break;
    }

    // Debounced general refresh to ensure relations and calculations stay in sync
    if (debounceTimers.current['general_sync']) clearTimeout(debounceTimers.current['general_sync']);
    debounceTimers.current['general_sync'] = window.setTimeout(() => {
      loadInitialData();
    }, 1500);
  }, [addToast, currentUser, currentView, loadInitialData]);

  useEffect(() => {
    if (!currentUser && !isPassengerMode) {
      return;
    }
    
    // Initial fetch
    loadInitialData();

    // Setup Realtime Channel
    const channel = db.initializeRealtime(handleRealtimeEvent);
    
    const handleDataRefresh = () => {
      loadInitialData();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData();
      }
    };

    // Auto-refresh interval (every 12s) to guarantee automatic multi-device synchronization
    const autoSyncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadInitialData();
      }
    }, 12000);

    window.addEventListener('vialivre-refresh-data', handleDataRefresh);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleDataRefresh);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => { 
      clearInterval(autoSyncInterval);
      channel.unsubscribe(); 
      window.removeEventListener('vialivre-refresh-data', handleDataRefresh);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleDataRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [currentUser, isPassengerMode, loadInitialData, handleRealtimeEvent]);

  useEffect(() => {
    const savedUser = localStorage.getItem('fluxo_session_user');
    if (savedUser) {
      try { 
        const u = JSON.parse(savedUser);
        db.setSystemId(u.system_id || null);
        setCurrentUser(u);
        currentUserRef.current = u;

        // Initialize session version and timestamp if not already present
        if (!localStorage.getItem(SESSION_VERSION_KEY)) {
          localStorage.setItem(SESSION_VERSION_KEY, computeUserVersion(u));
        }
        if (!localStorage.getItem(SESSION_SYNC_TIMESTAMP_KEY)) {
          localStorage.setItem(SESSION_SYNC_TIMESTAMP_KEY, Date.now().toString());
        }

        const userRole = (u.role || '').toUpperCase();
        const userJob = (u.job_title || '').toUpperCase();
        const isFullAdmin = userRole === 'ADMIN' || u.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');

        if (isFullAdmin) {
          const savedView = localStorage.getItem('fluxo_current_view');
          setCurrentView(savedView || 'dashboard');
        } else {
          setCurrentView('time-tracking');
        }
        
        // Auto trigger tutorial for all collaborators if not seen
        if (u.role && u.role !== 'PASSENGER' && !localStorage.getItem('fluxo_tutorial_seen')) {
          setTimeout(() => {
            setShowTutorial(true);
          }, 1500);
        }
      } 
      catch (e) { localStorage.removeItem('fluxo_session_user'); setIsLoading(false); }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Navigation Restriction & Auto Clock-out Logic
  useEffect(() => {
    if (!currentUser) return;

    const userRole = (currentUser.role || '').toUpperCase();
    const userJob = (currentUser.job_title || '').toUpperCase();
    const isFullAdmin = userRole === 'ADMIN' || currentUser.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');

    // Dashboard restrito exclusivamente a Administrador
    if (!isFullAdmin && currentView === 'dashboard') {
      setCurrentView('time-tracking');
      return;
    }

    const isCollaborator = ['DRIVER', 'CONDUCTOR', 'FISCAL', 'TICKET_AGENT', 'MECHANIC'].includes(currentUser.role) ||
      userJob.includes('MOTORISTA') || userJob.includes('COBRADOR');
    if (!isCollaborator) return;

    // Restriction Logic: Unlock if clocked in
    const isRestrictedView = currentView !== 'time-tracking' && currentView !== 'about';
    if (isClockedIn === false && isRestrictedView) {
      setCurrentView('time-tracking');
      addToast("Acesso restrito: Por favor, registre sua entrada (Ponto Eletrônico) para liberar as outras funções.", "warning");
    }

    // Auto Clock-out Logic
    const checkAutoClockOut = async () => {
      const today = getLocalDateStr();
      const now = new Date();
      const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

      // Find today's shift
      const todayShift = shifts.find(s => s.driver_id === currentUser.id && s.date === today);
      if (!todayShift) return;

      // Find today's time entry
      const tt = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const todayEntry = tt.find(e => e.date === today && e.user_id === currentUser.id);

      if (todayEntry && todayEntry.clock_in && !todayEntry.clock_out) {
        // If current time > shift end time + some buffer (e.g., 30 mins)
        // Or simply if shift end time is passed
        if (currentTimeStr > todayShift.end_time) {
          await db.update('time_tracking' as any, {
            ...todayEntry,
            clock_out: todayShift.end_time,
            notes: (todayEntry.notes || '') + ' [Encerrado automaticamente pelo sistema após fim da escala]'
          });
          addToast("Seu ponto foi encerrado automaticamente pois sua escala de trabalho chegou ao fim.", "info");
        }
      }
    };

    const timer = setInterval(checkAutoClockOut, 60000); // Check every minute
    checkAutoClockOut(); // Initial check

    return () => clearInterval(timer);
  }, [currentUser, isClockedIn, currentView, addToast, shifts]);

  // Automated Weekly Backup Trigger & Export Function
  const runBackupExport = async (isManual = false) => {
    try {
      addToast(isManual ? "Iniciando exportação de segurança..." : "Iniciando cópia de segurança semanal automática...", "success");
      
      const tables: TableName[] = [
        'routes', 'trips', 'users', 'companies', 'vehicles', 'occurrences', 
        'cities', 'notices', 'ticket_sales', 'maintenance', 'inspections', 
        'ticketing_config', 'payroll_rubrics', 'role_configs', 'notifications', 
        'shifts', 'time_tracking', 'driver_logs', 'system_settings', 'imp_cards', 
        'imp_card_recharges', 'user_occurrences', 'traffic_violations', 'user_fines', 
        'job_applications', 'job_vacancies', 'skins', 'trips_audit', 
        'subscriptions', 'ticket_booths', 'bus_stations'
      ];

      const backupData: Record<string, any[]> = {};

      for (const table of tables) {
        try {
          const tableData = await db.fetchAll(table);
          backupData[table] = tableData || [];
        } catch (tableErr) {
          console.warn(`Erro ao exportar tabela ${table}:`, tableErr);
          backupData[table] = [];
        }
      }

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const todayStr = new Date().toISOString().split('T')[0];
      const backupFileName = `vialivre_backup_completo_${todayStr}.json`;
      link.href = url;
      link.download = backupFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // URL.revokeObjectURL(url); // Don't revoke immediately to keep notification downloads functional
      
      localStorage.setItem('vialivre_last_weekly_backup_timestamp', Date.now().toString());
      addToast(
        isManual 
          ? "Cópia de segurança criada e baixada com sucesso!" 
          : "Backup semanal automático concluído! Arquivo JSON salvo com sucesso.", 
        "success"
      );

      if (!isManual && currentUser) {
        try {
          await MockNotificationService.notifyAdminAboutBackup(
            currentUser.id,
            currentUser.email || 'admin@vialivre.com',
            backupFileName,
            url,
            currentUser.system_id
          );
          loadInitialData(); // Reload definitions so system notification instantly renders
        } catch (notifErr) {
          console.error("Erro ao registrar notificações do backup automático:", notifErr);
        }
      }
    } catch (err: any) {
      console.error("Erro ao gerar backup de dados:", err);
      addToast("Erro ao processar cópia de segurança de dados.", "error");
    }
  };

  // Run weekly backup trigger inside React lifecycle
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    const lastBackupTime = localStorage.getItem('vialivre_last_weekly_backup_timestamp');
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    if (!lastBackupTime || (now - Number(lastBackupTime)) >= oneWeekMs) {
      const timer = setTimeout(() => {
        runBackupExport(false);
      }, 5000); // Wait 5 seconds after mount to trigger safely
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const handleSetUser = (user: User | null) => {
      if (user) {
          db.setSystemId(user.system_id || null);
          setCurrentUser(user);
          currentUserRef.current = user;
          saveSessionMetadata(user);
          setShowWelcome(true);
          setTimeout(() => {
            setShowWelcome(false);
            if (user.role && user.role !== 'PASSENGER' && !localStorage.getItem('fluxo_tutorial_seen')) {
              setShowTutorial(true);
            }
          }, 3500);
          
          // Determine initial view based on role: only full admin enters dashboard, all other roles start in time-tracking
          const userRole = (user.role || '').toUpperCase();
          const userJob = (user.job_title || '').toUpperCase();
          const isFullAdmin = userRole === 'ADMIN' || user.is_full_admin || userJob.includes('ADMINISTRADOR') || userJob.includes('ADMIN');
          
          if (isFullAdmin) {
              setCurrentView('dashboard');
          } else {
              // Todos os outros cargos entram em Ponto Eletrônico
              setCurrentView('time-tracking');
          }
          // Fetch fresh isolated system data for this user/device
          loadInitialData();
      } else {
          db.setSystemId(null);
          clearSessionMetadata();
          setCurrentUser(null);
          currentUserRef.current = null;
          setIsPassengerMode(false);
          setShowPassengerTicketing(false);
          setIsSidebarOpen(false);
          setShowGoodbye(true);
          setTimeout(() => {
            setShowGoodbye(false);
          }, 1800);
      }
  };

  const handleNotificationClick = useCallback((notif: AppNotification) => {
    if (notif.link) {
      setCurrentView(notif.link);
      setNotificationMetadata(notif.metadata);
    }
    if (!notif.is_read) {
      db.update('notifications', { id: notif.id, is_read: true }).then(() => loadInitialData());
    }
  }, [loadInitialData]);

  const handleAction = async (action: 'create' | 'update' | 'delete', table: TableName, itemOrId: any) => {
    try {
        let res;
        if (action === 'create') {
          const payloadWithUser = { ...itemOrId };
          if (currentUser?.id && !payloadWithUser.user_id && !['companies', 'cities', 'routes', 'vehicles', 'skins'].includes(table)) {
            payloadWithUser.user_id = currentUser.id;
          }
          if (currentUser?.id && !payloadWithUser.created_by) {
            payloadWithUser.created_by = currentUser.id;
          }
          if (currentUser?.system_id && !payloadWithUser.system_id) {
            payloadWithUser.system_id = currentUser.system_id;
          }
          res = await db.create(table, payloadWithUser);
          if (table === 'notices' && res) {
            await db.create<AppNotification>('notifications', {
              title: `Novo Comunicado: ${(res as any).title}`,
              message: (res as any).content,
              type: 'INFO',
              category: 'SYSTEM',
              target_role: (res as any).target_role || 'ALL',
              user_id: currentUser?.id,
              system_id: currentUser?.system_id,
              is_read: false,
              created_at: new Date().toISOString()
            });
            
            // Send local notification
            NotificationService.sendLocalNotification(`Novo Comunicado: ${(res as any).title}`, {
              body: (res as any).content,
              icon: '/favicon.ico'
            });
          }
        }
        else if (action === 'update') {
          const payloadWithSystem = { ...itemOrId };
          if (currentUser?.system_id && !payloadWithSystem.system_id) {
            payloadWithSystem.system_id = currentUser.system_id;
          }
          res = await db.update(table, payloadWithSystem);
        }
        else {
          let id = '';
          if (typeof itemOrId === 'string') {
            id = itemOrId;
          } else if (itemOrId && typeof itemOrId === 'object' && typeof itemOrId.id === 'string') {
            id = itemOrId.id;
          } else if (itemOrId && typeof itemOrId === 'object' && (itemOrId.nativeEvent || itemOrId.target || itemOrId.preventDefault)) {
            console.error('handleAction delete received a React event instead of an ID', itemOrId);
            addToast('Erro ao excluir: ID inválido.', 'error');
            return null;
          } else {
            id = String(itemOrId || '');
          }

          if (!id) {
            addToast('Erro ao excluir: ID não fornecido.', 'error');
            return null;
          }

          if (table === 'routes') setRoutes(prev => prev.filter(x => x.id !== id));
          else if (table === 'trips') setTrps(prev => prev.filter(x => x.id !== id));
          else if (table === 'users') setUsers(prev => prev.filter(x => x.id !== id));
          else if (table === 'companies') setCompanies(prev => prev.filter(x => x.id !== id));
          else if (table === 'vehicles') setVehicles(prev => prev.filter(x => x.id !== id));
          else if (table === 'occurrences') setReports(prev => prev.filter(x => x.id !== id));
          else if (table === 'cities') setCities(prev => prev.filter(x => x.id !== id));
          else if (table === 'notices') setNotices(prev => prev.filter(x => x.id !== id));
          else if (table === 'inspections') setInspections(prev => prev.filter(x => x.id !== id));
          else if (table === 'ticket_booths') setTicketBooths(prev => prev.filter(x => x.id !== id));
          else if (table === 'bus_stations') setBusStations(prev => prev.filter(x => x.id !== id));
          else if (table === 'user_fines') setUserFines(prev => prev.filter(x => x.id !== id));
          else if (table === 'shifts') setShifts(prev => prev.filter(x => x.id !== id));
          else if (table === 'notifications') setNotifications(prev => prev.filter(x => x.id !== id));
          else if (table === 'skins') setSkins(prev => prev.filter(x => x.id !== id));

          res = await db.delete(table, id);
        }
        if (res) {
          addToast("Operação concluída com sucesso.", "success");
          loadInitialData();
          return true;
        }
        return null;
    } catch (error: any) {
        addToast(error.message || "Falha operacional no banco de dados.", "error");
        return null;
    }
  };

  const handleUpdateSystemSettings = useCallback(async (newSettings: Partial<SystemSettings> | SystemSettings) => {
    setSystemSettings(prev => {
      const updated: SystemSettings = {
        id: prev?.id || 'sys-set-001',
        system_id: prev?.system_id || db.getSystemId() || 'sys-vialivre-default',
        system_name: prev?.system_name || 'ViaLivre Gestão',
        company_name: prev?.company_name || 'ViaLivre Gestão',
        registration_pattern: prev?.registration_pattern || 'FLX-000',
        theme_color: prev?.theme_color || 'yellow',
        glass_effect: prev?.glass_effect !== false,
        support_email: prev?.support_email || 'via.nicolau.sa@gmail.com',
        ...newSettings
      };

      try {
        localStorage.setItem('vialivre_system_settings', JSON.stringify(updated));
      } catch (e) {}

      const root = document.documentElement;
      if (updated.theme_color) {
        const { primary, dark } = resolveThemeColors(updated.theme_color);
        root.style.setProperty('--primary-color', primary);
        root.style.setProperty('--primary-color-dark', dark);
      }
      if (updated.glass_effect === false) {
        root.classList.add('glass-disabled');
        root.classList.remove('glass-enabled');
      } else {
        root.classList.remove('glass-disabled');
        root.classList.add('glass-enabled');
      }

      return updated;
    });

    try {
      const current = await db.getSystemSettings();
      if (current && current.length > 0) {
        await db.update('system_settings', { ...current[0], ...newSettings });
      } else {
        await db.create('system_settings', {
          id: 'sys-set-001',
          system_id: db.getSystemId() || 'sys-vialivre-default',
          system_name: 'ViaLivre Gestão',
          company_name: 'ViaLivre Gestão',
          registration_pattern: 'FLX-000',
          theme_color: 'yellow',
          glass_effect: true,
          support_email: 'via.nicolau.sa@gmail.com',
          ...newSettings
        });
      }
    } catch (err) {
      console.error('Error updating system settings:', err);
    }
  }, []);

  const handleSendSystemNotification = async (driverId: string, message: string) => {
    const driver = users.find(u => u.id === driverId);
    if (!driver) {
      addToast("Motorista não encontrado.", "error");
      return;
    }

    try {
      const notifTitle = 'Alerta de Viagem';
      // Log notification in system
      await handleAction('create', 'notifications', {
        id: Math.random().toString(36).substr(2, 9),
        user_id: driverId,
        title: notifTitle,
        message: message,
        type: 'ERROR',
        category: 'SCHEDULE',
        is_read: false,
        created_at: new Date().toISOString()
      });
      NotificationService.sendLocalNotification(notifTitle, {
        body: message,
        icon: 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png'
      });
      MockNotificationService.sendPush(driverId, notifTitle, message);
      addToast(`Notificação enviada para ${driver.full_name || driver.name}`);
    } catch (error) {
      addToast("Erro ao enviar notificação.", "error");
    }
  };

  const handlePurgeData = async () => {
    setIsPurging(true);
    try {
      const tablesToClear = db.getIsolatedTables();
      // Keep subscriptions table to mark it as EXPIRED or similar? 
      // Actually the user said "todos os cadastros realizados no sistema serão apagados automaticamente"
      // I should clear everything except maybe the subscription itself (to prevent immediate re-trial?)
      // or clear that too.
      
      for (const table of tablesToClear) {
        if (table === 'subscriptions') continue;
        await db.clearTable(table);
      }
      
      // Mark subscription as canceled/expired
      if (subscription) {
        await db.update('subscriptions', { ...subscription, status: 'CANCELED' });
      }
      
      addToast("Todos os dados do sistema foram apagados com sucesso.", "success");
      setShowTrialWarning(false);
      handleSetUser(null); // Logout
    } catch (error) {
      console.error('Error purging data:', error);
      addToast("Erro ao apagar dados do sistema.", "error");
    } finally {
      setIsPurging(false);
    }
  };

  const handleKeepSystem = () => {
    const phone = systemSettings?.support_phone || '5511999999999'; // Default or from settings
    const message = encodeURIComponent(`Olá! Meu período de teste no ViaLivre Gestão está terminando e gostaria de adquirir uma assinatura para manter meus dados.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    
    // Mark as warned so it doesn't pop up every refresh until next day
    if (subscription) {
      localStorage.setItem(`vialivre_trial_warned_${subscription.id}`, 'true');
    }
    setShowTrialWarning(false);
  };

  if (isLoading) {
    return <SystemLoadingScreen systemLogo={systemSettings?.system_logo} />;
  }

  if (showWelcome) {
    return (
      <WelcomeLoadingScreen 
        currentUser={currentUser} 
        systemLogo={systemSettings?.system_logo} 
        onFinish={() => {
          setShowWelcome(false);
          if (currentUser?.role && currentUser.role !== 'PASSENGER' && !localStorage.getItem('fluxo_tutorial_seen')) {
            setShowTutorial(true);
          }
        }} 
      />
    );
  }

  if (showGoodbye) return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white z-[1000] fixed inset-0"
      >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="p-10 bg-zinc-900 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-6 border-4 border-yellow-400 w-full max-sm mx-4"
          >
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-yellow-400 border border-white/10 overflow-hidden"
              >
                  {systemSettings?.system_logo ? (
                    <img src={`${systemSettings.system_logo.split('?')[0]}?t=${Date.now()}`} className="w-full h-full object-contain" alt="Logo" referrerPolicy="no-referrer" />
                  ) : (
                    <Coffee size={40} />
                  )}
              </motion.div>
              <div className="text-center">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Bom descanso!</h1>
                  <div className="px-6 py-2 bg-yellow-400 text-slate-900 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg">Dia Finalizado</div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 text-center leading-relaxed italic">Suas sessões foram encerradas<br/>com segurança em todos os terminais.</p>
          </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (isPassengerMode) {
    if (showPassengerTicketing) {
      return (
        <TicketAgentInterface 
          routes={routes} 
          trips={trips} 
          vehicles={vehicles} 
          companies={companies} 
          cities={cities}
          currentUser={null} 
          ticketingConfig={ticketingConfig} 
          onExit={() => {
            setShowPassengerTicketing(false);
            setNotificationMetadata(null);
          }} 
          addToast={addToast} 
          isPassengerView={true}
          initialTripId={notificationMetadata?.trip_id}
          initialRouteId={notificationMetadata?.route_id}
          initialPassengerData={notificationMetadata?.passengerData}
        />
      );
    }
    return (
      <PassengerInterface 
        routes={routes} 
        trips={trips} 
        companies={companies} 
        cities={cities} 
        notices={notices} 
        vehicles={vehicles} 
        addToast={addToast} 
        systemSettings={systemSettings}
        onUpdateSettings={handleUpdateSystemSettings}
        themeMode={themeMode || 'light'}
        onChangeThemeMode={(mode) => setThemeMode(mode)}
        onExit={() => setIsPassengerMode(false)} 
        onOpenTicketing={(tripId, passengerData, routeId) => {
          setNotificationMetadata({
            trip_id: tripId,
            passengerData: passengerData,
            route_id: routeId
          });
          setShowPassengerTicketing(true);
        }}
      />
    );
  }
  if (!currentUser) return <LoginScreen onLogin={handleSetUser} onRegister={handleSetUser} onPassengerAccess={() => setIsPassengerMode(true)} themeMode={themeMode} setThemeMode={setThemeMode} resolvedTheme={themeMode} systemSettings={systemSettings} />;

  // Subscription check logic
  const isSubscriptionExpired = () => {
    if (!subscription) return false;
    if (subscription.plan_type === 'LIFETIME') return false;
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    return expiresAt < now;
  };

  if (isSubscriptionExpired()) {
    return (
      <SubscriptionExpired 
        onLogout={() => handleSetUser(null)} 
        onKeyActivated={(newSub) => {
          setSubscription(newSub);
        }}
        addToast={addToast}
        currentUser={currentUser}
        subscription={subscription}
      />
    );
  }

  const commonProps = { 
    onForceBackup: () => runBackupExport(true),
    routes, 
    trips, 
    users, 
    companies, 
    vehicles, 
    reports, 
    cities, 
    notices, 
    currentUser, 
    inspections, 
    ticketingConfig, 
    addToast, 
    subscription, 
    skins, 
    systemSettings, 
    ticketBooths, 
    busStations,
    onUpdateSettings: handleUpdateSystemSettings,
    userFines,
    roleConfigs,
    shifts,
    notifications,
    loadInitialData,
    handleNotificationClick,
    handleSendSystemNotification,
    importUserData,
    setImportUserData,
    setCurrentView,
    notificationMetadata,
    setNotificationMetadata,
    isMobile,
    handleAddTrip,
    handleUpdateTrip,
    handleDeleteTrip
  };

  return (
    <ErrorBoundary>
      <GlobalTopProgressBar currentView={currentView} />
      <div className={`h-screen w-screen overflow-hidden grid grid-rows-[auto_1fr] ${systemSettings?.glass_effect !== false ? 'bg-slate-100/40 dark:bg-zinc-950/90' : 'bg-white dark:bg-zinc-950'} text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
        <Topbar 
          currentView={currentView as ViewState} 
          onChangeView={(v) => setCurrentView(v as ViewState)} 
          onLogout={() => handleSetUser(null)} 
          onEditProfile={(user) => {
            setCurrentView('users');
            setImportUserData(user);
          }}
          isOpen={isSidebarOpen} 
          onClose={()=>setIsSidebarOpen(false)} 
          onToggle={()=>setIsSidebarOpen(!isSidebarOpen)} 
          currentUser={currentUser} 
          userRoleConfig={roleConfigs.find(rc => rc.name?.toUpperCase() === (currentUser?.job_title || currentUser?.role || '').toUpperCase()) || null}
          themeMode={themeMode} 
          onToggleTheme={()=>setThemeMode(themeMode === 'light' ? 'dark' : 'light')} 
          onChangeThemeMode={(mode) => setThemeMode(mode)}
          onUpdateSettings={handleUpdateSystemSettings}
          unreadNotificationsCount={notifications.filter(n => {
            if (n.is_read) return false;
            if (currentUser?.role === 'ADMIN') return true;
            if (n.user_id === currentUser?.id) return true;
            if (!n.user_id && (!n.target_role || n.target_role === 'ALL' || n.target_role === currentUser?.role)) return true;
            return false;
          }).length} 
          systemSettings={systemSettings} 
          users={users}
          vehicles={vehicles}
          routes={routes}
          notices={notices}
          trips={trips}
          onOpenGuidedTour={() => setShowGuidedTourModal(true)}
        />
        
        <main key={currentView} className="w-full max-w-[1920px] mx-auto grid grid-cols-1 gap-6 px-4 sm:px-8 py-6 h-full overflow-y-auto custom-scrollbar transition-all pb-24">
          <AnimatePresence>
            {githubUpdateVersion && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-950 dark:bg-zinc-900 border-2 border-yellow-400 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center text-slate-950 shrink-0 shadow-lg relative">
                      <RefreshCw size={22} className="animate-spin text-slate-900" style={{ animationDuration: '4s' }} />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] bg-yellow-400 text-slate-950 font-black uppercase tracking-widest px-2.5 py-1 rounded-lg leading-none">ATUALIZAÇÃO DISPONÍVEL</span>
                        <p className="text-sm font-black text-white uppercase tracking-wider">Nova Versão no GitHub: {githubUpdateVersion}</p>
                      </div>
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mt-1.5 leading-relaxed max-w-2xl">
                        Uma nova atualização de software do sistema foi detectada no repositório. Solicita-se que o usuário atualize a página para recarregar o sistema com os últimos patches e melhorias.
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full md:w-auto px-8 py-4 bg-yellow-400 text-slate-950 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-yellow-300 transition-all hover:scale-[1.03] active:scale-95 shrink-0"
                  >
                    Atualizar Agora (Recarregar)
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <TabTransitionLoader currentView={currentView as ViewState}>
            <ViewContent currentView={currentView as ViewState} commonProps={commonProps} handleAction={handleAction} />
          </TabTransitionLoader>
        </main>

        <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-xs sm:max-w-sm w-full pointer-events-none px-3 sm:px-0">
          <AnimatePresence>
            {(toasts || []).map(toast => (
              <motion.div 
                key={toast.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className={`pointer-events-auto px-3.5 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2.5 border text-xs font-semibold backdrop-blur-md transition-all ${
                  toast.type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-400/30 shadow-emerald-950/20' :
                  toast.type === 'error' ? 'bg-red-600/95 text-white border-red-400/30 shadow-red-950/20' :
                  toast.type === 'warning' ? 'bg-amber-500/95 text-slate-950 border-amber-300/40 shadow-amber-950/20' :
                  'bg-slate-900/95 text-white border-slate-700/50 shadow-slate-950/20'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {toast.type === 'success' && <CheckCircle2 size={15} className="shrink-0 text-emerald-200"/>}
                  {toast.type === 'error' && <AlertCircle size={15} className="shrink-0 text-red-200"/>}
                  {toast.type === 'warning' && <AlertTriangle size={15} className="shrink-0 text-amber-950"/>}
                  {toast.type === 'info' && <Info size={15} className="shrink-0 text-blue-300"/>}
                  <span className="truncate tracking-tight">{toast.message}</span>
                </div>
                <button 
                  onClick={() => setToasts(prev => (prev || []).filter(t => t.id !== toast.id))} 
                  className="opacity-70 hover:opacity-100 shrink-0 p-0.5"
                >
                  <X size={13}/>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {errorModal && (
            <div 
              className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto overscroll-contain"
              onClick={() => setErrorModal(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <AlertCircle className="text-red-600" size={20} />
                    </div>
                    <h3 className="text-sm font-black text-red-600 uppercase tracking-widest">Erro no Sistema</h3>
                  </div>
                  <button 
                    onClick={() => setErrorModal(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8">
                  <p className="text-slate-600 dark:text-zinc-400 font-bold text-center leading-relaxed">
                    {errorModal.message}
                  </p>
                  <button 
                    onClick={() => setErrorModal(null)}
                    className="w-full mt-8 py-4 bg-slate-900 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black dark:hover:bg-zinc-700 transition-all shadow-lg active:scale-95"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTrialWarning && (
            <div className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto overscroll-contain">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden"
              >
                <div className="p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-yellow-400 rounded-3xl mx-auto flex items-center justify-center text-slate-900 shadow-xl border-4 border-white dark:border-zinc-800">
                    <AlertTriangle size={40} className="fill-current" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">
                      Período de Teste Quase Expirado!
                    </h2>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                      Sua licença de teste gratuito de 7 dias expira em breve (6º dia). Para continuar gerenciando sua frota e manter seus dados salvos, você deve adquirir uma assinatura.
                    </p>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[2rem] border-2 border-red-100 dark:border-red-900/50 shadow-inner">
                    <div className="flex items-center justify-center gap-3 text-red-600 dark:text-red-400 mb-2">
                      <AlertCircle size={20} className="animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest">Atenção: Ação Irreversível</span>
                    </div>
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-black leading-tight uppercase text-center bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
                      CASO SELECCIONE "NÃO", TODOS OS SEUS DADOS (VEÍCULOS, LINHAS, CLIENTES, VENDAS) SERÃO APAGADOS DEFINITIVAMENTE DO BANCO DE DADOS AGORA.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4">
                    <button 
                      onClick={handleKeepSystem}
                      className="w-full bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Sparkles size={18} className="text-yellow-400 dark:text-slate-900" />
                      Manter meu Sistema
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (window.confirm("VOCÊ TEM CERTEZA? Se selecionar 'NÃO', TODOS os cadastros realizados no sistema serão apagados AUTOMATICAMENTE agora. Esta ação é IRREVERSÍVEL.")) {
                          handlePurgeData();
                        }
                      }}
                      disabled={isPurging}
                      className="w-full text-slate-400 hover:text-red-600 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all transition-colors"
                    >
                      {isPurging ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
                      Não, não desejo manter
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>



        {showTutorial && (() => {
          const userRole = currentUser?.role || 'ADMIN';
          const tut = ROLE_TUTORIALS[userRole === 'TICKET_AGENT' ? 'AGENTE' : userRole] || ROLE_TUTORIALS.ADMIN;
          return (
            <div className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl overflow-y-auto overscroll-contain">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col my-8"
              >
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">{tut.title}</h2>
                    <p className="text-[10px] font-black text-yellow-400 uppercase mt-1">{tut.subtitle}</p>
                  </div>
                  <button onClick={() => { setShowTutorial(false); localStorage.setItem('fluxo_tutorial_seen', 'true'); }} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-slate-900 font-black">1</div>
                        {tut.step1Title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-bold">
                        {tut.step1Desc}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-slate-900 font-black">2</div>
                        {tut.step2Title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-bold">
                        {tut.step2Desc}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Resumo das Funcionalidades da sua Conta:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {tut.features.map(item => (
                        <div key={item.l} className="p-3 bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700">
                          <p className="text-[9px] font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">{item.l}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase leading-tight">{item.d}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-3xl border-2 border-dashed border-yellow-400">
                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase text-center italic">
                      {tut.quote}
                    </p>
                  </div>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-zinc-900 border-t dark:border-zinc-800 flex justify-center">
                  <button 
                    onClick={() => { setShowTutorial(false); localStorage.setItem('fluxo_tutorial_seen', 'true'); }}
                    className="px-12 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl border-2 border-slate-900 active:scale-95 transition-all"
                  >
                    Entendido, vamos lá!
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* Global Guided Interactive Tour Modal */}
        <GuidedTourModal
          isOpen={showGuidedTourModal}
          onClose={() => setShowGuidedTourModal(false)}
          currentView={currentView}
          onChangeView={(v) => setCurrentView(v as ViewState)}
        />

        {/* Global Landscape Orientation Detection & Suggestion Overlay */}
        <OrientationOverlay />
      </div>
    </ErrorBoundary>
  );
};

export default App;
