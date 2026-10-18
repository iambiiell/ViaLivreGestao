import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Trash2, 
  RefreshCw, 
  Download, 
  Eye, 
  ArrowRight, 
  CheckCircle2, 
  FileText,
  Bus,
  CalendarCheck,
  ChevronDown,
  X,
  PlusCircle,
  Database
} from 'lucide-react';
import { AuditLog, AuditActionType, AuditSeverity, User } from '../types';
import { AuditLogService } from '../services/auditLogService';

interface AuditLogManagerProps {
  currentUser: User | null;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AuditLogManager: React.FC<AuditLogManagerProps> = ({ currentUser, addToast }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | AuditSeverity>('ALL');
  const [selectedActionType, setSelectedActionType] = useState<string>('ALL');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual log form
  const [manualDescription, setManualDescription] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualActionType, setManualActionType] = useState<AuditActionType>('OPERATIONAL_OVERRIDE');
  const [manualSeverity, setManualSeverity] = useState<AuditSeverity>('WARNING');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await AuditLogService.getLogs();
      setLogs(data);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      addToast('Erro ao carregar trilha de auditoria.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const handleAuditUpdate = () => {
      fetchLogs();
    };

    window.addEventListener('vialivre-audit-updated', handleAuditUpdate);
    window.addEventListener('vialivre-refresh-data', handleAuditUpdate);

