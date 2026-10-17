import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ShieldAlert, Clock, Calendar, Download, ExternalLink, X, ChevronDown, ChevronUp, Sparkles, RefreshCw, KeyRound } from 'lucide-react';
import { Subscription } from '../types';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import { motion, AnimatePresence } from 'framer-motion';

interface SubscriptionExpirationAlertProps {
  subscription: Subscription | null | undefined;
  onForceBackup?: () => void;
  className?: string;
  variant?: 'banner' | 'card';
  dismissible?: boolean;
}

export const getSubscriptionDaysRemaining = (subscription: Subscription | null | undefined): { days: number; hours: number; isExpiringSoon: boolean; isExpired: boolean; isCritical: boolean } | null => {
  if (!subscription || subscription.plan_type === 'LIFETIME') return null;
  const now = new Date();
  const expiresAt = new Date(subscription.expires_at);
  const diffTime = expiresAt.getTime() - now.getTime();
  
  if (diffTime < 0) {
    return { days: 0, hours: 0, isExpiringSoon: false, isExpired: true, isCritical: true };
  }

  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  // Expiring soon if 7 days or fewer remaining
  const isExpiringSoon = days <= 7;
  // Critical if 1 day or fewer (e.g., today or tomorrow)
  const isCritical = days <= 1;

  return { days, hours, isExpiringSoon, isExpired: false, isCritical };
};

export const getPlanLabel = (type: string | undefined): string => {
  if (!type) return 'Assinatura Padrão';
  const labels: Record<string, string> = {
    'MONTHLY': 'Plano Mensal',
    'QUARTERLY': 'Plano Trimestral',
    'SEMI_ANNUAL': 'Plano Semestral',
    'ANNUAL': 'Plano Anual',
    'LIFETIME': 'Plano Vitalício',
    'TRIAL': 'Teste Grátis (7 Dias)'
  };
  return labels[type] || type;
};

