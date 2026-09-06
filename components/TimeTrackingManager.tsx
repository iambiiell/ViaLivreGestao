import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, TimeEntry, AppNotification } from '../types';
import { 
  Timer, Clock, Play, Coffee, LogOut, CheckCircle2, Calendar, Search, 
  Loader2, AlertTriangle, TrendingUp, UserCheck, Plus, Edit3, Trash2, 
  FileText, ShieldCheck, RefreshCw, X, Save, MessageSquareText, Check, 
  HelpCircle, AlertCircle, CalendarDays, History, Filter, Printer, Download
} from 'lucide-react';
import { db, supabase } from '../services/database';
import { NotificationService } from '../services/NotificationService';

interface TimeTrackingManagerProps {
  currentUser: User | null;
  users?: User[];
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const getLocalDateStr = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type PeriodPreset = 'month' | 'last7' | 'last15' | 'last30' | 'custom';
type StatusFilter = 'all' | 'worked' | 'missing' | 'overtime' | 'justification';

const TimeTrackingManager: React.FC<TimeTrackingManagerProps> = ({ currentUser, users = [], addToast }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  
  // Período e Filtros de Histórico
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateStr(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => getLocalDateStr());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'today' | 'history'>('today');
  const [currentTime, setCurrentTime] = useState<string>(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Modal para lançamento/edição manual (Admin/RH)
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<TimeEntry> | null>(null);

  // Modal para Solicitação de Justificativa de Falta/Erro
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [justificationTargetDate, setJustificationTargetDate] = useState<string>(getLocalDateStr());
  const [justificationReason, setJustificationReason] = useState<string>('Esquecimento de Ponto');
  const [justificationNotes, setJustificationNotes] = useState<string>('');
  const [justificationProposedIn, setJustificationProposedIn] = useState<string>('08:00');
  const [justificationProposedBreakStart, setJustificationProposedBreakStart] = useState<string>('12:00');
  const [justificationProposedBreakEnd, setJustificationProposedBreakEnd] = useState<string>('13:00');
  const [justificationProposedOut, setJustificationProposedOut] = useState<string>('17:00');

  const isAdminOrRH = useMemo(() => {
    const role = (currentUser?.role || '').toUpperCase();
    const job = (currentUser?.job_title || '').toUpperCase();
    return role === 'ADMIN' || role === 'RH' || job.includes('ADMINISTRADOR') || job.includes('RECURSOS HUMANOS');
  }, [currentUser]);

  // Se o usuário não for Admin/RH, o alvo de visualização é sempre ele mesmo
  const targetUser = useMemo(() => {
    if (!isAdminOrRH || !selectedUserId) return currentUser;
    return users.find(u => u.id === selectedUserId) || currentUser;
  }, [isAdminOrRH, selectedUserId, users, currentUser]);

  const todayStr = useMemo(() => getLocalDateStr(), []);

  // Atualizar relógio em tempo real a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Entrada de hoje para o usuário selecionado
  const currentEntry = useMemo(() => {
    if (!targetUser) return undefined;
    return entries.find(e => e.date === todayStr && e.user_id === targetUser.id);
  }, [entries, todayStr, targetUser]);

  const targetUserId = targetUser?.id || currentUser?.id || '';

  // Carregar dados de ponto diretamente do Supabase Cloud (Single Source of Truth)
  const loadEntries = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const data = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const userEntries = targetUserId ? data.filter(e => e.user_id === targetUserId) : data;
      setEntries(userEntries);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error("Erro ao carregar histórico de ponto:", e);
      if (!silent) {
        addToast("Erro ao carregar histórico de ponto do servidor.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, addToast]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await db.syncPendingActions();
      }
      await loadEntries(false);
      addToast("Registros de ponto sincronizados com a nuvem!", "success");
    } catch (e) {
      console.warn("Erro ao sincronizar manualmente:", e);
      addToast("Erro ao sincronizar com o servidor.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadEntries(false);

    // Ouvinte para eventos de ponto e sincronização global entre componentes e dispositivos (modo silencioso)
    const handleTimeTrackingUpdated = () => {
      loadEntries(true);
    };

    const handleWindowFocus = () => {
      loadEntries(true);
    };

    window.addEventListener('vialivre-timetracking-updated' as any, handleTimeTrackingUpdated);
    window.addEventListener('vialivre-refresh-data' as any, handleTimeTrackingUpdated);
    window.addEventListener('vialivre-sync-complete' as any, handleTimeTrackingUpdated);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleTimeTrackingUpdated);

    // Assinatura Realtime Direta no Supabase para a tabela time_tracking
    let channel: any = null;
    try {
      channel = supabase
        .channel(`timetracking_live_${targetUserId || 'global'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_tracking' }, () => {
          loadEntries(true);
        })
        .subscribe();
    } catch (e) {
      console.warn('Erro ao assinar canal realtime de time_tracking:', e);
    }

    return () => {
      window.removeEventListener('vialivre-timetracking-updated' as any, handleTimeTrackingUpdated);
      window.removeEventListener('vialivre-refresh-data' as any, handleTimeTrackingUpdated);
      window.removeEventListener('vialivre-sync-complete' as any, handleTimeTrackingUpdated);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleTimeTrackingUpdated);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [targetUserId, loadEntries]);

  // Ações de Ponto em Tempo Real com Validação Estrita de Duplicidade e Transição
  const handleClockAction = async (action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out') => {
    if (!targetUser) return;
    setIsProcessing(true);
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = getLocalDateStr();
    
    try {
      const allDbEntries = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const userTodayEntries = allDbEntries.filter(e => e.user_id === targetUser.id && e.date === today);
      let activeEntry = userTodayEntries[0] || currentEntry;

      if (action === 'clock_in') {
        if (activeEntry && activeEntry.clock_in && activeEntry.clock_in.trim().length > 0) {
          addToast(`Entrada já registrada para hoje às ${activeEntry.clock_in}.`, "warning");
          setIsProcessing(false);
          return;
        }

        if (activeEntry) {
          const updated: TimeEntry = {
            ...activeEntry,
            user_id: targetUser.id,
            clock_in: nowTime
          };
          await db.update('time_tracking' as any, updated);
        } else {
          const newEntryData: Partial<TimeEntry> = {
            user_id: targetUser.id,
            date: today,
            clock_in: nowTime,
            system_id: currentUser?.system_id || 'sys-vialivre-default'
          };
          await db.create<TimeEntry>('time_tracking' as any, newEntryData);
        }
        addToast(`Entrada registrada com sucesso às ${nowTime}!`, "success");
      } 
      else if (action === 'break_start') {
        if (!activeEntry || !activeEntry.clock_in) {
          addToast("Erro: É necessário registrar a Entrada antes do Intervalo.", "error");
          setIsProcessing(false);
          return;
        }
        if (activeEntry.clock_out) {
          addToast("Erro: Jornada de hoje já finalizada.", "error");
          setIsProcessing(false);
          return;
        }
        if (activeEntry.break_start) {
          addToast(`Saída para intervalo já registrada às ${activeEntry.break_start}.`, "warning");
          setIsProcessing(false);
          return;
        }

        const { total_daily_hours, ...entryData } = activeEntry;
        const updated = {
          ...entryData,
          user_id: targetUser.id,
          break_start: nowTime
        };
        await db.update('time_tracking' as any, updated);
        addToast(`Saída para intervalo registrada às ${nowTime}!`, "success");
      }
      else if (action === 'break_end') {
        if (!activeEntry || !activeEntry.break_start) {
          addToast("Erro: Nenhuma saída para intervalo registrada hoje.", "error");
          setIsProcessing(false);
          return;
        }
        if (activeEntry.clock_out) {
          addToast("Erro: Jornada de hoje já finalizada.", "error");
          setIsProcessing(false);
          return;
        }
        if (activeEntry.break_end) {
          addToast(`Retorno do intervalo já registrado às ${activeEntry.break_end}.`, "warning");
          setIsProcessing(false);
          return;
        }

        const { total_daily_hours, ...entryData } = activeEntry;
        const updated = {
          ...entryData,
          user_id: targetUser.id,
          break_end: nowTime
        };
        await db.update('time_tracking' as any, updated);
        addToast(`Retorno de intervalo registrado às ${nowTime}!`, "success");
      }
      else if (action === 'clock_out') {
        if (!activeEntry || !activeEntry.clock_in) {
          addToast("Erro: É necessário registrar a Entrada antes da Saída.", "error");
          setIsProcessing(false);
          return;
        }
        if (activeEntry.clock_out) {
          addToast(`Saída já registrada hoje às ${activeEntry.clock_out}.`, "warning");
          setIsProcessing(false);
          return;
        }

        const { total_daily_hours, ...entryData } = activeEntry;
        let autoBreakEnd = entryData.break_end;
        if (entryData.break_start && !entryData.break_end) {
          autoBreakEnd = nowTime;
        }

        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return (h || 0) + (m || 0) / 60;
        };
        let hoursWorked = parseTime(nowTime) - parseTime(entryData.clock_in);
        if (entryData.break_start && autoBreakEnd) {
          hoursWorked -= (parseTime(autoBreakEnd) - parseTime(entryData.break_start));
        }
        if (hoursWorked < 0) hoursWorked += 24;

        const updated = {
          ...entryData,
          user_id: targetUser.id,
          break_end: autoBreakEnd,
          clock_out: nowTime,
          total_daily_hours: Math.max(0, Number(hoursWorked.toFixed(2)))
        };
        await db.update('time_tracking' as any, updated);
        addToast(`Fim de expediente registrado com sucesso às ${nowTime}!`, "success");
      }

      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (e) {
      console.error("Falha ao registrar ponto:", e);
      addToast("Falha técnica ao registrar ponto. Tente novamente.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Salvar registro manual (Admin/RH)
  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editingEntry.user_id || !editingEntry.date) {
      addToast("Selecione o colaborador e a data.", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      let total_daily_hours: number | undefined = undefined;
      if (editingEntry.clock_in && editingEntry.clock_out) {
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return (h || 0) + (m || 0) / 60;
        };
        let hours = parseTime(editingEntry.clock_out) - parseTime(editingEntry.clock_in);
        if (editingEntry.break_start && editingEntry.break_end) {
          hours -= (parseTime(editingEntry.break_end) - parseTime(editingEntry.break_start));
        }
        if (hours < 0) hours += 24;
        total_daily_hours = Math.max(0, Number(hours.toFixed(2)));
      }

      const payload = {
        ...editingEntry,
        system_id: currentUser?.system_id || 'sys-vialivre-default',
        total_daily_hours
      };

      if (editingEntry.id) {
        await db.update('time_tracking' as any, payload as any);
        addToast("Registro de ponto atualizado com sucesso!", "success");
      } else {
        await db.create('time_tracking' as any, payload);
        addToast("Novo registro de ponto inserido!", "success");
      }

      setShowManualModal(false);
      setEditingEntry(null);
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (e) {
      console.error("Erro ao salvar lançamento manual:", e);
      addToast("Erro ao salvar registro de ponto.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Excluir registro (Admin/RH)
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Deseja realmente remover este registro de ponto?")) return;
    try {
      await db.delete('time_tracking' as any, id);
      addToast("Registro de ponto excluído.", "info");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (e) {
      addToast("Erro ao excluir registro.", "error");
    }
  };

  // Solicitar Justificativa de Falta / Erro
  const handleSubmitJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setIsProcessing(true);
    try {
      const allDbEntries = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const existingEntry = allDbEntries.find(e => e.user_id === targetUser.id && e.date === justificationTargetDate);

      const justificationText = `[JUSTIFICATIVA PENDENTE: ${justificationReason} | Horários Propostos: ${justificationProposedIn || '--'} / ${justificationProposedBreakStart || '--'} / ${justificationProposedBreakEnd || '--'} / ${justificationProposedOut || '--'} | Motivo: ${justificationNotes.trim()}]`;

      if (existingEntry) {
        const updated: TimeEntry = {
          ...existingEntry,
          user_id: targetUser.id,
          notes: (existingEntry.notes ? existingEntry.notes + ' ' : '') + justificationText
        };
        await db.update('time_tracking' as any, updated);
      } else {
        const newEntry: Partial<TimeEntry> = {
          user_id: targetUser.id,
          date: justificationTargetDate,
          clock_in: '',
          clock_out: '',
          notes: justificationText,
          system_id: currentUser?.system_id || 'sys-vialivre-default'
        };
        await db.create('time_tracking' as any, newEntry);
      }

      const notifTitle = `Solicitação de Justificativa de Ponto`;
      const notifMsg = `Colaborador ${targetUser.full_name || targetUser.name} solicitou justificativa para o dia ${justificationTargetDate.split('-').reverse().join('/')} (${justificationReason}).`;
      
      try {
        await db.create<AppNotification>('notifications', {
          title: notifTitle,
          message: notifMsg,
          type: 'WARNING',
          category: 'SYSTEM',
          target_role: 'ADMIN',
          is_read: false,
          user_id: targetUser.id,
          system_id: currentUser?.system_id || 'sys-vialivre-default',
          created_at: new Date().toISOString()
        });

        NotificationService.sendLocalNotification(notifTitle, {
          body: notifMsg,
          icon: 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png'
        });
      } catch (errNotif) {
        console.warn("Aviso ao gerar notificação:", errNotif);
      }

      addToast("Justificativa enviada ao RH com sucesso!", "success");
      setShowJustificationModal(false);
      setJustificationNotes('');
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (err) {
      console.error("Erro ao enviar justificativa:", err);
      addToast("Erro ao registrar solicitação de justificativa.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Aprovar Justificativa (Admin/RH)
  const handleApproveJustification = async (entry: TimeEntry) => {
    if (!isAdminOrRH) return;
    try {
      let parsedIn = entry.clock_in;
      let parsedBreakStart = entry.break_start;
      let parsedBreakEnd = entry.break_end;
      let parsedOut = entry.clock_out;

      const propMatch = entry.notes?.match(/Horários Propostos:\s*([0-9:]+|--)\s*\/\s*([0-9:]+|--)\s*\/\s*([0-9:]+|--)\s*\/\s*([0-9:]+|--)/);
      if (propMatch) {
        if (propMatch[1] && propMatch[1] !== '--') parsedIn = propMatch[1];
        if (propMatch[2] && propMatch[2] !== '--') parsedBreakStart = propMatch[2];
        if (propMatch[3] && propMatch[3] !== '--') parsedBreakEnd = propMatch[3];
        if (propMatch[4] && propMatch[4] !== '--') parsedOut = propMatch[4];
      }

      const cleanNotes = (entry.notes || '').replace(/\[JUSTIFICATIVA PENDENTE:[^\]]+\]/g, '').trim();
      const updatedNotes = (cleanNotes ? cleanNotes + ' ' : '') + `[JUSTIFICATIVA APROVADA PELO RH]`;

      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) + (m || 0) / 60;
      };
      let hours = 0;
      if (parsedIn && parsedOut) {
        hours = parseTime(parsedOut) - parseTime(parsedIn);
        if (parsedBreakStart && parsedBreakEnd) {
          hours -= (parseTime(parsedBreakEnd) - parseTime(parsedBreakStart));
        }
        if (hours < 0) hours += 24;
      }

      const updated: TimeEntry = {
        ...entry,
        clock_in: parsedIn || '08:00',
        break_start: parsedBreakStart || '',
        break_end: parsedBreakEnd || '',
        clock_out: parsedOut || '17:00',
        total_daily_hours: Math.max(0, Number(hours.toFixed(2))),
        notes: updatedNotes
      };

      await db.update('time_tracking' as any, updated);
      addToast("Justificativa aprovada e ponto regularizado!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (err) {
      addToast("Erro ao aprovar justificativa.", "error");
    }
  };

  // Recusar Justificativa (Admin/RH)
  const handleRejectJustification = async (entry: TimeEntry) => {
    if (!isAdminOrRH) return;
    try {
      const cleanNotes = (entry.notes || '').replace(/\[JUSTIFICATIVA PENDENTE:[^\]]+\]/g, '').trim();
      const updatedNotes = (cleanNotes ? cleanNotes + ' ' : '') + `[JUSTIFICATIVA RECUSADA PELO RH]`;

      const updated: TimeEntry = {
        ...entry,
        notes: updatedNotes
      };

      await db.update('time_tracking' as any, updated);
      addToast("Justificativa recusada.", "info");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await loadEntries();
    } catch (err) {
      addToast("Erro ao recusar justificativa.", "error");
    }
  };

  // Status visual da jornada de hoje
  const todayStatus = useMemo(() => {
    if (!currentEntry || !currentEntry.clock_in) {
      return { label: 'Não Iniciado', color: 'text-slate-500 bg-slate-100 dark:bg-zinc-800' };
    }
    if (currentEntry.clock_out) {
      return { label: 'Jornada Finalizada', color: 'text-red-700 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800' };
    }
    if (currentEntry.break_start && !currentEntry.break_end) {
      return { label: 'Em Intervalo', color: 'text-amber-700 bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800' };
    }
    return { label: 'Em Atividade / Trabalhando', color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800' };
  }, [currentEntry]);

  // 1. Definição do Intervalo de Datas do Período Solicitado
  const dateRangeBounds = useMemo(() => {
    let start: Date;
    let end: Date = new Date();

    if (periodPreset === 'month') {
      start = new Date(filterYear, filterMonth - 1, 1);
      end = new Date(filterYear, filterMonth, 0);
    } else if (periodPreset === 'last7') {
      start = new Date();
      start.setDate(start.getDate() - 6);
    } else if (periodPreset === 'last15') {
      start = new Date();
      start.setDate(start.getDate() - 14);
    } else if (periodPreset === 'last30') {
      start = new Date();
      start.setDate(start.getDate() - 29);
    } else { // 'custom'
      start = customStartDate ? new Date(customStartDate + 'T00:00:00') : new Date();
      end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date();
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
    }

    return {
      startDateStr: getLocalDateStr(start),
      endDateStr: getLocalDateStr(end),
      startDate: start,
      endDate: end
    };
  }, [periodPreset, filterMonth, filterYear, customStartDate, customEndDate]);

  // 2. Mapeamento O(1) dos registros por Data para desempenho instantâneo
  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    for (const e of entries) {
      if (e.date) {
        map.set(e.date, e);
      }
    }
    return map;
  }, [entries]);

  // 3. Geração Segura e Estritamente Delimitada dos Dias do Período Solicitado (Evita travamentos)
  const daysInPeriod = useMemo(() => {
    const list: {
      dateStr: string;
      dayNum: number;
      dayOfWeek: string;
      isWeekend: boolean;
      entry?: TimeEntry;
      hoursWorked: number;
      hoursWorkedText: string;
      hasPendingJustification: boolean;
      hasApprovedJustification: boolean;
      hasRejectedJustification: boolean;
    }[] = [];

    const daysOfWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const current = new Date(dateRangeBounds.startDate.getFullYear(), dateRangeBounds.startDate.getMonth(), dateRangeBounds.startDate.getDate());
    const end = new Date(dateRangeBounds.endDate.getFullYear(), dateRangeBounds.endDate.getMonth(), dateRangeBounds.endDate.getDate());

    // Limite máximo de segurança para garantir estabilidade e fluidez absoluta
    let loopCount = 0;
    const maxDays = 92;

    while (current <= end && loopCount < maxDays) {
      loopCount++;
      const dateStr = getLocalDateStr(current);
      const dayOfWeekIdx = current.getDay();
      const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
      const entry = entriesByDate.get(dateStr);

      const hasPendingJustification = !!entry?.notes?.includes('[JUSTIFICATIVA PENDENTE');
      const hasApprovedJustification = !!entry?.notes?.includes('[JUSTIFICATIVA APROVADA');
      const hasRejectedJustification = !!entry?.notes?.includes('[JUSTIFICATIVA RECUSADA');

      let hoursWorked = 0;
      let hoursWorkedText = '--';

      if (entry?.clock_in && entry?.clock_out) {
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return (h || 0) + (m || 0) / 60;
        };
        let h = parseTime(entry.clock_out) - parseTime(entry.clock_in);
        if (entry.break_start && entry.break_end) {
          h -= (parseTime(entry.break_end) - parseTime(entry.break_start));
        }
        if (h < 0) h += 24;
        hoursWorked = Math.max(0, h);
        hoursWorkedText = hoursWorked.toFixed(1) + 'h';
      }

      list.push({
        dateStr,
        dayNum: current.getDate(),
        dayOfWeek: daysOfWeekLabels[dayOfWeekIdx],
        isWeekend,
        entry,
        hoursWorked,
        hoursWorkedText,
        hasPendingJustification,
        hasApprovedJustification,
        hasRejectedJustification
      });

      current.setDate(current.getDate() + 1);
    }

    return list;
  }, [dateRangeBounds, entriesByDate]);

  // 4. Filtragem por Status e Termo de Busca
  const filteredDays = useMemo(() => {
    return daysInPeriod.filter(item => {
      // Filtro de Status
      if (statusFilter === 'worked' && (!item.entry || !item.entry.clock_in)) return false;
      if (statusFilter === 'missing' && (item.entry?.clock_in || item.isWeekend || item.dateStr > todayStr)) return false;
      if (statusFilter === 'overtime' && item.hoursWorked <= 8) return false;
      if (statusFilter === 'justification' && !item.hasPendingJustification && !item.hasApprovedJustification && !item.hasRejectedJustification) return false;

      // Filtro de Busca (por data, dia ou observação)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const formattedDate = item.dateStr.split('-').reverse().join('/');
        const noteMatch = (item.entry?.notes || '').toLowerCase().includes(q);
        const dayMatch = item.dayOfWeek.toLowerCase().includes(q);
        const dateMatch = item.dateStr.includes(q) || formattedDate.includes(q);
        if (!noteMatch && !dayMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [daysInPeriod, statusFilter, searchQuery, todayStr]);

  // 5. Estatísticas do Período Filtrado
  const periodStats = useMemo(() => {
    let totalHours = 0;
    let daysWithEntry = 0;
    let pendingJustificationsCount = 0;

    for (const item of daysInPeriod) {
      if (item.entry && item.entry.clock_in) {
        daysWithEntry++;
        totalHours += item.hoursWorked;
      }
      if (item.hasPendingJustification) {
        pendingJustificationsCount++;
      }
    }

    const expectedHours = daysWithEntry * 8;
    const extraHours = Math.max(0, totalHours - expectedHours);

    return {
      totalHours,
      daysWithEntry,
      extraHours,
      pendingJustificationsCount,
      totalDaysListed: daysInPeriod.length
    };
  }, [daysInPeriod]);

  // Imprimir ou Exportar Espelho de Ponto
  const handlePrintMirror = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all pb-24">
      {/* Top Header & Collaborator Switcher (For Admin/RH) */}
      {isAdminOrRH && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-3 bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel de Gestão de Ponto</p>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase italic">Visualizar Ponto de Colaborador</h3>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none focus:border-yellow-400"
              >
                <option value={currentUser?.id || ''}>Meu Ponto ({currentUser?.full_name || currentUser?.name})</option>
                <optgroup label="Colaboradores Cadastrados">
                  {users
                    .filter(u => u.id !== currentUser?.id)
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.name} - {u.job_title || u.role} {u.registration_id ? `(Mat: ${u.registration_id})` : ''}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingEntry({
                  user_id: targetUser?.id || currentUser?.id || '',
                  date: todayStr,
                  clock_in: '',
                  break_start: '',
                  break_end: '',
                  clock_out: '',
                  notes: ''
                });
                setShowManualModal(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all whitespace-nowrap"
            >
              <Plus size={16} /> Lançar Ponto Manual
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tabs Selector for Time Tracking */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-zinc-900 rounded-2xl w-fit border border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveSubTab('today')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeSubTab === 'today'
              ? 'bg-yellow-400 text-slate-950 shadow-md ring-2 ring-yellow-400/30'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Timer size={16} />
          <span>Ponto de Hoje (Registro)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-yellow-400 text-slate-950 shadow-md ring-2 ring-yellow-400/30'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History size={16} />
          <span>Histórico de Horários Anteriores</span>
        </button>
      </div>

      {activeSubTab === 'today' ? (
        <div className="space-y-6">
          {/* Main Clock-in Banner */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[3rem] border-2 border-yellow-400 shadow-sm transition-colors">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-yellow-400 rounded-3xl text-slate-900 shadow-lg">
                  <Timer size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-black uppercase italic dark:text-white leading-none">
                      Ponto Eletrônico Digital
                    </h2>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${todayStatus.color}`}>
                      {todayStatus.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    Colaborador: <span className="text-slate-800 dark:text-zinc-200">{targetUser?.full_name || targetUser?.name}</span> ({targetUser?.job_title || targetUser?.role})
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Sincronizar dados de ponto com outros dispositivos e com a nuvem"
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-yellow-400 hover:text-slate-950 dark:bg-zinc-800 dark:hover:bg-yellow-400 dark:hover:text-slate-950 text-slate-700 dark:text-zinc-200 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-zinc-700 active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin text-yellow-600 dark:text-yellow-400" : ""} />
                  {isSyncing ? "Sincronizando..." : "Sincronizar"}
                  {lastSyncTime && (
                    <span className="hidden sm:inline opacity-60 text-[9px] font-mono">({lastSyncTime})</span>
                  )}
                </button>

                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-yellow-400/30 shadow-inner">
                  <Clock size={22} className="text-yellow-500 animate-pulse" />
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono dark:text-white tracking-wider">{currentTime}</span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {/* 1. ENTRADA */}
              <button 
                disabled={isProcessing || !!currentEntry?.clock_in}
                onClick={() => handleClockAction('clock_in')}
                className={`flex flex-col items-center justify-center gap-2.5 p-5 md:p-6 rounded-[2rem] border-2 transition-all ${
                  !currentEntry?.clock_in 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer' 
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-600 border-transparent cursor-not-allowed opacity-60'
                }`}
              >
                <Play size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Entrada</span>
                {currentEntry?.clock_in ? (
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded-lg">{currentEntry.clock_in}</span>
                ) : (
                  <span className="text-[8px] font-bold opacity-80 uppercase">Registrar Início</span>
                )}
              </button>

              {/* 2. INTERVALO */}
              <button 
                disabled={isProcessing || !currentEntry?.clock_in || !!currentEntry?.break_start}
                onClick={() => handleClockAction('break_start')}
                className={`flex flex-col items-center justify-center gap-2.5 p-5 md:p-6 rounded-[2rem] border-2 transition-all ${
                  currentEntry?.clock_in && !currentEntry?.break_start 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer' 
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-600 border-transparent cursor-not-allowed opacity-60'
                }`}
              >
                <Coffee size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Intervalo</span>
                {currentEntry?.break_start ? (
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded-lg">{currentEntry.break_start}</span>
                ) : (
                  <span className="text-[8px] font-bold opacity-80 uppercase">Saída Almoço</span>
                )}
              </button>

              {/* 3. RETORNO */}
              <button 
                disabled={isProcessing || !currentEntry?.break_start || !!currentEntry?.break_end}
                onClick={() => handleClockAction('break_end')}
                className={`flex flex-col items-center justify-center gap-2.5 p-5 md:p-6 rounded-[2rem] border-2 transition-all ${
                  currentEntry?.break_start && !currentEntry?.break_end 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-400 shadow-lg shadow-amber-600/20 active:scale-95 cursor-pointer' 
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-600 border-transparent cursor-not-allowed opacity-60'
                }`}
              >
                <Timer size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Retorno</span>
                {currentEntry?.break_end ? (
                  <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded-lg">{currentEntry.break_end}</span>
                ) : (
                  <span className="text-[8px] font-bold opacity-80 uppercase">Volta Almoço</span>
                )}
              </button>

              {/* 4. SAÍDA */}
              <button 
                disabled={isProcessing || !currentEntry?.clock_in || !!currentEntry?.clock_out}
                onClick={() => handleClockAction('clock_out')}
                className={`flex flex-col items-center justify-center gap-2.5 p-5 md:p-6 rounded-[2rem] border-2 transition-all ${
                  currentEntry?.clock_in && !currentEntry?.clock_out 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer' 
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-600 border-transparent cursor-not-allowed opacity-60'
                }`}
              >
                <LogOut size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Saída</span>
                {currentEntry?.clock_out ? (
                  <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded-lg">{currentEntry.clock_out}</span>
                ) : (
                  <span className="text-[8px] font-bold opacity-80 uppercase">Fim de Expediente</span>
                )}
              </button>
            </div>
          </div>

          {/* Resumo do Espelho de Ponto de Hoje */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-sm font-black uppercase italic dark:text-white mb-4 flex items-center gap-2">
              <CalendarDays size={18} className="text-yellow-500" />
              Espelho de Ponto do Dia ({new Date().toLocaleDateString('pt-BR')})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-700/50">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Entrada</span>
                <span className="text-lg font-black font-mono dark:text-white">
                  {currentEntry?.clock_in || '--:--'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-700/50">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Saída Almoço</span>
                <span className="text-lg font-black font-mono dark:text-white">
                  {currentEntry?.break_start || '--:--'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-700/50">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Volta Almoço</span>
                <span className="text-lg font-black font-mono dark:text-white">
                  {currentEntry?.break_end || '--:--'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-700/50">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Saída Final</span>
                <span className="text-lg font-black font-mono dark:text-white">
                  {currentEntry?.clock_out || '--:--'}
                </span>
              </div>
            </div>

            {currentEntry?.notes && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-xl text-[11px] text-yellow-800 dark:text-yellow-300">
                <span className="font-bold">Observações de Hoje:</span> {currentEntry.notes}
              </div>
            )}
          </div>

          {/* Banner Chamada para Histórico Anterior */}
          <div className="p-6 bg-gradient-to-r from-yellow-400/15 via-amber-400/10 to-transparent border-2 border-yellow-400/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-400 text-slate-950 rounded-2xl">
                <History size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase italic dark:text-white">Consultar Horários e Dias Anteriores</h4>
                <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  Visualize o extrato do período desejado, horas extras acumuladas e solicite justificativas de ponto.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('history')}
              className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all whitespace-nowrap cursor-pointer"
            >
              Abrir Histórico Completo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Control Bar com Seletor de Período e Botões Rápidos */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black uppercase italic dark:text-white flex items-center gap-2">
                    <History size={18} className="text-yellow-500" />
                    Histórico de Horários
                  </h3>
                  <span className="px-2.5 py-0.5 bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 rounded-md text-[10px] font-black uppercase">
                    {targetUser?.full_name || targetUser?.name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Selecione o período exato que deseja consultar para visualizar os horários registrados e ausências.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                <button
                  onClick={() => {
                    setJustificationTargetDate(todayStr);
                    setShowJustificationModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <MessageSquareText size={14} />
                  <span>Solicitar Justificativa</span>
                </button>

                <button
                  onClick={handlePrintMirror}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  title="Imprimir Espelho de Ponto"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>

                <button
                  onClick={() => loadEntries()}
                  className="p-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl transition-all"
                  title="Atualizar Registros"
                >
                  <RefreshCw size={14} className={isLoading ? "animate-spin text-yellow-500" : ""} />
                </button>
              </div>
            </div>

            {/* Presets de Período */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <Calendar size={12} /> Período:
                </span>

                <button
                  onClick={() => setPeriodPreset('month')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                    periodPreset === 'month'
                      ? 'bg-yellow-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Mês Específico
                </button>

                <button
                  onClick={() => setPeriodPreset('last7')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                    periodPreset === 'last7'
                      ? 'bg-yellow-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Últimos 7 Dias
                </button>

                <button
                  onClick={() => setPeriodPreset('last15')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                    periodPreset === 'last15'
                      ? 'bg-yellow-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Últimos 15 Dias
                </button>

                <button
                  onClick={() => setPeriodPreset('last30')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                    periodPreset === 'last30'
                      ? 'bg-yellow-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Últimos 30 Dias
                </button>

                <button
                  onClick={() => setPeriodPreset('custom')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                    periodPreset === 'custom'
                      ? 'bg-yellow-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Personalizado (De/Até)
                </button>
              </div>

              {/* Controles Dinâmicos de Data baseados no Preset */}
              <div className="flex items-center gap-2 flex-wrap">
                {periodPreset === 'month' && (
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-slate-50 dark:bg-zinc-800 px-3 py-2 rounded-xl text-xs font-black uppercase border border-slate-200 dark:border-zinc-700 outline-none dark:text-white" 
                      value={filterMonth} 
                      onChange={e => setFilterMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2025, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}
                        </option>
                      ))}
                    </select>
                    
                    <select 
                      className="bg-slate-50 dark:bg-zinc-800 px-3 py-2 rounded-xl text-xs font-black uppercase border border-slate-200 dark:border-zinc-700 outline-none dark:text-white" 
                      value={filterYear} 
                      onChange={e => setFilterYear(Number(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {periodPreset === 'custom' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">De:</span>
                      <input 
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="bg-slate-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 outline-none dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Até:</span>
                      <input 
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="bg-slate-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 outline-none dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de Filtros de Visualização e Busca */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <Filter size={12} /> Status:
                </span>
                
                {[
                  { id: 'all', label: 'Todos os Dias' },
                  { id: 'worked', label: 'Com Ponto Registrado' },
                  { id: 'missing', label: 'Ausências / Sem Ponto' },
                  { id: 'overtime', label: 'Horas Extras' },
                  { id: 'justification', label: 'Com Justificativa' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as StatusFilter)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar data (ex: 15/02)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 outline-none focus:border-yellow-400 dark:text-white"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* KPI Cards do Período */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Horas Trabalhadas no Período</p>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white">{periodStats.totalHours.toFixed(1)}h</h4>
              </div>
              <div className="p-3 bg-yellow-400/20 text-yellow-600 rounded-2xl">
                <Clock size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dias com Ponto Registrado</p>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white">{periodStats.daysWithEntry} dias</h4>
              </div>
              <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Horas Extras Estimadas</p>
                <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{periodStats.extraHours.toFixed(1)}h</h4>
              </div>
              <div className="p-3 bg-indigo-500/20 text-indigo-600 rounded-2xl">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Justificativas Pendentes</p>
                <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400">{periodStats.pendingJustificationsCount}</h4>
              </div>
              <div className="p-3 bg-amber-500/20 text-amber-600 rounded-2xl">
                <AlertCircle size={24} />
              </div>
            </div>
          </div>

          {/* TABELA DE HISTÓRICO MENSAL / PERÍODO COMPLETO */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-yellow-500" />
                <h4 className="text-xs font-black uppercase italic dark:text-white">
                  Extrato de Dias do Período ({dateRangeBounds.startDateStr.split('-').reverse().join('/')} até {dateRangeBounds.endDateStr.split('-').reverse().join('/')})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Mostrando <strong className="text-slate-900 dark:text-white">{filteredDays.length}</strong> de {periodStats.totalDaysListed} dias
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-black uppercase border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-4">Data / Dia</th>
                    <th className="px-5 py-4">Entrada</th>
                    <th className="px-5 py-4">Saída Almoço</th>
                    <th className="px-5 py-4">Volta Almoço</th>
                    <th className="px-5 py-4">Saída</th>
                    <th className="px-5 py-4 text-center">Jornada</th>
                    <th className="px-5 py-4">Status / Ocorrência</th>
                    <th className="px-5 py-4 text-right">Ações & Justificativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 transition-colors">
                  {isLoading && entries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-black uppercase tracking-wider animate-pulse">
                        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-yellow-500" />
                        Consultando registros no servidor...
                      </td>
                    </tr>
                  ) : filteredDays.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                        Nenhum registro de ponto encontrado para o filtro selecionado neste período.
                      </td>
                    </tr>
                  ) : (
                    filteredDays.map(d => {
                      const e = d.entry;
                      const isToday = d.dateStr === todayStr;

                      // Determinar badge de status do dia
                      let statusBadge = (
                        <span className="text-slate-400 font-medium italic">Sem registro</span>
                      );

                      if (d.hasPendingJustification) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 w-fit">
                            <AlertCircle size={10} /> Justificativa Pendente
                          </span>
                        );
                      } else if (d.hasApprovedJustification) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 w-fit">
                            <CheckCircle2 size={10} /> Regularizado / Aprovado
                          </span>
                        );
                      } else if (d.hasRejectedJustification) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1 w-fit">
                            <AlertTriangle size={10} /> Justificativa Recusada
                          </span>
                        );
                      } else if (e?.clock_in && e?.clock_out) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Jornada Completa
                          </span>
                        );
                      } else if (e?.clock_in && !e?.clock_out) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {isToday ? 'Em Andamento' : 'Ponto Incompleto'}
                          </span>
                        );
                      } else if (!e && !d.isWeekend && d.dateStr < todayStr) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            Ausência / Falta
                          </span>
                        );
                      } else if (d.isWeekend) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-zinc-800">
                            Folga / Fim de Semana
                          </span>
                        );
                      }

                      return (
                        <tr key={d.dateStr} className={`hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors ${isToday ? 'bg-yellow-400/5 font-bold' : ''}`}>
                          <td className="px-5 py-4 text-slate-800 dark:text-zinc-200">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black">{d.dateStr.split('-').reverse().join('/')}</span>
                              <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase ${d.isWeekend ? 'bg-slate-200 dark:bg-zinc-800 text-slate-500' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'}`}>
                                {d.dayOfWeek}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-yellow-400 text-slate-950 rounded">Hoje</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 dark:text-zinc-100 font-mono font-bold">
                            {e?.clock_in || '--:--'}
                          </td>
                          <td className="px-5 py-4 dark:text-zinc-400 font-mono italic">
                            {e?.break_start || '--:--'}
                          </td>
                          <td className="px-5 py-4 dark:text-zinc-400 font-mono italic">
                            {e?.break_end || '--:--'}
                          </td>
                          <td className="px-5 py-4 dark:text-zinc-100 font-mono font-bold">
                            {e?.clock_out || '--:--'}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-[10px] ${
                              d.hoursWorkedText !== '--' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'text-slate-400'
                            }`}>
                              {d.hoursWorkedText}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              {statusBadge}
                              {e?.notes && (
                                <p className="text-[10px] text-slate-500 dark:text-zinc-400 max-w-xs truncate" title={e.notes}>
                                  {e.notes}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Botão de Justificativa */}
                              <button
                                onClick={() => {
                                  setJustificationTargetDate(d.dateStr);
                                  setJustificationProposedIn(e?.clock_in || '08:00');
                                  setJustificationProposedBreakStart(e?.break_start || '12:00');
                                  setJustificationProposedBreakEnd(e?.break_end || '13:00');
                                  setJustificationProposedOut(e?.clock_out || '17:00');
                                  setShowJustificationModal(true);
                                }}
                                className="px-2.5 py-1 bg-yellow-400/10 hover:bg-yellow-400 text-slate-900 dark:text-yellow-400 dark:hover:text-slate-950 hover:font-black border border-yellow-400/40 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                                title="Solicitar Justificativa de Ponto / Falta para esta data"
                              >
                                Justificar
                              </button>

                              {/* Ações Administrativas para Justificativa Pendente */}
                              {isAdminOrRH && d.hasPendingJustification && e && (
                                <>
                                  <button
                                    onClick={() => handleApproveJustification(e)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg cursor-pointer"
                                    title="Aprovar Justificativa"
                                  >
                                    <Check size={14} className="stroke-[3]" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectJustification(e)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                                    title="Recusar Justificativa"
                                  >
                                    <X size={14} className="stroke-[3]" />
                                  </button>
                                </>
                              )}

                              {/* Ações Administrativas de Ajuste / Exclusão */}
                              {isAdminOrRH && e && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingEntry(e);
                                      setShowManualModal(true);
                                    }}
                                    className="p-1 text-slate-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                                    title="Editar Ponto"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(e.id)}
                                    className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                                    title="Excluir Ponto"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Justificativa de Ponto */}
      {showJustificationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-yellow-400 text-slate-950 rounded-2xl">
                  <MessageSquareText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic dark:text-white">
                    Solicitar Justificativa de Ponto
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Envio de declaração ou ajuste ao RH</p>
                </div>
              </div>
              <button
                onClick={() => setShowJustificationModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitJustification} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data do Ocorrido</label>
                <input
                  type="date"
                  value={justificationTargetDate}
                  onChange={e => setJustificationTargetDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Motivo Principal</label>
                <select
                  value={justificationReason}
                  onChange={e => setJustificationReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  required
                >
                  <option value="Esquecimento de Ponto">Esquecimento de Registro</option>
                  <option value="Falha no Sistema / Dispositivo">Problema Técnico no Dispositivo / Sistema</option>
                  <option value="Atestado Médico / Consulta">Atestado Médico / Declaração de Saúde</option>
                  <option value="Serviço Externo / Viagem">Trabalho Externo / Viagem a Serviço</option>
                  <option value="Atraso Justificado / Trânsito">Atraso Justificado / Trânsito</option>
                  <option value="Compensação de Horas">Compensação de Horas / Troca de Turno</option>
                  <option value="Outros Motivos">Outros Motivos</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Horários Corretos Realizados</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Entrada</span>
                    <input
                      type="time"
                      value={justificationProposedIn}
                      onChange={e => setJustificationProposedIn(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs p-2 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Saída Alm.</span>
                    <input
                      type="time"
                      value={justificationProposedBreakStart}
                      onChange={e => setJustificationProposedBreakStart(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs p-2 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Volta Alm.</span>
                    <input
                      type="time"
                      value={justificationProposedBreakEnd}
                      onChange={e => setJustificationProposedBreakEnd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs p-2 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Saída</span>
                    <input
                      type="time"
                      value={justificationProposedOut}
                      onChange={e => setJustificationProposedOut(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs p-2 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Explicação / Detalhes da Justificativa</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva detalhadamente o ocorrido (ex: Esqueci de registrar a saída devido a atendimento urgente)..."
                  value={justificationNotes}
                  onChange={e => setJustificationNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJustificationModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-2xl uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !justificationNotes.trim()}
                  className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-2xl uppercase flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Enviar Justificativa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Lançamento / Ajuste Manual (Admin/RH) */}
      {showManualModal && editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-yellow-400 text-slate-950 rounded-2xl">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic dark:text-white">
                    {editingEntry.id ? 'Ajustar Registro de Ponto' : 'Novo Lançamento Manual de Ponto'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gestão e Auditoria RH</p>
                </div>
              </div>
              <button
                onClick={() => { setShowManualModal(false); setEditingEntry(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Colaborador</label>
                <select
                  disabled={!!editingEntry.id}
                  value={editingEntry.user_id || ''}
                  onChange={e => setEditingEntry({ ...editingEntry, user_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  required
                >
                  <option value="">Selecione o colaborador...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.name} ({u.job_title || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data do Ponto</label>
                <input
                  type="date"
                  value={editingEntry.date || todayStr}
                  onChange={e => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Entrada (HH:mm)</label>
                  <input
                    type="time"
                    value={editingEntry.clock_in || ''}
                    onChange={e => setEditingEntry({ ...editingEntry, clock_in: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Saída Intervalo</label>
                  <input
                    type="time"
                    value={editingEntry.break_start || ''}
                    onChange={e => setEditingEntry({ ...editingEntry, break_start: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Retorno Intervalo</label>
                  <input
                    type="time"
                    value={editingEntry.break_end || ''}
                    onChange={e => setEditingEntry({ ...editingEntry, break_end: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Saída Final</label>
                  <input
                    type="time"
                    value={editingEntry.clock_out || ''}
                    onChange={e => setEditingEntry({ ...editingEntry, clock_out: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observação / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Ajuste manual autorizado pelo RH"
                  value={editingEntry.notes || ''}
                  onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium text-xs p-3 rounded-2xl border border-slate-200 dark:border-zinc-700 outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowManualModal(false); setEditingEntry(null); }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-2xl uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-2xl uppercase flex items-center justify-center gap-2 shadow-lg"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTrackingManager;
