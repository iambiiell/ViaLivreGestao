import React, { useState } from 'react';
import { AlertTriangle, LogOut, PhoneCall, KeyRound, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/database';
import { addMonths } from 'date-fns';
import { ActivationKey, Subscription, User } from '../types';

interface SubscriptionExpiredProps {
  onLogout: () => void;
  onKeyActivated: (newSub: Subscription) => void;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  currentUser: User | null;
  subscription: Subscription | null;
}

const SubscriptionExpired: React.FC<SubscriptionExpiredProps> = ({ 
  onLogout, 
  onKeyActivated, 
  addToast, 
  currentUser,
  subscription 
}) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey.trim()) {
      addToast('Por favor, insira uma chave de ativação.', 'warning');
      return;
    }

    const keyCode = activationKey.trim().toUpperCase();
    const isMasterKey = keyCode === 'MASTER-2024-TEST-KEY';
    const keyPattern = /^VL-[A-Z0-9]{8}-[A-Z0-9]{4}$/i;

    if (!isMasterKey && !keyPattern.test(keyCode)) {
      addToast("A chave de ativação deve estar no padrão VL-00000000-0000 (ex: VL-XXXXXXXX-XXXX)", "warning");
      return;
    }

    setIsActivating(true);
    try {
      const keys = await db.getActivationKeys();
      const key = keys.find(k => k.key_code === keyCode && !k.is_used);

      if (!key) {
        addToast('Chave inválida ou já utilizada.', 'error');
        setIsActivating(false);
        return;
      }

      let expiresAt = new Date();
      if (key.duration_type === 'DAYS') {
        const durationDays = key.duration_days || 30;
        expiresAt.setDate(expiresAt.getDate() + durationDays);
      } else {
        const durationMonths = key.duration_months || 1;
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

      // Cleanup system's old keys (optional)
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

      let updatedSub: Subscription;
      if (subscription) {
        updatedSub = await db.update('subscriptions', {
          ...subscription,
          plan_type: key.plan_type,
          expires_at: expiresAtISO,
          status: 'ACTIVE'
        });
      } else {
        const created = await db.create<any>('subscriptions', {
          system_id: db.getSystemId()!,
          plan_type: key.plan_type,
          activated_at: new Date().toISOString(),
          expires_at: expiresAtISO,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
        updatedSub = created;
      }

      const successMsg = key.duration_type === 'DAYS'
        ? `Sua assinatura de ${key.duration_days || 30} dias foi ativada com sucesso!`
        : (key.duration_months === 999 
          ? 'Sua assinatura Vitalícia foi ativada com sucesso!'
          : `Sua assinatura de ${key.duration_months || 1} meses foi ativada com sucesso!`);

      addToast(successMsg, 'success');
      setShowKeyModal(false);
      setActivationKey('');
      onKeyActivated(updatedSub);
    } catch (error) {
      console.error('Error activating key:', error);
      addToast('Erro ao ativar chave. Verifique sua conexão.', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-red-100 overflow-hidden"
      >
        <div className="bg-red-650 p-8 flex justify-center">
          <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="p-8 text-center">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-950 mb-4">Acesso Suspenso</h1>
          <p className="text-slate-600 mb-8 leading-relaxed font-bold text-xs">
            A assinatura desta unidade do <span className="font-extrabold text-slate-900 uppercase">ViaLivre Gestão</span> expirou. 
            Insira uma nova chave de ativação para renovar ou entre em contato com o suporte técnico.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => setShowKeyModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider transition-all shadow-md active:scale-95"
            >
              <KeyRound className="w-5 h-5" />
              Inserir Nova Chave
            </button>

            <button
              onClick={() => window.open('https://wa.me/5521995421447?text=Olá,%20preciso%20de%20suporte%20no%20sistema%20Viação%20Nicolau%20Transportes%20S/A', '_blank')}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-800 transition-all shadow-md active:scale-95"
            >
              <PhoneCall className="w-5 h-5" />
              Falar com Suporte
            </button>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-500 hover:text-slate-800 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
            >
              <LogOut className="w-5 h-5" />
              Sair do Sistema
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
            ViaLivre Gestão • Infraestrutura Digital
          </p>
        </div>
      </motion.div>

      {/* Activation Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-md p-8 rounded-[2.5rem] border-4 border-yellow-400 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <span className="text-4xl inline-block animate-bounce mb-2">🔑</span>
                <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Inserir Nova Chave</h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Informe o código da sua chave de ativação
                </p>
              </div>

              <form onSubmit={handleActivateKey} className="space-y-4">
                <input 
                  type="text"
                  autoFocus
                  placeholder="VL-00000000-0000"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-center text-slate-900 dark:text-white border-2 border-yellow-400 outline-none uppercase"
                  disabled={isActivating}
                />

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowKeyModal(false);
                      setActivationKey('');
                    }}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 rounded-2xl font-black uppercase text-[10px]"
                    disabled={isActivating}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                    disabled={isActivating}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Ativando...
                      </>
                    ) : (
                      'Confirmar'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionExpired;
