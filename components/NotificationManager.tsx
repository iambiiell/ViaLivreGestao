
import React, { useState, useMemo, useEffect } from 'react';
import { Bell, Search, Filter, CheckCircle2, AlertTriangle, Info, Trash2, Clock, Settings, Plus, X, Save, Loader2, Edit3, Archive, FolderOpen, Download } from 'lucide-react';
import { AppNotification, User, Trip, Vehicle, Route, OccurrenceReport, SystemSettings } from '../types';
import { db, supabase } from '../services/database';
import { WebPushConfig } from './WebPushConfig';
import { NotificationService } from '../services/NotificationService';

interface NotificationManagerProps {
  notifications: AppNotification[];
  currentUser: User | null;
  addToast: (m: string, t?: any) => void;
  onRefresh: () => void;
  onNotificationClick?: (notif: AppNotification) => void;
  onDeleteNotification?: (id: string) => void;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, currentUser, addToast, onRefresh, onNotificationClick, onDeleteNotification }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'important' | 'archived'>('all');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prefs, setPrefs] = useState(currentUser?.notification_preferences || {
    schedule: true,
    delay: true,
    maintenance: true,
    inspection: true,
    occurrence: true,
    ticketing: true
  });

  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('vialivre_archived_notifications');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleArchiveNotification = (id: string) => {
    const nextArchived = [...archivedIds, id];
    setArchivedIds(nextArchived);
    localStorage.setItem('vialivre_archived_notifications', JSON.stringify(nextArchived));
    addToast("Notificação arquivada.", "success");
  };

  const handleUnarchiveNotification = (id: string) => {
    const nextArchived = archivedIds.filter(x => x !== id);
    setArchivedIds(nextArchived);
    localStorage.setItem('vialivre_archived_notifications', JSON.stringify(nextArchived));
    addToast("Notificação de volta na caixa de entrada.", "success");
  };

  const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'rules' | 'webpush'>('alerts');

  // Edit Notification States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<AppNotification | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedDetailAlert, setSelectedDetailAlert] = useState<AppNotification | null>(null);

  const handleOpenEditModal = (notif: AppNotification) => {
    setEditingNotification(notif);
    setEditTitle(notif.title);
    setEditMessage(notif.message);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingNotification) return;
    setIsSavingEdit(true);
    try {
      await db.update('notifications', {
        id: editingNotification.id,
        title: editTitle,
        message: editMessage
      });
      addToast("Notificação atualizada com sucesso!", "success");
      setIsEditModalOpen(false);
      setEditingNotification(null);
      onRefresh();
    } catch (e) {
      addToast("Erro ao atualizar notificação.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const [rulesConfig, setRulesConfig] = useState(() => {
    const saved = localStorage.getItem('maintenance_rules_thresholds');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      preventiveDays: 180,
      preventiveKm: 10000,
      enableDelayRule: true,
      enableMaintenanceRule: true
    };
  });

  const runAutomationRules = async () => {
    try {
      // 1. Fetch current data from single source of truth
      const [trips, vehicles, logs, configSettingsList, notifications, routes, occurrences, timeTracking] = await Promise.all([
        db.fetchAll<Trip>('trips'),
        db.fetchAll<Vehicle>('vehicles'),
        db.fetchAll<any>('maintenance'),
        db.fetchAll<SystemSettings>('system_settings'),
        db.fetchAll<AppNotification>('notifications'),
        db.fetchAll<Route>('routes'),
        db.fetchAll<OccurrenceReport>('occurrences'),
        db.fetchAll<any>('time_tracking')
      ]);

      const configSettings = { data: configSettingsList };
      const sysSettings = configSettingsList?.[0] as any;
      const timeEntries = timeTracking || [];
      const existingNotifs = notifications || [];

      const parseMetadata = (meta: any) => {
        if (!meta) return {};
        if (typeof meta === 'string') {
          try { return JSON.parse(meta); } catch (e) { return {}; }
        }
        return meta;
      };

      const newNotificationsToInsert: any[] = [];
      const tripsToUpdateToAtrasada: Trip[] = [];

      // --- RULE 1: Trip delays (> 15 min) ---
      const now = new Date();
      if (rulesConfig.enableDelayRule) {
        // Current date in YYYY-MM-DD (aligned with timezone)
        const todayDateStr = now.toLocaleDateString('en-CA'); // Gets YYYY-MM-DD safely
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentMinutesSinceMidnight = currentHour * 60 + currentMin;

        // Filter today's trips that are still "Agendada"
        const pendingTodayTrips = trips.filter(t => 
          t.status === 'Agendada' && 
          t.trip_date === todayDateStr
        );

        pendingTodayTrips.forEach(trip => {
          if (!trip.departure_time) return;
          const [depHourStr, depMinStr] = trip.departure_time.split(':');
          const depHour = parseInt(depHourStr, 10);
          const depMin = parseInt(depMinStr, 10);
          const depMinutesSinceMidnight = depHour * 60 + depMin;

          // Check if current time is > 15 minutes past scheduled departure time
          if (currentMinutesSinceMidnight - depMinutesSinceMidnight > 15) {
            // Check if we ALREADY have a notification for this trip in existingNotifs
            const alertAlreadyExists = existingNotifs.some(n => {
              const meta = parseMetadata(n.metadata);
              return n.category === 'DELAY' && meta && meta.trip_id === trip.id;
            });

            if (!alertAlreadyExists) {
              const route = routes.find((r: any) => r.id === trip.route_id);
              const routeLabel = route ? `Linha ${route.prefixo_linha || ''} (${route.origin} x ${route.destination})` : `ID ${trip.route_id}`;
              
              newNotificationsToInsert.push({
                system_id: currentUser?.system_id,
                user_id: null,
                title: `⚠️ Viagem com Atraso Crítico (>15 min)`,
                message: `A viagem com partida prevista para as ${trip.departure_time} na ${routeLabel}, motorista ${trip.driver_name || 'Não escalado'} está com atraso de mais de 15 minutos e não foi iniciada.`,
                type: 'WARNING',
                category: 'DELAY',
                target_role: 'ADMIN',
                is_read: false,
                created_at: new Date().toISOString(),
                metadata: { trip_id: trip.id, delay_rule: true, trip_date: trip.trip_date }
              });

              // Mark the trip as "Atrasada" automatically
              tripsToUpdateToAtrasada.push({
                ...trip,
                status: 'Atrasada' as any
              });
            }
          }
        });
      }

      // --- RULE 2: Maintenance Overdue (by configured days & km thresholds) ---
      if (rulesConfig.enableMaintenanceRule) {
        vehicles.forEach(v => {
          const vehicleLogs = logs.filter(l => l.vehicle_id === v.id);
          const lastPreventive = vehicleLogs
            .filter(l => l.service_type === 'PREVENTIVA')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          const limitDays = rulesConfig.preventiveDays || 180;
          const limitKm = rulesConfig.preventiveKm || 10000;
          
          let isOverdueByTime = false;
          let isOverdueByKm = false;
          let accumulatedKm = 0;
          let lastDateStr = 'Sem registro';

          if (lastPreventive) {
            lastDateStr = lastPreventive.date;
            const prevDateObj = new Date(lastPreventive.date);
            const diffDays = Math.ceil((now.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays > limitDays) {
              isOverdueByTime = true;
            }

            // Calculate KM accumulated since last preventive date
            const tripsSincePrev = trips.filter(t => 
              t.bus_number === v.prefix && 
              new Date(t.trip_date) >= prevDateObj
            );

            tripsSincePrev.forEach(trip => {
              if (trip.final_odometer && trip.initial_odometer) {
                accumulatedKm += (trip.final_odometer - trip.initial_odometer);
              } else {
                const r = routes.find((route: any) => route.id === trip.route_id);
                accumulatedKm += (r?.distance_km || 0);
              }
            });

            if (accumulatedKm > limitKm) {
              isOverdueByKm = true;
            }
          } else {
            // No preventive maintenance found, overdue by default!
            isOverdueByTime = true;
            isOverdueByKm = true;
          }

          if (isOverdueByTime || isOverdueByKm) {
            const reason = isOverdueByTime && isOverdueByKm 
              ? `limite de tempo (> ${limitDays} dias) e quilometragem (> ${limitKm} km) excedidos`
              : isOverdueByTime 
                ? `limite de tempo (> ${limitDays} dias) excedido` 
                : `quilometragem alcançada (${Math.round(accumulatedKm)} km / limite: ${limitKm} km)`;

            // Unique signature combining vehicle ID and alert limits state to avoid redundancy
            const signature = `${v.id}-${lastDateStr}-${limitDays}-${limitKm}`;

            const alertAlreadyExists = existingNotifs.some(n => {
              const meta = parseMetadata(n.metadata);
              return n.category === 'MAINTENANCE' && meta && meta.signature === signature;
            });

            if (!alertAlreadyExists) {
              newNotificationsToInsert.push({
                system_id: currentUser?.system_id,
                user_id: null,
                title: `🔧 Preventiva Vencida: #${v.prefix}`,
                message: `O veículo de prefixo #${v.prefix} (${v.model || ''}) está com a manutenção preventiva vencida por ${reason}. Último registro: ${lastDateStr === 'Sem registro' ? 'Nunca realizado' : new Date(lastDateStr).toLocaleDateString('pt-BR')}.`,
                type: 'ERROR',
                category: 'MAINTENANCE',
                target_role: 'ADMIN',
                is_read: false,
                created_at: new Date().toISOString(),
                metadata: { 
                  vehicle_id: v.id, 
                  maintenance_rule: true, 
                  signature,
                  accumulated_km: accumulatedKm, 
                  limit_km: limitKm,
                  limit_days: limitDays,
                  last_preventive_date: lastDateStr 
                }
              });
            }
          }
        });
      }

      // --- RULE 3: Occurrences / Ocorrências ---
      occurrences.forEach(occ => {
        const alertAlreadyExists = existingNotifs.some(n => {
          const meta = parseMetadata(n.metadata);
          return n.category === 'OCCURRENCE' && meta && meta.occurrence_id === occ.id;
        });

        if (!alertAlreadyExists) {
          const occType = occ.type || 'Ocorrência';
          const isSevere = occType === 'SUSPENSAO' || occType === 'ATRASO' || occType === 'FALTA';
          
          newNotificationsToInsert.push({
            system_id: currentUser?.system_id,
            user_id: null,
            title: `🚨 Ocorrência Registrada: ${occType}`,
            message: `Nova ocorrência registrada em ${occ.date || 'Data recente'}: ${occ.description || 'Sem descrição'}.`,
            type: isSevere ? 'ERROR' : 'WARNING',
            category: 'OCCURRENCE',
            target_role: 'ADMIN',
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: { occurrence_id: occ.id, occurrence_rule: true }
          });
        }
      });

      // --- RULE 4: Time Tracking / Ponto Eletrônico ---
      const todayStr = now.toLocaleDateString('en-CA');
      timeEntries.forEach(entry => {
        const isMissingClockOut = entry.clock_in && !entry.clock_out && entry.date !== todayStr;
        const hasAnomaly = isMissingClockOut || (entry.total_daily_hours && entry.total_daily_hours > 12);

        if (hasAnomaly) {
          const alertAlreadyExists = existingNotifs.some(n => {
            const meta = parseMetadata(n.metadata);
            return n.category === 'TIME_TRACKING' && meta && meta.time_entry_id === entry.id;
          });

          if (!alertAlreadyExists) {
            newNotificationsToInsert.push({
              system_id: currentUser?.system_id,
              user_id: null,
              title: `⏱️ Alerta de Ponto Eletrônico`,
              message: `Registro de ponto incompleto ou pendência na data ${entry.date}: ${isMissingClockOut ? 'Saída não registrada (Clock-out pendente)' : 'Jornada excedida'}.`,
              type: 'WARNING',
              category: 'TIME_TRACKING',
              target_role: 'ADMIN',
              is_read: false,
              created_at: new Date().toISOString(),
              metadata: { time_entry_id: entry.id, time_tracking_rule: true }
            });
          }
        }
      });

      // 4. Perform insertions & updates if any
      let didTriggerChanges = false;

      if (newNotificationsToInsert.length > 0) {
        await Promise.all(newNotificationsToInsert.map(n => db.create('notifications', n)));
        didTriggerChanges = true;

        // Disparar notificações diretamente no dispositivo
        newNotificationsToInsert.forEach(notif => {
          NotificationService.sendLocalNotification(notif.title || 'Alerta de Frota - ViaLivre', {
            body: notif.message,
            icon: 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png'
          });
        });
      }

      if (tripsToUpdateToAtrasada.length > 0) {
        await Promise.all(tripsToUpdateToAtrasada.map(trip => 
          db.update('trips', { id: trip.id, status: 'Atrasada' } as any)
        ));
        didTriggerChanges = true;
      }

      if (didTriggerChanges) {
        onRefresh();
      }

    } catch (err) {
      console.error("[AUTO_RULES_ERROR] Falha ao processar regras automáticas:", err);
    }
  };

  useEffect(() => {
    NotificationService.requestPermission();
    if (currentUser) {
      runAutomationRules();
    }
    const sub = db.subscribeTable('notifications', () => {
      onRefresh();
    });
    return () => sub.unsubscribe();
  }, [currentUser]);

  const handleSavePrefs = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await db.update('users', { 
        id: currentUser.id, 
        notification_preferences: prefs 
      });
      addToast("Preferências de notificação salvas!", "success");
      setIsConfigModalOpen(false);
      onRefresh();
    } catch (e) {
      addToast("Erro ao salvar preferências.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        const title = (n.title || '').toLowerCase();
        const message = (n.message || '').toLowerCase();
        const search = searchTerm.toLowerCase();

        const matchesSearch = title.includes(search) || message.includes(search);
        
        const isArchived = archivedIds.includes(n.id);
        
        if (filter === 'archived') {
          if (!isArchived) return false;
        } else {
          if (isArchived) return false;
        }

        const matchesFilter = filter === 'archived' ||
                             filter === 'all' || 
                             (filter === 'unread' && !n.is_read) || 
                             (filter === 'important' && n.type === 'ERROR');
                             
        const matchesRole = currentUser?.role === 'ADMIN' || 
                           (n.user_id === currentUser?.id) || 
                           (!n.user_id && (!n.target_role || n.target_role === 'ALL' || n.target_role === currentUser?.role));

        // Category filter matching logic
        let matchesCategory = true;
        if (categoryFilter !== 'all') {
          if (categoryFilter === 'MAINTENANCE') {
            matchesCategory = n.category === 'MAINTENANCE';
          } else if (categoryFilter === 'DELAY') {
            matchesCategory = n.category === 'DELAY';
          } else if (categoryFilter === 'OCCURRENCE') {
            matchesCategory = n.category === 'OCCURRENCE';
          } else if (categoryFilter === 'TIME_TRACKING') {
            matchesCategory = n.category === 'TIME_TRACKING';
          } else if (categoryFilter === 'other') {
            matchesCategory = n.category !== 'MAINTENANCE' && n.category !== 'DELAY' && n.category !== 'OCCURRENCE' && n.category !== 'TIME_TRACKING';
          }
        }
                           
        return matchesSearch && matchesFilter && matchesRole && matchesCategory;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications, searchTerm, filter, currentUser, categoryFilter, archivedIds]);

  const handleMarkAsRead = async (id: string) => {
    setAnimatingOutIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(async () => {
      try {
        await db.update('notifications', { id, is_read: true });
        onRefresh();
      } catch (e) {
        addToast("Erro ao marcar como lida.", "error");
      } finally {
        setAnimatingOutIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta notificação?')) return;
    
    setAnimatingOutIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(async () => {
      try {
        if (onDeleteNotification) {
          await onDeleteNotification(id);
        } else {
          await db.delete('notifications', id);
        }
        onRefresh();
        addToast("Notificação excluída.", "success");
      } catch (e) {
        console.error('Erro ao excluir notificação:', e);
        addToast("Erro ao excluir.", "error");
      } finally {
        setAnimatingOutIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 500);
  };

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => db.update('notifications', { id: n.id, is_read: true })));
      onRefresh();
      addToast("Todas marcadas como lidas.", "success");
    } catch (e) {
      addToast("Erro ao processar.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Deseja realmente excluir todos os alertas listados?')) return;
    setIsLoading(true);
    try {
      if (onDeleteNotification) {
        await Promise.all(filteredNotifications.map(n => onDeleteNotification(n.id)));
      } else {
        await Promise.all(filteredNotifications.map(n => db.delete('notifications', n.id)));
      }
      onRefresh();
      addToast("Todos os alertas filtrados foram removidos com sucesso.", "success");
    } catch (e) {
      addToast("Erro ao excluir todos os alertas.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getBadgeTooltip = (n: AppNotification) => {
    if (n.category === 'DELAY') {
      return `Atraso Crítico: Viagem com partida pendente por mais de 15 minutos do horário planejado.`;
    }
    if (n.category === 'MAINTENANCE') {
      const limitDays = n.metadata?.limit_days || rulesConfig.preventiveDays;
      const limitKm = n.metadata?.limit_km || rulesConfig.preventiveKm;
      const currentKm = n.metadata?.accumulated_km ? Math.round(n.metadata.accumulated_km) : null;
      let kmInfo = currentKm !== null ? `(${currentKm} km rodados)` : 'completou limite de rodagem';
      return `Manutenção Preventiva Vencida: Veículo ultrapassou o limiar de ${limitDays} dias ou ${limitKm} km recomendados ${kmInfo}.`;
    }
    if (n.category === 'OCCURRENCE') {
      return `Ocorrência de Funcionário: Registro de ocorrência operacional ou de RH cadastrado no sistema.`;
    }
    if (n.category === 'TIME_TRACKING') {
      return `Ponto Eletrônico: Alerta de inconsistência, jornada excedida ou registro de saída pendente.`;
    }
    if (n.type === 'ERROR') {
      return `Grave: Incidente crítico de prioridade máxima no sistema de frotas.`;
    }
    return `Informativo: Operador e despacho comunicados de evento em conformidade com o sistema.`;
  };

  return (
    <div id="notifications-view-container" className="space-y-6 animate-in fade-in transition-all pb-24">
      {/* HEADER */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Centro de Alertas</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Monitoramento em tempo real de eventos do sistema</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleMarkAllRead}
              disabled={isLoading || !notifications.some(n => !n.is_read)}
              className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              className="p-3 bg-yellow-400 text-slate-900 rounded-xl shadow-lg border-2 border-slate-900 active:scale-95 transition-all"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-[1.8rem] border border-slate-100 dark:border-zinc-800 shadow-sm max-w-xl">
        <button 
          type="button"
          onClick={() => setActiveSubTab('alerts')} 
          className={`flex-1 py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'alerts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-305'}`}
        >
          📋 Alertas Recebidos
        </button>
        {currentUser?.role === 'ADMIN' && (
          <button 
            type="button"
            onClick={() => setActiveSubTab('rules')} 
            className={`flex-1 py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'rules' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-305'}`}
          >
            ⚙️ Regras & Lembretes
          </button>
        )}
        <button 
          type="button"
          onClick={() => setActiveSubTab('webpush')} 
          className={`flex-1 py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'webpush' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-305'}`}
        >
          🔔 Web Push & SW
        </button>
      </div>

      {/* CARD CONFIG REGRAS DE MANUTENÇÃO (EXCLUSIVO ADMIN) */}
      {currentUser?.role === 'ADMIN' && activeSubTab === 'rules' && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-850 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-400 text-slate-900 rounded-2xl">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Regras de Alertas Automáticos de Manutenção</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Defina os limites de dias e quilometragem para vistorias preventivas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 dark:bg-zinc-805 rounded-2xl border border-slate-100 dark:border-zinc-800/50 space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-500">Limiar de Tempo (Dias)</label>
              <input 
                type="number" 
                className="w-full p-4 bg-white dark:bg-zinc-950 border-2 border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs"
                value={rulesConfig.preventiveDays}
                onChange={e => setRulesConfig({ ...rulesConfig, preventiveDays: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 180"
              />
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Frequência recomendada de preventiva em dias.</p>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-zinc-805 rounded-2xl border border-slate-100 dark:border-zinc-800/50 space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-500">Limiar de Quilometragem (KM)</label>
              <input 
                type="number" 
                className="w-full p-4 bg-white dark:bg-zinc-950 border-2 border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs"
                value={rulesConfig.preventiveKm}
                onChange={e => setRulesConfig({ ...rulesConfig, preventiveKm: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 10000"
              />
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Distância máxima percorrida recomendada em quilômetros.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-yellow-400 rounded"
                  checked={rulesConfig.enableDelayRule}
                  onChange={e => setRulesConfig({ ...rulesConfig, enableDelayRule: e.target.checked })}
                />
                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400">Habilitar atrasos automáticos (&gt;15 min)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-yellow-400 rounded"
                  checked={rulesConfig.enableMaintenanceRule}
                  onChange={e => setRulesConfig({ ...rulesConfig, enableMaintenanceRule: e.target.checked })}
                />
                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400">Habilitar revisão preventiva automática</span>
              </label>
            </div>

            <button 
              onClick={async () => {
                localStorage.setItem('maintenance_rules_thresholds', JSON.stringify(rulesConfig));
                addToast("Configurações de regras salvas! Reavaliando a frota...", "success");
                await runAutomationRules();
              }}
              className="px-6 py-3 bg-yellow-400 text-slate-900 border-2 border-slate-950 active:scale-95 shadow-md font-black uppercase text-[10px] tracking-widest hover:bg-yellow-500 rounded-xl transition-all h-fit"
            >
              Aplicar & Salvar Regras
            </button>
          </div>
        </div>
      )}

      {/* FILTER & LIST TAB */}
      {activeSubTab === 'alerts' && (
        <>
          {/* FILTERS */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-4 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar nos alertas..." 
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-transparent focus:border-yellow-400 outline-none text-[10px] font-black uppercase shadow-sm transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl shadow-sm border dark:border-zinc-800 flex-wrap">
              {(['all', 'unread', 'important', 'archived'] as const).map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200'}`}
                >
                  {f === 'all' ? 'Todos' : f === 'unread' ? 'Não Lidos' : f === 'important' ? 'Importantes' : 'Arquivados'}
                </button>
              ))}
            </div>
          </div>

          {/* CATEGORY FILTERS */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center mr-2">Categoria:</span>
              {([
                { value: 'all', label: 'Todas' },
                { value: 'MAINTENANCE', label: '🔧 Manutenção' },
                { value: 'DELAY', label: '⏰ Atraso' },
                { value: 'OCCURRENCE', label: '🚨 Ocorrências' },
                { value: 'TIME_TRACKING', label: '⏱️ Ponto' },
                { value: 'other', label: '⚙️ Geral' }
              ] as const).map(cat => (
                <button 
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat.value ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {filteredNotifications.length > 0 && (
              <button 
                onClick={handleDeleteAll}
                disabled={isLoading}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 dark:border-red-900/55 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 size={14} /> Remover Todos ({filteredNotifications.length})
              </button>
            )}
          </div>

          {/* LIST */}
          <div className="grid gap-4">
            {filteredNotifications.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
                <Bell className="mx-auto text-slate-200 mb-4" size={48}/>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum alerta encontrado.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isAnimatingOut = animatingOutIds.has(n.id);
                // Define side border color depending on category (red for delay, yellow for maintenance, blue for other/geral)
                const borderLeftClass = n.category === 'DELAY'
                  ? 'border-l-[12px] border-l-red-500'
                  : n.category === 'MAINTENANCE'
                    ? 'border-l-[12px] border-l-yellow-400'
                    : 'border-l-[12px] border-l-blue-500';

                return (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      setSelectedDetailAlert(n);
                      onNotificationClick?.(n);
                    }}
                    className={`notification-item bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-2 ${borderLeftClass} flex flex-col sm:flex-row items-start gap-4 sm:gap-6 group cursor-pointer transition-all duration-500 transform ${
                      isAnimatingOut 
                        ? 'notification-item-fadeout opacity-0 -translate-x-12 scale-90 blur-lg max-h-0 py-0 my-0 border-transparent overflow-hidden pointer-events-none'
                        : n.is_read 
                          ? 'border-slate-100 dark:border-zinc-850 opacity-45 scale-[0.98] blur-[0.2px] hover:opacity-80 hover:scale-100 transition-all' 
                          : 'border-yellow-400 shadow-lg'
                    } hover:border-yellow-500`}
                  >
                {/* TOOLTIP ON HOVER SPECIFICATIONS */}
                <div className={`status-indicator-badge relative p-4 rounded-2xl shrink-0 transition-all group/badge ${
                  n.type === 'ERROR' ? 'bg-red-50 dark:bg-red-950/20 text-red-500 animate-pulse border border-red-200/50' : 
                  n.type === 'WARNING' || n.category === 'DELAY' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-500 animate-pulse border border-orange-200/50' : 
                  'bg-blue-50 dark:bg-blue-950/20 text-blue-500'
                }`}>
                  {n.type === 'ERROR' ? <AlertTriangle size={24}/> : 
                   n.type === 'WARNING' || n.category === 'DELAY' ? <Clock size={24}/> : 
                   <Info size={24}/>}

                  {/* PREMIUM HTML TOOLTIP */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-slate-905 dark:bg-zinc-800 text-slate-100 dark:text-zinc-100 text-[9px] font-black uppercase tracking-wider p-3 rounded-2xl border-2 border-yellow-400 opacity-0 group-hover/badge:opacity-100 transition-all duration-300 shadow-2xl z-50 text-center scale-95 group-hover/badge:scale-100 leading-normal">
                    {getBadgeTooltip(n)}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-yellow-400 w-0 h-0"></div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-sm leading-tight flex items-center gap-2">
                        {!n.is_read && (
                          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" title="Não lida" />
                        )}
                        {n.title}
                      </h3>
                      <p className={`status-indicator-badge mt-1 inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                        n.category === 'DELAY' || n.category === 'MAINTENANCE' || n.type === 'ERROR'
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 animate-pulse border border-rose-200 dark:border-rose-900/30 font-extrabold shadow-sm'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {new Date(n.created_at).toLocaleString('pt-BR')} • {n.category}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center self-end sm:self-auto shrink-0">
                      {!n.is_read && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(n.id);
                          }} 
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                          title="Marcar como lida"
                        >
                          <CheckCircle2 size={18}/>
                        </button>
                      )}
                      {archivedIds.includes(n.id) ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchiveNotification(n.id);
                          }} 
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                          title="Desarquivar"
                        >
                          <FolderOpen size={18}/>
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveNotification(n.id);
                          }} 
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                          title="Arquivar"
                        >
                          <Archive size={18}/>
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.id);
                        }} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Excluir"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{n.message}</p>
                  {n.metadata?.download_url && (
                    <div className="mt-4 flex">
                      <a 
                        href={n.metadata.download_url} 
                        download={n.metadata.file_name || "vialivre_backup_completo.json"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-slate-900 text-[10px] font-black uppercase rounded-xl shadow-lg transition-all border-2 border-slate-900 tracking-wider"
                      >
                        <Download size={14} className="animate-pulse" /> Baixar Cópia (.JSON)
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}

      {/* WEBPUSH SETTINGS TAB */}
      {activeSubTab === 'webpush' && (
        <WebPushConfig currentUser={currentUser} addToast={addToast} />
      )}

      {/* CONFIG MODAL */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurar Alertas</h3>
                <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Personalização de Notificações</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativar Alertas Para:</p>
                {[
                  { id: 'schedule', label: 'Alterações de Horário' },
                  { id: 'delay', label: 'Atrasos de Viagem' },
                  { id: 'maintenance', label: 'Manutenções Vencendo' },
                  { id: 'inspection', label: 'Vistorias Pendentes' },
                  { id: 'occurrence', label: 'Novas Ocorrências' },
                  { id: 'ticketing', label: 'Vendas e Bilhetagem' }
                ].map(item => (
                  <label key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-pointer hover:border-yellow-400 transition-all">
                    <span className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase">{item.label}</span>
                    <input 
                      type="checkbox" 
                      checked={(prefs as any)[item.id] !== false} 
                      onChange={e => setPrefs({ ...prefs, [item.id]: e.target.checked })}
                      className="w-5 h-5 accent-yellow-400" 
                    />
                  </label>
                ))}
              </div>

              <button 
                onClick={handleSavePrefs}
                disabled={isLoading}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Salvar Preferências'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-blue-500 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Editar Alerta</h3>
                <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Alterar mensagem da notificação</p>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditingNotification(null); }} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Título do Alerta</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-500 transition-all dark:text-white"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Mensagem</label>
                  <textarea 
                    value={editMessage}
                    onChange={e => setEditMessage(e.target.value)}
                    rows={4}
                    className="w-full p-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-blue-500 transition-all dark:text-white"
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editTitle || !editMessage}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-950 transition-all flex items-center justify-center gap-2"
              >
                {isSavingEdit ? <Loader2 className="animate-spin" size={18}/> : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED POPUP MODAL */}
      {selectedDetailAlert && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[140] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl border dark:border-zinc-850 overflow-hidden flex flex-col max-h-[90vh] transition-colors animate-in zoom-in-95 duration-200">
            {/* Header with category and close */}
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors shrink-0">
              <div className="flex items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  selectedDetailAlert.category === 'DELAY' ? 'bg-red-105 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                  selectedDetailAlert.category === 'MAINTENANCE' ? 'bg-yellow-105 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' :
                  'bg-blue-105 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                }`}>
                  {selectedDetailAlert.category}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Detalhes do Alerta
                </span>
              </div>
              <button onClick={() => setSelectedDetailAlert(null)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform">
                <X size={32} />
              </button>
            </div>
            
            {/* Message, description, time and nice details */}
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950">
              <div className="flex items-start gap-4">
                <div className={`p-4 rounded-xl text-white shrink-0 ${
                  selectedDetailAlert.type === 'ERROR' ? 'bg-red-500' :
                  selectedDetailAlert.type === 'WARNING' || selectedDetailAlert.category === 'DELAY' ? 'bg-orange-500' :
                  'bg-blue-500'
                }`}>
                  {selectedDetailAlert.type === 'ERROR' ? <AlertTriangle size={28}/> : 
                   selectedDetailAlert.type === 'WARNING' || selectedDetailAlert.category === 'DELAY' ? <Clock size={28}/> : 
                   <Info size={28}/>}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">{selectedDetailAlert.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                    {new Date(selectedDetailAlert.created_at).toLocaleString('pt-BR')} (Horário Oficial Brasília)
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-305">
                <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Mensagem do Comunicado</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-bold">{selectedDetailAlert.message}</p>
              </div>

              {/* Advanced detailed block based on the type of notification */}
              <div className="border-t dark:border-zinc-800 pt-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" /> Metadados & Diagnóstico Técnico
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100/50 dark:border-zinc-800">
                    <p className="text-[8px] font-black uppercase text-slate-400">ID Único do Alerta</p>
                    <p className="text-xs font-mono font-bold text-slate-650 mt-1 truncate">{selectedDetailAlert.id}</p>
                  </div>
                  <div className="p-4 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100/50 dark:border-zinc-800">
                    <p className="text-[8px] font-black uppercase text-slate-400">Alvo de Visualização (Papel)</p>
                    <p className="text-xs font-black uppercase text-slate-600 mt-1">{selectedDetailAlert.target_role || 'TODOS (PÚBLICO)'}</p>
                  </div>
                </div>

                {selectedDetailAlert.metadata && Object.keys(selectedDetailAlert.metadata).filter(k => typeof selectedDetailAlert.metadata[k] !== 'object').length > 0 && (
                  <div className="p-6 bg-blue-50/10 dark:bg-zinc-900 rounded-2xl border border-blue-100/25 dark:border-zinc-800 space-y-3">
                    <p className="text-[8px] font-black uppercase text-blue-500 tracking-widest">Informações Extras de Telemetria</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                      {Object.entries(selectedDetailAlert.metadata).map(([mKey, mVal]) => {
                        if (typeof mVal === 'object' || mVal === null) return null;
                        return (
                          <div key={mKey} className="flex justify-between border-b dark:border-zinc-800 pb-1">
                            <span className="text-slate-400 uppercase text-[9px]">{mKey.replace(/_/g, ' ')}:</span>
                            <span className="text-slate-800 dark:text-zinc-250 font-mono text-[9px]">{mVal.toString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {selectedDetailAlert.metadata?.download_url && (
                <div className="mt-4 flex">
                  <a 
                    href={selectedDetailAlert.metadata.download_url} 
                    download={selectedDetailAlert.metadata.file_name || "vialivre_backup_completo.json"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-[11px] font-black uppercase rounded-2xl shadow-xl transition-all border-2 border-slate-900 tracking-wider"
                  >
                    <Download size={16} /> Baixar Cópia Completa (.JSON)
                  </a>
                </div>
              )}
            </div>

            {/* Modal footer with action buttons */}
            <div className="p-6 border-t dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-end gap-3 shrink-0">
              {!selectedDetailAlert.is_read && (
                <button 
                  onClick={() => {
                    handleMarkAsRead(selectedDetailAlert.id);
                    setSelectedDetailAlert(null);
                  }}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase"
                >
                  Marcar como Lida
                </button>
              )}
              <button 
                onClick={() => setSelectedDetailAlert(null)}
                className="px-6 py-3 bg-slate-200 dark:bg-zinc-850 text-slate-700 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
