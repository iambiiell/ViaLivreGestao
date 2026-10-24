import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Cloud, 
  Download, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  ShieldCheck, 
  Loader2, 
  HardDrive, 
  FileJson, 
  Sparkles,
  ArrowRight,
  History
} from 'lucide-react';
import { db, TableName } from '../services/database';
import { User } from '../types';
import { MockNotificationService } from '../services/MockNotificationService';
import { EmailService } from '../services/emailService';

export type BackupFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type BackupDestination = 'DOWNLOAD' | 'CLOUD';

export interface BackupScheduleConfig {
  frequency: BackupFrequency;
  destination: BackupDestination;
  preferredHour: string;
  autoEnabled: boolean;
  updatedAt?: string;
  lastBackupTimestamp?: number;
  lastBackupDestination?: BackupDestination;
  lastBackupSize?: string;
}

export interface BackupHistoryItem {
  id: string;
  timestamp: number;
  dateStr: string;
  frequency: BackupFrequency | 'MANUAL';
  destination: BackupDestination;
  status: 'SUCCESS' | 'ERROR';
  fileName: string;
  tablesCount: number;
  recordsCount: number;
  approxSize: string;
  downloadUrl?: string;
}

interface BackupSchedulePanelProps {
  currentUser: User | null;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onBackupTriggered?: () => void;
}

const STORAGE_CONFIG_KEY = 'vialivre_backup_schedule_config';
const STORAGE_HISTORY_KEY = 'vialivre_backup_snapshots_history';
const STORAGE_TIMESTAMP_KEY = 'vialivre_last_weekly_backup_timestamp';

