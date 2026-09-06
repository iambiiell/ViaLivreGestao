
import React, { useState, useEffect } from 'react';
import { addMonths } from 'date-fns';
import { 
  ShieldCheck, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Key,
  CreditCard,
  Zap,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Subscription, User, ActivationKey } from '../types';
import { db } from '../services/database';
import { formatDate } from '../utils/dateFormatter';

interface UserSubscriptionProps {
  currentUser: User | null;
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const UserSubscription: React.FC<UserSubscriptionProps> = ({ currentUser, addToast }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const subs = await db.getSubscriptions();
      if (subs && subs.length > 0) {
        setSubscription(subs[0]);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateKey = async () => {
    if (!activationKey.trim()) {
      addToast('Por favor, insira uma chave de ativação.', 'warning');
      return;
    }

    setIsActivating(true);
    try {
      const keyCode = activationKey.trim().toUpperCase();
      const keys = await db.getActivationKeys();
      const key = keys.find(k => k.key_code === keyCode && !k.is_used);

      if (!key) {
        addToast('Chave inválida ou já utilizada.', 'error');
        return;
      }

      let expiresAt = new Date();
      
      // If there is an active sub, extend it. Otherwise start from now.
      if (subscription && subscription.status === 'ACTIVE' && new Date(subscription.expires_at) > new Date()) {
        expiresAt = new Date(subscription.expires_at);
      }

      if (key.duration_type === 'DAYS' || (key.duration_days && key.duration_days > 0 && key.duration_type !== 'MONTHS')) {
        const durationDays = Number(key.duration_days) || 30;
        expiresAt.setDate(expiresAt.getDate() + durationDays);
      } else {
        const durationMonths = Number(key.duration_months) || (key.plan_type === 'ANNUAL' ? 12 : key.plan_type === 'QUARTERLY' ? 3 : key.plan_type === 'SEMI_ANNUAL' ? 6 : key.plan_type === 'LIFETIME' ? 999 : 1);
        if (durationMonths === 999) {
          expiresAt = new Date(2099, 11, 31, 23, 59, 59);
        } else {
          expiresAt = addMonths(expiresAt, durationMonths);
        }
      }

      const expiresAtISO = expiresAt.toISOString();

      // Update Key
      await db.update('activation_keys', {
        ...key,
        is_used: true,
        activated_at: new Date().toISOString(),
        expires_at: expiresAtISO,
        activated_by_system_id: db.getSystemId(),
        activated_by_user_id: currentUser?.id,
        activated_by_name: currentUser?.full_name || currentUser?.name,
        owner_email: currentUser?.email
      });

      // Delete old keys for this system
      try {
        const allKeys = await db.getActivationKeys();
        const oldKeys = allKeys.filter(k => 
          k.id !== key.id && 
          k.is_used && 
          k.activated_by_system_id === db.getSystemId()
        );
        
        for (const oldKey of oldKeys) {
          await db.delete('activation_keys', oldKey.id);
        }
      } catch (e) {
        console.error('Error cleaning up old keys:', e);
      }

      if (subscription) {
        await db.update('subscriptions', {
          ...subscription,
          plan_type: key.plan_type,
          expires_at: expiresAtISO,
          status: 'ACTIVE'
        });
      } else {
        await db.create('subscriptions', {
          system_id: db.getSystemId()!,
          plan_type: key.plan_type,
          activated_at: new Date().toISOString(),
          expires_at: expiresAtISO,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
      }

      const successMsg = key.duration_type === 'DAYS'
        ? `Sua assinatura de ${key.duration_days || 30} dias foi ativada com sucesso!`
        : (key.duration_months === 999 
          ? 'Sua assinatura Vitalícia foi ativada com sucesso!'
          : `Sua assinatura de ${key.duration_months || 1} meses foi ativada com sucesso!`);
      
      addToast(successMsg, 'success');
      setActivationKey('');
      loadSubscription();
    } catch (error) {
      console.error('Error activating key:', error);
      addToast('Erro ao ativar chave.', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  const handleRenew = async () => {
    if (!subscription) {
      addToast('Você precisa de um plano ativo para renovar.', 'warning');
      return;
    }

    setIsRenewing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const durationMap: Record<string, number> = {
        'MONTHLY': 30,
        'QUARTERLY': 90,
        'SEMI_ANNUAL': 180,
        'ANNUAL': 365,
        'LIFETIME': 36500
      };

      const duration = durationMap[subscription.plan_type] || 30;
      const expiresAt = new Date(subscription.expires_at);
      
      // If expired, start from now. If active, extend.
      if (expiresAt < new Date()) {
        expiresAt.setTime(new Date().getTime());
      }
      expiresAt.setDate(expiresAt.getDate() + duration);

      await db.update('subscriptions', {
        ...subscription,
        expires_at: expiresAt.toISOString(),
        status: 'ACTIVE'
      });

      addToast('Pagamento processado! Assinatura renovada automaticamente.', 'success');
      loadSubscription();
    } catch (error) {
      console.error('Error renewing subscription:', error);
      addToast('Erro ao processar pagamento.', 'error');
    } finally {
      setIsRenewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Carregando sua assinatura...</p>
      </div>
    );
  }

  const getPlanLabel = (type: string) => {
    const labels: Record<string, string> = {
      'MONTHLY': 'Mensal',
      'QUARTERLY': 'Trimestral',
      'SEMI_ANNUAL': 'Semestral',
      'ANNUAL': 'Anual',
      'LIFETIME': 'Vitalício',
      'TRIAL': 'Teste Grátis (7 dias)'
    };
    return labels[type] || type;
  };

  const isExpired = subscription ? new Date(subscription.expires_at) < new Date() : true;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-slate-900 rounded-[2rem] shadow-xl border-2 border-yellow-400">
          <CreditCard size={32} className="text-yellow-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white leading-none">Minha Assinatura</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Gerencie seu plano e validade do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Current Status Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Zap size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status Atual</span>
              <div className={`px-4 py-1 rounded-full flex items-center gap-2 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isExpired ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                <span className="text-[10px] font-black uppercase">{isExpired ? 'Expirado' : 'Ativo'}</span>
              </div>
            </div>

            <div>
              <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                {subscription ? getPlanLabel(subscription.plan_type) : 'Nenhum Plano'}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">Plano de acesso ao sistema ViaLivre Gestão</p>
            </div>

            <div className="pt-6 border-t border-slate-50 dark:border-zinc-800 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Ativado em</span>
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {subscription ? formatDate(subscription.activated_at) : '---'}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Expira em</span>
                </div>
                <p className={`text-sm font-bold ${isExpired ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {subscription ? formatDate(subscription.expires_at) : '---'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Activate Key Card */}
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl border-2 border-yellow-400/20 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-yellow-400">
              <Key size={20} />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Renovar ou Alterar Plano</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Insira uma nova chave de ativação para estender sua assinatura ou mudar para um plano superior (Trimestral, Semestral, Anual ou Vitalício).
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <input 
                type="text"
                placeholder="VL-XXXX-XXXX-XXXX"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white font-mono font-bold placeholder:text-slate-600 outline-none focus:border-yellow-400 transition-all"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={handleActivateKey}
                disabled={isActivating || !activationKey.trim()}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                {isActivating ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                Ativar Chave
              </button>
              <button 
                onClick={handleRenew}
                disabled={isRenewing || !subscription || subscription.plan_type === 'LIFETIME'}
                className="bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-400/30 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isRenewing ? <RefreshCw size={16} className="animate-spin" /> : <DollarSign size={16} />}
                Renovar Atual
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-800/50 flex gap-6 items-start">
        <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-2xl text-blue-600 dark:text-blue-400">
          <ShieldCheck size={24} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black uppercase text-blue-900 dark:text-blue-300">Segurança e Continuidade</h4>
          <p className="text-xs text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
            Sua assinatura garante o acesso a todas as funcionalidades do sistema ViaLivre Gestão, incluindo backups automáticos, atualizações de segurança e suporte técnico. Ao ativar uma nova chave antes do vencimento, o tempo restante é somado ao novo período.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserSubscription;