    return () => {
      window.removeEventListener('vialivre-audit-updated', handleAuditUpdate);
      window.removeEventListener('vialivre-refresh-data', handleAuditUpdate);
    };
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return logs.filter(log => {
      // Search query
      if (q) {
        const matchUser = (log.user_name || '').toLowerCase().includes(q);
        const matchRole = (log.user_role || '').toLowerCase().includes(q);
        const matchDesc = (log.description || '').toLowerCase().includes(q);
        const matchLabel = (log.entity_label || '').toLowerCase().includes(q);
        const matchId = (log.entity_id || '').toLowerCase().includes(q);
        if (!matchUser && !matchRole && !matchDesc && !matchLabel && !matchId) {
          return false;
        }
      }

      // Severity filter
      if (selectedSeverity !== 'ALL' && log.severity !== selectedSeverity) {
        return false;
      }

      // Action type filter
      if (selectedActionType !== 'ALL') {
        if (selectedActionType === 'TRIPS' && !log.action_type.startsWith('TRIP_')) return false;
        if (selectedActionType === 'SHIFTS' && !log.action_type.startsWith('SHIFT_')) return false;
        if (selectedActionType === 'ROUTES' && !log.action_type.startsWith('ROUTE_')) return false;
        if (selectedActionType === 'SYSTEM' && !['SYSTEM_CONFIG_UPDATED', 'BACKUP_TRIGGERED'].includes(log.action_type)) return false;
        if (selectedActionType === 'CRITICAL_ONLY' && log.severity !== 'CRITICAL') return false;
      }

      // Time filter
      if (timeFilter !== 'ALL') {
        const logDate = new Date(log.created_at);
        const diffMs = now.getTime() - logDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (timeFilter === 'TODAY' && diffHours > 24) return false;
        if (timeFilter === 'WEEK' && diffHours > 24 * 7) return false;
        if (timeFilter === 'MONTH' && diffHours > 24 * 30) return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedSeverity, selectedActionType, timeFilter]);

  // Operational metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const critical = logs.filter(l => l.severity === 'CRITICAL').length;
    const trips = logs.filter(l => l.action_type.startsWith('TRIP_')).length;
    const shifts = logs.filter(l => l.action_type.startsWith('SHIFT_')).length;
    return { total, critical, trips, shifts };
  }, [logs]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      addToast('Nenhum registro para exportar.', 'warning');
      return;
    }

    const headers = ['ID', 'Data/Hora', 'Severidade', 'Tipo de Ação', 'Entidade', 'Operador', 'Cargo', 'Descrição', 'Detalhes'];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${new Date(l.created_at).toLocaleString('pt-BR')}"`,
      `"${l.severity}"`,
      `"${l.action_type}"`,
      `"${l.entity_label || l.entity_id || '-'}"`,
      `"${l.user_name}"`,
      `"${l.user_role || '-'}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_operacional_vialivre_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast('Relatório de auditoria exportado com sucesso!', 'success');
  };

  const handleCreateManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescription.trim()) {
      addToast('Descreva a ocorrência ou ação realizada.', 'warning');
      return;
    }

    try {
      await AuditLogService.logAction({
        action_type: manualActionType,
        severity: manualSeverity,
        entity_type: 'SYSTEM',
        entity_label: 'Registro Manual do Supervisor',
        description: manualDescription.trim(),
        details: manualDetails.trim() || undefined,
        currentUser
      });

      addToast('Ação de auditoria registrada com sucesso!', 'success');
      setManualDescription('');
      setManualDetails('');
      setIsManualModalOpen(false);
      fetchLogs();
    } catch (err) {
      addToast('Erro ao gravar log manual.', 'error');
    }
  };

  const getSeverityBadge = (sev: AuditSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1.5 shrink-0 shadow-xs">
            <AlertOctagon size={12} className="animate-pulse" /> Crítico
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shrink-0 shadow-xs">
            <AlertTriangle size={12} /> Atenção
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 shrink-0 shadow-xs">
            <Info size={12} /> Informativo
          </span>
        );
    }
  };

  const getActionTypeLabel = (action: AuditActionType) => {
    switch (action) {
      case 'TRIP_DELETED': return 'Exclusão de Viagem';
      case 'TRIP_UPDATED': return 'Alteração de Viagem';
      case 'TRIP_CREATED': return 'Criação de Viagem';
      case 'SHIFT_MODIFIED': return 'Alteração de Escala';
      case 'SHIFT_DELETED': return 'Exclusão de Escala';
      case 'SHIFT_CREATED': return 'Nova Escala';
      case 'ROUTE_DELETED': return 'Exclusão de Rota';
      case 'ROUTE_UPDATED': return 'Alteração de Rota';
      case 'BACKUP_TRIGGERED': return 'Backup do Sistema';
      case 'SYSTEM_CONFIG_UPDATED': return 'Config. do Sistema';
      case 'OPERATIONAL_OVERRIDE': return 'Intervenção Operacional';
      default: return 'Ação no Sistema';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return 'Agora mesmo';
      if (mins < 60) return `Há ${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      const days = Math.floor(hours / 24);
      return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1920px] mx-auto w-full">
      {/* Header com Identidade Operacional */}
      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-6 sm:p-10 border border-slate-100 dark:border-zinc-800 shadow-sm transition-all">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-100 dark:border-zinc-800 pb-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-yellow-400 text-slate-900 rounded-[2rem] flex items-center justify-center font-black shadow-xl border-4 border-slate-900 shrink-0">
              <ShieldAlert size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                  Trilha de Auditoria & Transparência
                </h1>
                <span className="hidden sm:inline-flex px-3 py-1 bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                  Compliance Operacional
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-widest mt-2">
                Histórico cronológico detalhado de exclusões de viagens, alterações de escalas e ações críticas
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-2xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-zinc-700"
              title="Atualizar lista de logs"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-900 dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 border-2 border-slate-200 dark:border-zinc-700 shadow-sm"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={() => setIsManualModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg border-2 border-slate-950 active:scale-95"
            >
              <PlusCircle size={15} />
              <span>Registrar Ação</span>
            </button>
          </div>
        </div>

        {/* Métricas e Indicadores de Transparência */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-8">
          <div className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Total Registros</span>
              <FileText size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">
              {stats.total}
            </p>
          </div>

          <div className="p-5 bg-red-50/60 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40">
            <div className="flex items-center justify-between text-red-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Ações Críticas</span>
              <AlertOctagon size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 leading-none">
              {stats.critical}
            </p>
          </div>

          <div className="p-5 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center justify-between text-blue-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Viagens Excluídas/Alt.</span>
              <Bus size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">
              {stats.trips}
            </p>
          </div>

          <div className="p-5 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-amber-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Alterações de Escalas</span>
              <CalendarCheck size={16} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 leading-none">
              {stats.shifts}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Campo de Busca */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por operador, matrícula, linha, viagem ou motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 ring-yellow-400 transition-all text-slate-800 dark:text-white"
            />
          </div>

          {/* Filtro de Categoria */}
          <div className="md:col-span-3">
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white transition-all cursor-pointer"
            >
              <option value="ALL">Todas as Ações</option>
              <option value="TRIPS">Viagens (Exclusão & Alteração)</option>
              <option value="SHIFTS">Escalas de Motoristas/Cobradores</option>
              <option value="ROUTES">Itinerários & Rotas</option>
              <option value="SYSTEM">Sistema & Backups</option>
              <option value="CRITICAL_ONLY">Apenas Críticas (Vermelho)</option>
            </select>
          </div>

          {/* Filtro de Severidade */}
          <div className="md:col-span-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white transition-all cursor-pointer"
            >
              <option value="ALL">Severidade: Todas</option>
              <option value="CRITICAL">🔴 Apenas Críticas</option>
              <option value="WARNING">🟡 Apenas Atenção</option>
              <option value="INFO">🔵 Apenas Informativo</option>
            </select>
          </div>

          {/* Filtro de Tempo */}
          <div className="md:col-span-2">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white transition-all cursor-pointer"
            >
              <option value="ALL">Período: Todo</option>
              <option value="TODAY">Últimas 24h</option>
              <option value="WEEK">Últimos 7 dias</option>
              <option value="MONTH">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        {/* Status de resultados */}
        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 px-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <span>Mostrando {filteredLogs.length} de {logs.length} ações auditadas</span>
          {(searchQuery || selectedSeverity !== 'ALL' || selectedActionType !== 'ALL' || timeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSeverity('ALL');
                setSelectedActionType('ALL');
                setTimeFilter('ALL');
              }}
              className="text-yellow-600 dark:text-yellow-400 hover:underline flex items-center gap-1"
            >
              <X size={12} /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista Cronológica de Auditoria */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-16 border border-slate-100 dark:border-zinc-800 flex flex-col items-center justify-center">
            <RefreshCw className="animate-spin text-yellow-500 mb-4" size={36} />
            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Consultando base de auditoria em tempo real...
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-16 border border-slate-100 dark:border-zinc-800 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-3xl mx-auto flex items-center justify-center text-slate-400">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-zinc-100">
              Nenhuma ação encontrada com os filtros selecionados
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todas as exclusões e alterações críticas executadas por operadores do sistema serão listadas aqui cronologicamente.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isCritical = log.severity === 'CRITICAL';
            const isWarning = log.severity === 'WARNING';

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`group bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border-2 transition-all hover:shadow-xl cursor-pointer ${
                  isCritical 
                    ? 'border-red-200 dark:border-red-900/60 hover:border-red-400 bg-red-50/20 dark:bg-red-950/10' 
                    : isWarning 
                    ? 'border-amber-200 dark:border-amber-900/50 hover:border-amber-400 bg-amber-50/20 dark:bg-amber-950/10' 
                    : 'border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Informações Principais da Ação */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      isCritical
                        ? 'bg-red-600 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-blue-600 text-white'
                    }`}>
                      {log.action_type.startsWith('TRIP_') ? (
                        <Bus size={22} />
                      ) : log.action_type.startsWith('SHIFT_') ? (
                        <CalendarCheck size={22} />
                      ) : log.action_type === 'BACKUP_TRIGGERED' ? (
                        <Database size={22} />
                      ) : (
                        <ShieldAlert size={22} />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(log.severity)}
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
                          {getActionTypeLabel(log.action_type)}
                        </span>
                        {log.entity_id && (
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            #{log.entity_id}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1 ml-auto lg:ml-0">
                          <Clock size={12} /> {formatRelativeTime(log.created_at)}
                        </span>
                      </div>

                      <h4 className="text-sm font-black uppercase text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                        {log.description}
                      </h4>

                      {log.entity_label && (
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <ArrowRight size={12} /> {log.entity_label}
                        </p>
                      )}

                      {log.details && (
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 italic line-clamp-2">
                          "{log.details}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Informações do Operador Autor */}
                  <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-zinc-800 shrink-0">
                    <div className="text-left lg:text-right">
                      <p className="text-xs font-black uppercase text-slate-900 dark:text-zinc-200">
                        {log.user_name}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {log.user_role || 'OPERADOR'}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(log.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-2xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 border border-yellow-400/40 flex items-center justify-center font-black text-xs uppercase shrink-0">
                      {log.user_name?.charAt(0) || 'U'}
                    </div>

                    <button 
                      type="button" 
                      className="p-2 text-slate-400 group-hover:text-yellow-500 transition-colors"
                      title="Ver Detalhes do Log"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Detalhes do Log Selecionado */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl text-white ${
                  selectedLog.severity === 'CRITICAL' ? 'bg-red-600' : selectedLog.severity === 'WARNING' ? 'bg-amber-500 text-slate-950' : 'bg-blue-600'
                }`}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none">
                    Inspeção de Registro de Auditoria
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {getSeverityBadge(selectedLog.severity)}
                <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-xl text-[10px] font-black uppercase">
                  {getActionTypeLabel(selectedLog.action_type)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 ml-auto">
                  {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                </span>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                  Descrição da Ação
                </label>
                <p className="text-base font-black uppercase text-slate-900 dark:text-zinc-100 leading-snug">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.entity_label && (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-700">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                    Entidade / Objeto Afetado
                  </label>
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {selectedLog.entity_label}
                  </p>
                </div>
              )}

              {selectedLog.details && (
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                    Justificativa / Detalhamento Operacional
                  </label>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 rounded-2xl text-xs font-bold text-slate-800 dark:text-zinc-200 leading-relaxed">
                    {selectedLog.details}
                  </div>
                </div>
              )}

              {/* Informações do Operador Responsável */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-700">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                    Operador / Autor
                  </label>
                  <p className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100">
                    {selectedLog.user_name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {selectedLog.user_role || 'OPERADOR'}
                  </p>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                    Contato & Identificação
                  </label>
                  <p className="text-xs font-mono text-slate-600 dark:text-zinc-300 truncate">
                    {selectedLog.user_email || 'Não informado'}
                  </p>
                  <p className="text-[9px] font-mono text-slate-400">
                    {selectedLog.user_id ? `ID: ${selectedLog.user_id.slice(0, 12)}...` : 'ID do Sistema'}
                  </p>
                </div>
              </div>

              {/* Estados Antes / Depois se existirem */}
              {(selectedLog.previous_state || selectedLog.new_state) && (
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">
                    Snapshot de Alterações (Estado Anterior vs Novo Estado)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    {selectedLog.previous_state && (
                      <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl overflow-x-auto">
                        <span className="text-[9px] font-black uppercase text-red-600 block mb-2">Estado Anterior:</span>
                        <pre className="text-[10px] text-red-700 dark:text-red-300 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.previous_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.new_state && (
                      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl overflow-x-auto">
                        <span className="text-[9px] font-black uppercase text-emerald-600 block mb-2">Novo Estado Aplicado:</span>
                        <pre className="text-[10px] text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.new_state, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-6 py-3 bg-white text-slate-900 border border-slate-200/90 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-xl font-black uppercase text-xs tracking-wider transition-all"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Registro Manual de Ação Crítica */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateManualLog}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg overflow-hidden flex flex-col border border-slate-100 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-yellow-400 text-slate-950">
                  <PlusCircle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none">
                    Registrar Ação Operacional
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                    Transparência & Registro Oficial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">
                  Tipo de Intervenção
                </label>
                <select
                  value={manualActionType}
                  onChange={(e) => setManualActionType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white"
                >
                  <option value="OPERATIONAL_OVERRIDE">Intervenção Operacional de Turno</option>
                  <option value="TRIP_DELETED">Exclusão Manual de Viagem</option>
                  <option value="SHIFT_MODIFIED">Alteração Manual de Escala</option>
                  <option value="ROUTE_UPDATED">Ajuste de Itinerário Emergencial</option>
                  <option value="SYSTEM_CONFIG_UPDATED">Configuração Crítica Alterada</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">
                  Nível de Severidade
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CRITICAL', label: 'Crítico', color: 'bg-red-500 text-white' },
                    { id: 'WARNING', label: 'Atenção', color: 'bg-amber-400 text-slate-950 font-black' },
                    { id: 'INFO', label: 'Informativo', color: 'bg-blue-500 text-white' },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setManualSeverity(opt.id as any)}
                      className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                        manualSeverity === opt.id
                          ? `${opt.color} border-slate-950 shadow-md`
                          : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">
                  Descrição Resumida da Ação *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Viagem 104 cancelada por bloqueio na via"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">
                  Justificativa Operacional e Observações
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais sobre quem autorizou e os motivos da alteração..."
                  value={manualDetails}
                  onChange={(e) => setManualDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-medium outline-none focus:ring-2 ring-yellow-400 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-5 py-3 rounded-xl font-black uppercase text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black uppercase text-[10px] tracking-wider rounded-xl shadow-md border-2 border-slate-950 transition-all"
              >
                Salvar Registro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AuditLogManager;