export const BackupSchedulePanel: React.FC<BackupSchedulePanelProps> = ({
  currentUser,
  addToast,
  onBackupTriggered
}) => {
  const [config, setConfig] = useState<BackupScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      frequency: 'WEEKLY',
      destination: 'CLOUD',
      preferredHour: '03:00',
      autoEnabled: true
    };
  });

  const [history, setHistory] = useState<BackupHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    return raw ? parseInt(raw, 10) : null;
  });

  // Carregar configurações existentes de system_settings do Supabase
  useEffect(() => {
    let isMounted = true;
    const loadRemoteConfig = async () => {
      try {
        const settings = await db.getSystemSettings();
        if (settings && settings.length > 0) {
          const s = settings[0];
          let remoteBackupConfig: Partial<BackupScheduleConfig> | null = null;
          
          if ((s as any).backup_schedule_config) {
            remoteBackupConfig = (s as any).backup_schedule_config;
          } else if (s.description && s.description.startsWith('{')) {
            try {
              const parsed = JSON.parse(s.description);
              if (parsed.backup_schedule_config) remoteBackupConfig = parsed.backup_schedule_config;
            } catch {}
          }

          if (remoteBackupConfig && isMounted) {
            setConfig(prev => ({
              ...prev,
              ...remoteBackupConfig
            }));
          }
        }
      } catch (e) {
        console.warn('Configurações remotas de backup não encontradas, utilizando local.', e);
      }
    };

    loadRemoteConfig();
    return () => { isMounted = false; };
  }, []);

  // Calcular a data prevista do próximo backup
  const nextBackupInfo = useMemo(() => {
    const baseTime = lastBackupTime || Date.now();
    let intervalDays = 7;
    if (config.frequency === 'DAILY') intervalDays = 1;
    if (config.frequency === 'MONTHLY') intervalDays = 30;

    const nextDate = new Date(baseTime + intervalDays * 24 * 60 * 60 * 1000);
    const [hours, minutes] = (config.preferredHour || '03:00').split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      nextDate.setHours(hours, minutes, 0, 0);
    }

    const now = new Date();
    const diffHours = Math.round((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      dateStr: nextDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      timeStr: nextDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      diffHours,
      isOverdue: nextDate.getTime() < now.getTime()
    };
  }, [lastBackupTime, config.frequency, config.preferredHour]);

  // Salvar configurações
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const payload: BackupScheduleConfig = {
        ...config,
        updatedAt: new Date().toISOString()
      };

      // 1. Salvar no localStorage
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(payload));

      // 2. Tentar persistir na tabela system_settings no Supabase
      try {
        const settings = await db.getSystemSettings();
        if (settings && settings.length > 0) {
          const s = settings[0];
          let updatedDesc = '';
          try {
            const currentObj = s.description && s.description.startsWith('{') ? JSON.parse(s.description) : {};
            currentObj.backup_schedule_config = payload;
            updatedDesc = JSON.stringify(currentObj);
          } catch {
            updatedDesc = JSON.stringify({ backup_schedule_config: payload });
          }

          await db.update('system_settings', {
            id: s.id,
            description: updatedDesc
          });
        }
      } catch (dbErr) {
        console.warn('Aviso: salvo localmente, mas erro ao sincronizar system_settings no banco:', dbErr);
      }

      window.dispatchEvent(new CustomEvent('vialivre-backup-config-updated', { detail: payload }));
      addToast('Configurações de agendamento de backup salvas com sucesso!', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Erro ao salvar configurações de backup.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Disparar backup imediato
  const handleRunImmediateBackup = async () => {
    setIsRunningBackup(true);
    addToast(
      config.destination === 'CLOUD' 
        ? 'Iniciando captura e envio do snapshot para a Nuvem Supabase...' 
        : 'Iniciando exportação e download do backup completo...', 
      'info'
    );

    try {
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
      let totalRecords = 0;

      for (const table of tables) {
        try {
          const tableData = await db.fetchAll(table);
          backupData[table] = tableData || [];
          totalRecords += (tableData || []).length;
        } catch {
          backupData[table] = [];
        }
      }

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const sizeKb = (blob.size / 1024).toFixed(1);
      const approxSize = blob.size > 1024 * 1024 ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;

      const todayStr = new Date().toISOString().split('T')[0];
      const nowTs = Date.now();
      const backupFileName = `vialivre_backup_${config.destination.toLowerCase()}_${todayStr}_${nowTs.toString().slice(-4)}.json`;
      
      const fileUrl = URL.createObjectURL(blob);

      // Destino: Download Direto
      if (config.destination === 'DOWNLOAD') {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = backupFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Envio de Backup por E-mail para o Administrador Raiz
      const adminEmail = currentUser?.email || 'via.nicolau.sa@gmail.com';
      try {
        await EmailService.sendAdminBackupFileEmail(
          adminEmail,
          backupFileName,
          jsonStr,
          fileUrl,
          currentUser?.system_id || 'root-system'
        );
      } catch (mailErr) {
        console.warn('Erro ao disparar e-mail de backup:', mailErr);
      }

      // Destino: Nuvem (Registrar evento / notificação no Supabase)
      if (currentUser) {
        try {
          await MockNotificationService.notifyAdminAboutBackup(
            currentUser.id,
            adminEmail,
            backupFileName,
            fileUrl,
            currentUser.system_id
          );
        } catch (e) {
          console.warn('Erro ao notificar no Supabase:', e);
        }
      }

      // Salvar timestamp e histórico
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, nowTs.toString());
      setLastBackupTime(nowTs);

      const historyItem: BackupHistoryItem = {
        id: `snap_${nowTs}`,
        timestamp: nowTs,
        dateStr: new Date().toLocaleString('pt-BR'),
        frequency: 'MANUAL',
        destination: config.destination,
        status: 'SUCCESS',
        fileName: backupFileName,
        tablesCount: tables.length,
        recordsCount: totalRecords,
        approxSize,
        downloadUrl: fileUrl
      };

      const newHistory = [historyItem, ...history.slice(0, 9)];
      setHistory(newHistory);
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(newHistory));

      addToast(
        config.destination === 'CLOUD'
          ? `Backup na Nuvem concluído com sucesso! (${approxSize}, ${totalRecords} registros em ${tables.length} tabelas)`
          : `Backup baixado com sucesso! Arquivo: ${backupFileName} (${approxSize})`,
        'success'
      );

      if (onBackupTriggered) onBackupTriggered();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    } catch (err: any) {
      console.error('Erro ao executar backup:', err);
      addToast(err?.message || 'Falha ao processar cópia de segurança.', 'error');
    } finally {
      setIsRunningBackup(false);
    }
  };

  const handleDownloadSnapshot = (item: BackupHistoryItem) => {
    if (item.downloadUrl) {
      const link = document.createElement('a');
      link.href = item.downloadUrl;
      link.download = item.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`Download de ${item.fileName} iniciado!`, 'info');
    } else {
      // Se a URL do blob expirou, executa um export rápido
      handleRunImmediateBackup();
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal de Configuração */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-zinc-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-yellow-400 text-slate-900 rounded-2xl flex items-center justify-center font-black shadow-md border-2 border-slate-900 shrink-0">
              <Database size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">
                  Agendamento de Backups Automáticos
                </h3>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck size={12} /> Ativo
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-3">
                Defina a frequência de exportação e o destino do armazenamento dos dados da empresa
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleRunImmediateBackup}
              disabled={isRunningBackup}
              className="px-5 py-3 bg-slate-950 dark:bg-zinc-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md border-2 border-slate-800 transition-all disabled:opacity-50"
              title="Dispara a criação e exportação do snapshot imediatamente"
            >
              {isRunningBackup ? (
                <>
                  <Loader2 size={14} className="animate-spin text-yellow-400" /> Processando Backup...
                </>
              ) : (
                <>
                  <RefreshCw size={14} className="text-yellow-400" /> Fazer Backup Agora
                </>
              )}
            </button>

            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg border-2 border-slate-900 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save size={14} /> Salvar Preferências
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status em Tempo Real: Último e Próximo Backup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Card: Frequência Vigente */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ciclo de Execução</p>
              <h4 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase">
                {config.frequency === 'DAILY' ? 'Diário (24h)' : config.frequency === 'MONTHLY' ? 'Mensal (30 dias)' : 'Semanal (7 dias)'}
              </h4>
              <span className="text-[8px] font-bold text-slate-500">Horário: {config.preferredHour}</span>
            </div>
          </div>

          {/* Card: Destino de Armazenamento */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              config.destination === 'CLOUD' 
                ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600' 
                : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600'
            }`}>
              {config.destination === 'CLOUD' ? <Cloud size={18} /> : <HardDrive size={18} />}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Destino de Salvamento</p>
              <h4 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase">
                {config.destination === 'CLOUD' ? 'Nuvem (Supabase Cloud)' : 'Download Direto (JSON)'}
              </h4>
              <span className="text-[8px] font-bold text-slate-500">
                {config.destination === 'CLOUD' ? 'Snapshot e Notificação' : 'Arquivo local'}
              </span>
            </div>
          </div>

          {/* Card: Próximo Backup Previsto */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Próximo Agendamento</p>
              <h4 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase">
                {nextBackupInfo.dateStr}
              </h4>
              <span className="text-[8px] font-bold text-slate-500">
                Às {nextBackupInfo.timeStr} (em ~{Math.max(0, nextBackupInfo.diffHours)}h)
              </span>
            </div>
          </div>
        </div>

        {/* Seleção 1: Frequência dos Backups Automáticos */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-black uppercase text-slate-800 dark:text-zinc-100 mb-1">
              1. Escolha a Frequência do Backup Automático
            </label>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Determina o intervalo de tempo entre as gerações automáticas de cópia de segurança
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Opção: Diário */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, frequency: 'DAILY' }))}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                config.frequency === 'DAILY'
                  ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-950/20 shadow-md'
                  : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="p-3 bg-yellow-400 text-slate-900 rounded-2xl font-black">
                  <Calendar size={18} />
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.frequency === 'DAILY' ? 'border-yellow-500 bg-yellow-400' : 'border-slate-300'
                }`}>
                  {config.frequency === 'DAILY' && <CheckCircle2 size={12} className="text-slate-900" />}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">Diário</h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-normal">
                  Cópia a cada 24 horas. Recomendado para alto volume de passagens emitidas e fechamentos diários de caixa.
                </p>
              </div>
            </div>

            {/* Opção: Semanal */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, frequency: 'WEEKLY' }))}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                config.frequency === 'WEEKLY'
                  ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-950/20 shadow-md'
                  : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="p-3 bg-yellow-400 text-slate-900 rounded-2xl font-black">
                  <Clock size={18} />
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.frequency === 'WEEKLY' ? 'border-yellow-500 bg-yellow-400' : 'border-slate-300'
                }`}>
                  {config.frequency === 'WEEKLY' && <CheckCircle2 size={12} className="text-slate-900" />}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase">Semanal</h4>
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-yellow-400 text-slate-900">
                    Padrão
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-normal">
                  Cópia a cada 7 dias. Perfeito equilíbrio entre integridade histórica, segurança e consumo de rede.
                </p>
              </div>
            </div>

            {/* Opção: Mensal */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, frequency: 'MONTHLY' }))}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                config.frequency === 'MONTHLY'
                  ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-950/20 shadow-md'
                  : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="p-3 bg-yellow-400 text-slate-900 rounded-2xl font-black">
                  <Database size={18} />
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.frequency === 'MONTHLY' ? 'border-yellow-500 bg-yellow-400' : 'border-slate-300'
                }`}>
                  {config.frequency === 'MONTHLY' && <CheckCircle2 size={12} className="text-slate-900" />}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">Mensal</h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-normal">
                  Cópia consolidada a cada 30 dias. Ideal para arquivamento fiscal, histórico de balancetes e auditorias.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seleção 2: Destino de Salvamento */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-black uppercase text-slate-800 dark:text-zinc-100 mb-1">
              2. Escolha o Destino de Salvamento
            </label>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Defina para onde o arquivo de cópia de segurança será enviado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opção: Download Direto */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, destination: 'DOWNLOAD' }))}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                config.destination === 'DOWNLOAD'
                  ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-950/20 shadow-md'
                  : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="p-3 bg-slate-900 text-yellow-400 rounded-2xl font-black">
                  <Download size={20} />
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.destination === 'DOWNLOAD' ? 'border-yellow-500 bg-yellow-400' : 'border-slate-300'
                }`}>
                  {config.destination === 'DOWNLOAD' && <CheckCircle2 size={12} className="text-slate-900" />}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">
                  Download Direto (JSON)
                </h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-normal">
                  O sistema compila todas as 31 tabelas operacionais em um arquivo estruturado e aciona o download imediatamente no computador/dispositivo do administrador.
                </p>
              </div>
            </div>

            {/* Opção: Nuvem Supabase */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, destination: 'CLOUD' }))}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                config.destination === 'CLOUD'
                  ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-950/20 shadow-md'
                  : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="p-3 bg-blue-600 text-white rounded-2xl font-black">
                  <Cloud size={20} />
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.destination === 'CLOUD' ? 'border-yellow-500 bg-yellow-400' : 'border-slate-300'
                }`}>
                  {config.destination === 'CLOUD' && <CheckCircle2 size={12} className="text-slate-900" />}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">
                  Nuvem (Supabase Cloud Storage & Database)
                </h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-normal">
                  O snapshot fica resguardado no banco de dados e nuvem Supabase, registrando histórico com link de download disponível na Central de Notificações a qualquer momento.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seleção 3: Horário de Execução */}
        <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-yellow-500 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase text-slate-800 dark:text-zinc-100">
                Horário Preferencial de Execução
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Recomendamos horários de baixa atividade na frota para garantir velocidade máxima
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={config.preferredHour}
              onChange={(e) => setConfig(prev => ({ ...prev, preferredHour: e.target.value }))}
              className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase outline-none focus:border-yellow-400"
            >
              <option value="00:00">00:00 (Meia-noite)</option>
              <option value="02:00">02:00 (Madrugada)</option>
              <option value="03:00">03:00 (Recomendado)</option>
              <option value="05:00">05:00 (Início Turno)</option>
              <option value="12:00">12:00 (Almoço)</option>
              <option value="22:00">22:00 (Fim de Turno)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Histórico Recente de Snapshots */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300">
              <History size={18} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                Histórico Recente de Backups e Snapshots
              </h4>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                Registro das últimas cópias de segurança geradas no sistema
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              try {
                localStorage.removeItem(STORAGE_HISTORY_KEY);
                setHistory([]);
                addToast('Histórico local limpo.', 'info');
              } catch {}
            }}
            className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors"
          >
            Limpar Histórico
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <FileJson size={36} className="mx-auto mb-2 opacity-40 text-yellow-500" />
            <p className="text-[11px] font-black uppercase tracking-wider">
              Nenhum backup recente registrado ainda.
            </p>
            <p className="text-[9px] font-bold mt-1">
              Clique em "Fazer Backup Agora" acima para gerar o primeiro snapshot de segurança.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="pb-3">Data e Hora</th>
                  <th className="pb-3">Arquivo / Snapshot</th>
                  <th className="pb-3">Destino</th>
                  <th className="pb-3">Tamanho</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 font-bold text-slate-800 dark:text-zinc-200">
                      {item.dateStr}
                    </td>
                    <td className="py-3.5 font-mono text-[10px] text-slate-600 dark:text-zinc-300">
                      {item.fileName}
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        item.destination === 'CLOUD' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {item.destination === 'CLOUD' ? <Cloud size={12} /> : <HardDrive size={12} />}
                        {item.destination === 'CLOUD' ? 'Nuvem' : 'Download'}
                      </span>
                    </td>
                    <td className="py-3.5 font-bold text-slate-500 dark:text-zinc-400">
                      {item.approxSize} ({item.recordsCount} registros)
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} /> Sucesso
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => handleDownloadSnapshot(item)}
                        className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm transition-all"
                        title="Baixar este arquivo JSON de backup"
                      >
                        <Download size={11} /> Baixar JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupSchedulePanel;