export const SubscriptionExpirationAlert: React.FC<SubscriptionExpirationAlertProps> = ({
  subscription,
  onForceBackup,
  className = '',
  variant = 'banner',
  dismissible = true
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Check session storage for dismissed/minimized state
  useEffect(() => {
    if (subscription?.id) {
      const dismissedKey = `vialivre_sub_warn_dismiss_${subscription.id}`;
      const minKey = `vialivre_sub_warn_min_${subscription.id}`;
      if (sessionStorage.getItem(dismissedKey) === 'true') {
        setIsDismissed(true);
      }
      if (sessionStorage.getItem(minKey) === 'true') {
        setIsMinimized(true);
      }
    }
  }, [subscription?.id]);

  const remaining = useMemo(() => getSubscriptionDaysRemaining(subscription), [subscription]);

  if (!subscription || !remaining || !remaining.isExpiringSoon || remaining.isExpired) {
    return null;
  }

  const handleToggleMinimize = () => {
    const nextState = !isMinimized;
    setIsMinimized(nextState);
    if (subscription?.id) {
      sessionStorage.setItem(`vialivre_sub_warn_min_${subscription.id}`, String(nextState));
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (subscription?.id) {
      sessionStorage.setItem(`vialivre_sub_warn_dismiss_${subscription.id}`, 'true');
    }
  };

  const handleRestore = () => {
    setIsDismissed(false);
    setIsMinimized(false);
    if (subscription?.id) {
      sessionStorage.removeItem(`vialivre_sub_warn_dismiss_${subscription.id}`);
      sessionStorage.removeItem(`vialivre_sub_warn_min_${subscription.id}`);
    }
  };

  const isCritical = remaining.isCritical;
  const days = remaining.days;
  const hours = remaining.hours;

  // Title depending on days left
  const titleText = days === 0 
    ? `Atenção Crítica! Assinatura Expira Hoje (${hours}h restantes)`
    : days === 1
    ? `Atenção Urgente! Assinatura Expira Amanhã (1 dia restante)`
    : `Atenção! Assinatura Expirando em ${days} dias`;

  const planName = getPlanLabel(subscription.plan_type);

  // Render minimized ribbon if dismissed or minimized
  if (isDismissed || isMinimized) {
    return (
      <div className={`w-full py-2.5 px-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-black shadow-md border transition-all ${
        isCritical 
          ? 'bg-red-500 text-white border-red-600 shadow-red-500/20' 
          : 'bg-amber-400 text-slate-950 border-amber-500 shadow-amber-400/20'
      } ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-2.5 w-2.5 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          <span className="uppercase tracking-tight text-[11px] truncate">
            {titleText} • <span className="underline">{planName}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my-subscription' }))}
            className={`px-3 py-1 rounded-xl text-[9px] uppercase font-black tracking-wider transition-all shadow-sm ${
              isCritical ? 'bg-white text-red-600 hover:bg-slate-100' : 'bg-slate-950 text-white hover:bg-black'
            }`}
          >
            Renovar Agora
          </button>
          <button
            onClick={handleRestore}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors"
            title="Expandir aviso completo"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border-2 shadow-xl transition-all duration-300 ${
        isCritical
          ? 'bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 dark:from-red-950/40 dark:via-zinc-900/90 dark:to-rose-950/30 border-red-400 dark:border-red-600/70 shadow-red-500/10'
          : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:via-zinc-900/90 dark:to-amber-950/20 border-yellow-400 dark:border-yellow-500/60 shadow-yellow-500/10'
      } ${className}`}
    >
      {/* Decorative background glow */}
      <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
        isCritical ? 'bg-red-500/10' : 'bg-yellow-400/10'
      }`} />

      <div className="p-5 sm:p-7 relative z-10 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 border-2 ${
              isCritical
                ? 'bg-red-600 border-red-700 shadow-red-600/30'
                : 'bg-amber-500 border-amber-600 shadow-amber-500/30'
            }`}>
              <AlertTriangle size={26} className={isCritical ? 'animate-bounce' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  isCritical 
                    ? 'bg-red-600 text-white' 
                    : 'bg-amber-400 text-slate-950'
                }`}>
                  {days === 0 ? 'Expira Hoje' : `${days} ${days === 1 ? 'Dia Restante' : 'Dias Restantes'}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[9px] font-black uppercase tracking-wider">
                  {planName}
                </span>
              </div>
              <h3 className={`text-base sm:text-lg font-black uppercase italic tracking-tight mt-1 leading-tight ${
                isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-800 dark:text-yellow-400'
              }`}>
                {titleText}
              </h3>
            </div>
          </div>

          {/* Action buttons on the header right: minimize & close */}
          {dismissible && (
            <div className="flex items-center gap-1.5 self-end sm:self-start">
              <button
                onClick={handleToggleMinimize}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-all text-[10px] font-bold uppercase flex items-center gap-1"
                title="Minimizar aviso"
              >
                <ChevronUp size={16} />
                <span className="hidden md:inline">Minimizar</span>
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-all"
                title="Fechar nesta sessão"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Detailed Explanation */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/60 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 space-y-2">
          <p className="font-bold leading-relaxed">
            Sua licença de uso do <strong className="text-slate-950 dark:text-white uppercase font-black">ViaLivre Gestão</strong> está prestes a expirar. 
            Para garantir a continuidade operacional da sua frota, vendas de passagens e relatórios sem interrupção de acesso para você e seus colaboradores, 
            renove sua assinatura ou ative uma nova chave de liberação.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span>Vencimento: <strong className="text-slate-800 dark:text-zinc-200">{formatDate(subscription.expires_at)}</strong></span>
            </div>
            {subscription.activated_at && (
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Ativado em: <strong className="text-slate-800 dark:text-zinc-200">{formatDate(subscription.activated_at)}</strong></span>
              </div>
            )}
            {subscription.key_code && (
              <div className="flex items-center gap-1.5 font-mono">
                <KeyRound size={13} className="text-amber-500" />
                <span>Chave: <strong className="text-slate-800 dark:text-zinc-200">{subscription.key_code}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-yellow-500 shrink-0" />
            <span>Evite bloqueios: gere cópia de segurança antes do término</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onForceBackup && (
              <button 
                onClick={onForceBackup}
                className="flex-1 sm:flex-initial px-5 py-3 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-900 dark:text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm border border-slate-300 dark:border-zinc-700 active:scale-95"
              >
                <Download size={14} className="text-yellow-500" />
                <span>Cópia de Segurança (JSON)</span>
              </button>
            )}

            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my-subscription' }))}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 border-2 ${
                isCritical
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-red-500/20'
                  : 'bg-yellow-400 hover:bg-yellow-500 text-slate-950 border-slate-950 shadow-yellow-400/20'
              }`}
            >
              <span>Reativar / Renovar Plano</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SubscriptionExpirationAlert;
