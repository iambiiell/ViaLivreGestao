import React, { useState, useMemo } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  UserCheck, 
  Mail, 
  Copy, 
  Check, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Fingerprint,
  Building2,
  FileCheck2,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivationKey, Subscription, User } from '../types';
import { formatDate } from '../utils/dateFormatter';

interface KeyActivationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: ActivationKey | null;
  subscription: Subscription | null;
  allSystemKeys?: ActivationKey[];
  initialAdmin?: User | null;
  systemName?: string;
}

export const KeyActivationHistoryModal: React.FC<KeyActivationHistoryModalProps> = ({
  isOpen,
  onClose,
  currentKey,
  subscription,
  allSystemKeys = [],
  initialAdmin,
  systemName = 'ViaLivre Gestão'
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'all-keys'>('details');

  const keyCode = currentKey?.key_code || subscription?.key_code || 'VL-SYS-PROV-2026';
  
  // Format dates with time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '---';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return formatDate(dateStr);
    }
  };

  const planType = currentKey?.plan_type || subscription?.plan_type || 'TRIAL';
  
  const planLabel = useMemo(() => {
    const map: Record<string, string> = {
      'MONTHLY': 'Plano Mensal (30 dias)',
      'QUARTERLY': 'Plano Trimestral (90 dias)',
      'SEMI_ANNUAL': 'Plano Semestral (180 dias)',
      'ANNUAL': 'Plano Anual (365 dias)',
      'LIFETIME': 'Licença Vitalícia Permanente',
      'TRIAL': 'Avaliação Gratuita (7 dias)'
    };
    return map[planType] || planType;
  }, [planType]);

  const activationDate = currentKey?.activated_at || subscription?.activated_at;
  const expirationDate = currentKey?.expires_at || subscription?.expires_at;
  const initialRegistrationDate = currentKey?.created_at || subscription?.created_at || activationDate;

  // Initial Administrator resolution
  const adminName = currentKey?.activated_by_name || 
    subscription?.activated_by_name || 
    initialAdmin?.full_name || 
    initialAdmin?.name || 
    'Administrador Master';

  const adminEmail = currentKey?.owner_email || 
    subscription?.owner_email || 
    initialAdmin?.email || 
    'administrador@vialivregestao.com.br';

  const adminId = currentKey?.activated_by_user_id || 
    subscription?.activated_by_user_id || 
    initialAdmin?.id || 
    'ADM-INIT-001';

  const systemId = currentKey?.activated_by_system_id || 
    currentKey?.system_id || 
    subscription?.system_id || 
    'sys-vialivre-default';

  const isExpired = expirationDate ? new Date(expirationDate) < new Date() : false;

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    if (!expirationDate) return null;
    if (planType === 'LIFETIME') return 9999;
    const diff = new Date(expirationDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [expirationDate, planType]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(keyCode);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAuditReport = () => {
    const text = [
      `=== RELATÓRIO DE AUDITORIA DE ATIVAÇÃO DE CHAVE ===`,
      `Sistema: ${systemName}`,
      `Chave Atual: ${keyCode}`,
      `Status: ${isExpired ? 'EXPIRADA' : 'ATIVA E REGULAR'}`,
      `Plano: ${planLabel}`,
      `Data de Ativação: ${formatDateTime(activationDate)}`,
      `Data de Expiração: ${formatDateTime(expirationDate)}`,
      `Tempo Restante: ${planType === 'LIFETIME' ? 'Acesso Permanente' : `${daysRemaining} dias`}`,
      `--------------------------------------------------`,
      `ADMINISTRADOR RESPONSÁVEL PELO REGISTRO INICIAL:`,
      `Nome: ${adminName}`,
      `E-mail: ${adminEmail}`,
      `ID do Administrador: ${adminId}`,
      `Data do Registro Inicial: ${formatDateTime(initialRegistrationDate)}`,
      `Identificador do Sistema (System ID): ${systemId}`,
      `==================================================`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl border-2 border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col my-auto"
      >
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-zinc-900 text-white flex justify-between items-center border-b border-slate-800 relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-yellow-400/20 border-2 border-yellow-300 shrink-0">
              <KeyRound size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-white leading-tight">
                  Histórico de Ativações da Chave
                </h3>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                  Licença Ativa
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Auditoria de Registro Inicial e Ciclo de Vida da Licença
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-yellow-400 text-slate-900 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={16} />
            Chave & Administrador
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-yellow-400 text-slate-900 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <History size={16} />
            Linha do Tempo
          </button>

          {allSystemKeys.length > 0 && (
            <button
              onClick={() => setActiveTab('all-keys')}
              className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'all-keys'
                  ? 'border-yellow-400 text-slate-900 dark:text-yellow-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <FileCheck2 size={16} />
              Todas as Chaves ({allSystemKeys.length})
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[68vh] space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Card da Chave Atual */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl border-2 border-yellow-400/30 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none">
                  <KeyRound size={160} />
                </div>

                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-yellow-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                        Chave Atual Vinculada
                      </span>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isExpired ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {isExpired ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                      <span>{isExpired ? 'Licença Expirada' : 'Ativa & Homologada'}</span>
                    </div>
                  </div>

                  {/* Código da Chave com Botão de Cópia */}
                  <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-900/80 rounded-xl text-yellow-400 border border-slate-700">
                        <KeyRound size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Código de Ativação</p>
                        <p className="font-mono text-base sm:text-lg font-black tracking-widest text-yellow-300">
                          {keyCode}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleCopyKey}
                      className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
                    >
                      {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedKey ? 'Copiado!' : 'Copiar Chave'}</span>
                    </button>
                  </div>

                  {/* Detalhes do Plano e Validade */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/50">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tipo de Plano</span>
                      <span className="text-xs font-black uppercase text-white mt-1 block">
                        {planLabel}
                      </span>
                    </div>

                    <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/50">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <Calendar size={11} className="text-yellow-400" /> Data de Ativação
                      </span>
                      <span className="text-xs font-bold text-white mt-1 block">
                        {formatDateTime(activationDate)}
                      </span>
                    </div>

                    <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/50">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <Clock size={11} className="text-yellow-400" /> Válida Até
                      </span>
                      <span className={`text-xs font-bold mt-1 block ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                        {planType === 'LIFETIME' ? 'Acesso Permanente' : formatDateTime(expirationDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloco: Administrador Responsável pelo Registro Inicial */}
              <div className="bg-amber-50/70 dark:bg-amber-950/20 p-6 rounded-3xl border-2 border-yellow-400/50 dark:border-yellow-400/30 space-y-4">
                <div className="flex items-center gap-2.5 text-slate-900 dark:text-yellow-400">
                  <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      Administrador Responsável pelo Registro Inicial
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Identificação do gestor que executou o procedimento inicial no sistema
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-yellow-300/40 dark:border-zinc-800 shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Nome do Administrador
                    </span>
                    <p className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <span>{adminName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[9px] font-black">
                        ADMIN
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      E-mail Corporativo
                    </span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Mail size={13} className="text-yellow-500 shrink-0" />
                      <span className="break-all">{adminEmail}</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Data do Registro Inicial
                    </span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400 shrink-0" />
                      <span>{formatDateTime(initialRegistrationDate)}</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      ID de Referência do Administrador
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Fingerprint size={13} className="text-slate-400 shrink-0" />
                      <span>{adminId}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-100/60 dark:bg-yellow-900/20 p-3.5 rounded-xl text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2.5">
                  <ShieldCheck size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <span>
                    Chave vinculada com sucesso à infraestrutura <strong>{systemName}</strong> (System ID: <code className="font-mono font-bold text-yellow-700 dark:text-yellow-300">{systemId}</code>).
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <History size={15} className="text-yellow-500" />
                  Trilha de Auditoria & Ciclo de Vida da Licença
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Registro cronológico de eventos vinculados à chave atual
                </p>
              </div>

              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                {/* Evento 1: Criação/Registro Inicial */}
                <div className="relative">
                  <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs shadow-md">
                    <Calendar size={12} />
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                        1. Registro Inicial da Chave
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {formatDateTime(initialRegistrationDate)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Chave gerada e provisionada para o plano <strong>{planLabel}</strong>. Registro efetuado pelo administrador <strong>{adminName}</strong>.
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Responsável: {adminEmail} • ID: {adminId}
                    </p>
                  </div>
                </div>

                {/* Evento 2: Ativação */}
                <div className="relative">
                  <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-md">
                    <CheckCircle2 size={12} />
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">
                        2. Ativação no Sistema {systemName}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {formatDateTime(activationDate)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Chave validada com sucesso e vinculada à empresa e frotas do sistema.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded-md font-mono text-slate-600 dark:text-zinc-300">
                        Código: {keyCode}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-md font-bold">
                        Status: Ativa
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evento 3: Validade */}
                <div className="relative">
                  <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-md">
                    <Timer size={12} />
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                        3. Período de Validade Homologado
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {formatDateTime(expirationDate)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      {planType === 'LIFETIME'
                        ? 'Licença vitalícia permanente sem data de encerramento programada.'
                        : `Acesso liberado até ${formatDateTime(expirationDate)}. Restam aproximadamente ${daysRemaining} dias de validade.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'all-keys' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 size={15} className="text-yellow-500" />
                  Histórico de Todas as Licenças do Sistema ({allSystemKeys.length})
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Relação de chaves ativadas ou vinculadas a esta instalação
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                {allSystemKeys.map((k, idx) => {
                  const isCurrent = k.key_code === keyCode;
                  const keyExpired = k.expires_at ? new Date(k.expires_at) < new Date() : false;

                  return (
                    <div 
                      key={k.id || idx}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent 
                          ? 'bg-yellow-50/60 dark:bg-yellow-950/20' 
                          : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                            {k.key_code}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 text-[9px] font-black uppercase">
                              Atual
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            keyExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {keyExpired ? 'Expirada' : 'Ativa'}
                          </span>
                        </div>

                        <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                          Plano: {k.plan_type} • Ativado por: {k.activated_by_name || adminName}
                        </p>
                      </div>

                      <div className="text-left sm:text-right text-[10px] text-slate-400 font-bold space-y-0.5">
                        <p>Ativação: {formatDateTime(k.activated_at)}</p>
                        <p>Expiração: {formatDateTime(k.expires_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleCopyAuditReport}
            className="w-full sm:w-auto px-5 py-3 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-200 dark:border-zinc-700 shadow-sm transition-all active:scale-95"
          >
            {copiedReport ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            <span>{copiedReport ? 'Relatório Copiado!' : 'Copiar Relatório de Auditoria'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-slate-900 dark:bg-yellow-400 hover:bg-black dark:hover:bg-yellow-300 text-white dark:text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default KeyActivationHistoryModal;
