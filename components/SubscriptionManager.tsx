
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Key, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Edit3,
  Trash2,
  X,
  Save,
  Users,
  Building2,
  Mail,
  AlertTriangle,
  ShieldAlert,
  UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivationKey, Subscription, User, AppNotification } from '../types';
import { db } from '../services/database';
import { MockNotificationService } from '../services/MockNotificationService';
import { formatDate } from '../utils/dateFormatter';

interface SubscriptionManagerProps {
  currentUser: User | null;
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const PLANS = [
  { type: 'MONTHLY', label: 'Mensal', price: 199.00, duration: 30, months: 1 },
  { type: 'QUARTERLY', label: 'Trimestral', price: 549.00, duration: 90, months: 3 },
  { type: 'SEMI_ANNUAL', label: 'Semestral', price: 999.00, duration: 180, months: 6 },
  { type: 'ANNUAL', label: 'Anual', price: 1799.00, duration: 365, months: 12 },
  { type: 'LIFETIME', label: 'Vitalício', price: 4999.00, duration: 36500, months: 120 },
  { type: 'TRIAL', label: 'Teste (7 dias)', price: 0.00, duration: 7, months: 0.25 },
] as const;

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ currentUser, addToast }) => {
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'keys' | 'users'>('keys');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<ActivationKey | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [deleteModalKey, setDeleteModalKey] = useState<ActivationKey | null>(null);
  const [deleteWithProfile, setDeleteWithProfile] = useState<boolean>(true);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // Form state for new key
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number]['type']>('MONTHLY');
  const [customMonths, setCustomMonths] = useState<number>(1);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customDurationType, setCustomDurationType] = useState<'MONTHS' | 'DAYS'>('MONTHS');
  const [customPrice, setCustomPrice] = useState<number>(199.00);

  const isFullAdmin = useMemo(() => {
    const userRole = (currentUser?.role || '').toUpperCase();
    const userJob = (currentUser?.job_title || '').toUpperCase();
    const email = (currentUser?.email || '').toLowerCase();
    const login = (currentUser?.login_acesso || '').toLowerCase();

    return Boolean(
      currentUser?.is_full_admin === true ||
      userRole === 'ADMIN' ||
      userJob.includes('ADMINISTRADOR') ||
      userJob.includes('ADMIN') ||
      email === 'consorcio.imperial.ltda@gmail.com' ||
      email === 'suporte@vialivre.com.br' ||
      email === 'via.nicolau.sa@gmail.com' ||
      login === 'master'
    );
  }, [currentUser]);

  useEffect(() => {
    const plan = PLANS.find(p => p.type === selectedPlan);
    if (plan) {
      setCustomPrice(plan.price);
      if (plan.type === 'TRIAL') {
        setCustomDurationType('DAYS');
        setCustomDays(7);
      } else {
        setCustomDurationType('MONTHS');
        setCustomMonths(plan.months);
      }
    }
  }, [selectedPlan]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [keysData, usersData, subsData, notifsData] = await Promise.all([
        db.getAllActivationKeys(),
        db.getAllUsers(),
        db.getSubscriptions(),
        db.getNotifications()
      ]);
      
      const kData = keysData || [];
      const uData = usersData || [];
      const sData = subsData || [];
      const nData = notifsData || [];
      
      setKeys(kData);
      setAllUsers(uData);

      // check for licenses expiring in 3 days
      const activeSub = sData.find(s => s.status === 'ACTIVE') || sData[0];
      if (activeSub && activeSub.expires_at) {
        const expirationDate = new Date(activeSub.expires_at);
        const today = new Date();
        
        // Zero out the time components for day accuracy
        today.setHours(0, 0, 0, 0);
        const expZeroDate = new Date(expirationDate);
        expZeroDate.setHours(0, 0, 0, 0);
        
        const diffTime = expZeroDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const reminderTitle = `⚠️ Alerta: Sua licença expira em 3 dias!`;
        const alreadyNotified = nData.some(
          n => n.title === reminderTitle && n.message.includes(activeSub.expires_at.split('T')[0] || '')
        );

        if (diffDays === 3 && !alreadyNotified) {
          const adminUsers = uData.filter(u => u.role === 'ADMIN');
          
          for (const admin of adminUsers) {
            const systemNotifId = Math.random().toString(36).substring(2, 11);
            
            // Create in-app app notification for this admin
            await db.create<AppNotification>('notifications', {
              id: systemNotifId,
              system_id: admin.system_id || activeSub.system_id,
              user_id: admin.id,
              title: reminderTitle,
              message: `Atenção Administrador. A licença de uso do sistema ViaLivre para a contratante atual está agendada para expirar em 3 dias (Vencimento: ${new Date(activeSub.expires_at).toLocaleDateString('pt-BR')}). Por favor, providencie a renovação inserindo uma chave válida.`,
              type: 'WARNING',
              category: 'SYSTEM',
              target_role: 'ADMIN',
              is_read: false,
              created_at: new Date().toISOString(),
              metadata: {
                sender_service: 'SubscriptionExpirationReminder',
                expires_at: activeSub.expires_at,
                subscription_id: activeSub.id
              }
            });
            
            // Send simulated email
            if (admin.email) {
              await MockNotificationService.sendEmail(
                admin.email,
                `[ViaLivre] Alerta de Vencimento de Licença`,
                `Olá, ${admin.full_name || admin.name || 'Administrador'}.\n\nEste é um aviso de que a sua licença de uso da plataforma ViaLivre expira em de 3 dias (em ${new Date(activeSub.expires_at).toLocaleDateString('pt-BR')}).\n\nAbra o painel de Gerenciamento de Licenças e insira uma nova chave de ativação para evitar interrupção dos serviços.`
              );
            }
            
            // Send simulated push alert
            await MockNotificationService.sendPush(
              admin.id,
              reminderTitle,
              `Sua licença ViaLivre expira em 3 dias (${new Date(activeSub.expires_at).toLocaleDateString('pt-BR')}). Renove agora para evitar interrupções.`
            );
          }
          
          addToast('Aviso enviado aos administradores: Licença expira em 3 dias!', 'warning');
        }
      }

      // Seed sample data if keys are empty
      if (kData.length === 0 && !isLoading) {
         const sampleKey: Partial<ActivationKey> = {
          key_code: 'MASTER-2024-TEST-KEY',
          plan_type: 'ANNUAL',
          price: 1799.00,
          duration_months: 12,
          is_used: false,
          created_at: new Date().toISOString()
        };
        await db.create<ActivationKey>('activation_keys', sampleKey);
        const updatedKeys = await db.getAllActivationKeys();
        setKeys(updatedKeys);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateKey = async () => {
    setIsGenerating(true);
    try {
      const newKey: Partial<ActivationKey> = {
        key_code: `VL-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        plan_type: selectedPlan,
        price: customPrice,
        duration_months: customDurationType === 'MONTHS' ? customMonths : 0,
        duration_type: customDurationType,
        duration_days: customDurationType === 'DAYS' ? customDays : undefined,
        is_used: false,
        created_at: new Date().toISOString()
      };

      await db.create<ActivationKey>('activation_keys', newKey);
      addToast('Chave de ativação gerada com sucesso!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error generating key:', error);
      addToast('Erro ao gerar chave', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (key_code: string) => {
    navigator.clipboard.writeText(key_code);
    setCopiedKey(key_code);
    addToast('Chave copiada!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;
    setIsUpdating(true);
    try {
      await db.update('activation_keys', editingKey);
      addToast('Chave atualizada com sucesso!', 'success');
      setEditingKey(null);
      fetchData();
    } catch (error) {
      console.error('Error updating key:', error);
      addToast('Erro ao atualizar chave', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteKey = (key: ActivationKey) => {
    if (!isFullAdmin && key.is_used) {
      addToast('Apenas o Administrador (FULL) tem direito de gerenciar e excluir chaves ativadas.', 'error');
      return;
    }
    setDeleteModalKey(key);
    setDeleteWithProfile(key.is_used);
  };

  const handleConfirmDeleteKey = async () => {
    if (!deleteModalKey) return;
    
    if (deleteModalKey.is_used && deleteWithProfile && !isFullAdmin) {
      addToast('Apenas o Administrador (FULL) tem direito a excluir permanentemente o cadastro atribuído à chave.', 'error');
      return;
    }

    setIsProcessingDelete(true);
    try {
      const keyId = deleteModalKey.id;
      const keyCode = deleteModalKey.key_code;
      const systemId = deleteModalKey.activated_by_system_id;
      const userId = deleteModalKey.activated_by_user_id;
      const ownerEmail = deleteModalKey.owner_email;

      // 1. Delete the activation key
      await db.delete('activation_keys', keyId);

      // 2. If deleting associated profile and account permanently
      if (deleteModalKey.is_used && deleteWithProfile) {
        // Find associated users (by userId, email, activation_key, or admin in this system_id)
        const usersToDelete = allUsers.filter(u => 
          (userId && u.id === userId) ||
          (ownerEmail && u.email && u.email.toLowerCase() === ownerEmail.toLowerCase()) ||
          (u.activation_key && u.activation_key.toUpperCase() === keyCode.toUpperCase()) ||
          (systemId && u.system_id === systemId && (u.role === 'ADMIN' || u.is_full_admin))
        );

        for (const u of usersToDelete) {
          await db.delete('users', u.id);
        }

        // Delete associated subscriptions
        if (systemId) {
          const allSubs = await db.getAllSubscriptions();
          const subsToDelete = (allSubs || []).filter((s: any) => s.system_id === systemId);
          for (const sub of subsToDelete) {
            await db.delete('subscriptions', sub.id);
          }
        }

        // Check if current user is one of the deleted users
        const isCurrentSessionDeleted = currentUser && (
          (userId && currentUser.id === userId) ||
          (ownerEmail && currentUser.email && currentUser.email.toLowerCase() === ownerEmail.toLowerCase()) ||
          (currentUser.activation_key && currentUser.activation_key.toUpperCase() === keyCode.toUpperCase())
        );

        if (isCurrentSessionDeleted) {
          localStorage.removeItem('fluxo_session_user');
          addToast('Sua conta e cadastro foram excluídos permanentemente do sistema.', 'warning');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }

        addToast(`Chave ${keyCode} e o perfil/cadastro atribuídos foram excluídos permanentemente do sistema!`, 'success');
      } else {
        addToast(`Chave ${keyCode} excluída com sucesso!`, 'success');
      }

      setDeleteModalKey(null);
      await fetchData();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    } catch (error: any) {
      console.error('Error during key deletion:', error);
      addToast('Erro ao processar exclusão da chave.', 'error');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!isFullAdmin) {
      addToast('Apenas o Administrador (FULL) tem permissão para excluir usuários nesta aba.', 'error');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir este usuário permanentemente do sistema?')) return;
    setIsDeleting(id);
    try {
      await db.delete('users', id);
      addToast('Usuário excluído com sucesso!', 'success');
      fetchData();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    } catch (error) {
      console.error('Error deleting user:', error);
      addToast('Erro ao excluir usuário', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredKeys = useMemo(() => {
    return keys.filter(k => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        k.key_code.toLowerCase().includes(searchLower) ||
        k.plan_type.toLowerCase().includes(searchLower) ||
        k.price.toString().includes(searchLower) ||
        (k.activated_by_name || '').toLowerCase().includes(searchLower) ||
        (k.owner_email || '').toLowerCase().includes(searchLower);
        
      const matchesFilter = filterStatus === 'all' || 
                           (filterStatus === 'available' && !k.is_used) || 
                           (filterStatus === 'used' && k.is_used);
      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [keys, searchTerm, filterStatus]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (u.role !== 'ADMIN') return false;
      return u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.unidade?.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allUsers, searchTerm]);

  const stats = useMemo(() => {
    const total = keys.length;
    const used = keys.filter(k => k.is_used).length;
    const available = total - used;
    const revenue = keys.filter(k => k.is_used).reduce((acc, k) => acc + (k.price || 0), 0);
    return { total, used, available, revenue };
  }, [keys]);

  const getMonths = (type: string) => {
    const map: Record<string, number> = {
      'MONTHLY': 1,
      'QUARTERLY': 3,
      'SEMI_ANNUAL': 6,
      'ANNUAL': 12,
      'LIFETIME': 120,
      'TRIAL': 0.25
    };
    return map[type] || 0;
  };

  if (!isFullAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <ShieldCheck size={64} className="text-slate-200 mb-4" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-400">Acesso Restrito</h2>
        <p className="text-slate-400 max-w-md mt-2">Esta área é exclusiva para o Administrador (Full). Seus privilégios atuais não permitem o acesso a esta aba.</p>
      </div>
    );
  }

  const formatBRL = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: number) => void) => {
    const value = e.target.value.replace(/\D/g, '');
    const numericValue = parseInt(value || '0', 10) / 100;
    setter(numericValue);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-900 rounded-[2rem] shadow-xl border-2 border-yellow-400">
            <ShieldCheck size={32} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">Assinaturas</h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Gestão Global de Chaves e Usuários</p>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'keys' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Key size={14} />
            Chaves de Ativação
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={14} />
            Usuários Cadastrados
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-4 md:pb-0">
        <div className="w-full md:min-w-0 flex-1">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm h-full">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total de Chaves</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{stats.total}</h3>
              <Key className="text-slate-200 dark:text-zinc-700" size={32} />
            </div>
          </div>
        </div>
        <div className="w-full md:min-w-0 flex-1">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm h-full">
            <p className="text-[10px] font-black uppercase text-emerald-500 mb-1">Chaves Disponíveis</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl md:text-3xl font-black text-emerald-600">{stats.available}</h3>
              <CheckCircle2 className="text-emerald-100 dark:text-emerald-900/30" size={32} />
            </div>
          </div>
        </div>
        <div className="w-full md:min-w-0 flex-1">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm h-full">
            <p className="text-[10px] font-black uppercase text-blue-500 mb-1">Chaves Ativadas</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl md:text-3xl font-black text-blue-600">{stats.used}</h3>
              <RefreshCw className="text-blue-100 dark:text-blue-900/30" size={32} />
            </div>
          </div>
        </div>
        <div className="w-full md:min-w-0 flex-1">
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl h-full">
            <p className="text-[10px] font-black uppercase text-yellow-400 mb-1">Receita Total</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl md:text-3xl font-black text-white">{formatBRL(stats.revenue || 0)}</h3>
              <TrendingUp className="text-yellow-400/20" size={32} />
            </div>
          </div>
        </div>
      </div>

      {/* Generation Section */}
      {activeTab === 'keys' && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gerar Nova Chave</h2>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selecione o plano para criar uma chave de ativação única</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                {PLANS.map(plan => (
                  <button
                    key={plan.type}
                    onClick={() => setSelectedPlan(plan.type)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedPlan === plan.type ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {plan.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-slate-400 px-2">Valor R$:</span>
                <input 
                  type="text"
                  value={customPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  onChange={e => handlePriceChange(e, setCustomPrice)}
                  className="w-32 bg-white dark:bg-zinc-700 border-none rounded-xl px-2 py-2 text-[10px] font-black text-right outline-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                <select 
                  value={customDurationType}
                  onChange={e => setCustomDurationType(e.target.value as 'MONTHS' | 'DAYS')}
                  className="bg-transparent text-[9px] font-black uppercase text-slate-400 px-2 border-none outline-none cursor-pointer"
                >
                  <option value="MONTHS">Meses:</option>
                  <option value="DAYS">Dias:</option>
                </select>
                <input 
                  type="number"
                  value={customDurationType === 'MONTHS' ? customMonths : customDays}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    if (customDurationType === 'MONTHS') {
                      setCustomMonths(val);
                    } else {
                      setCustomDays(val);
                    }
                  }}
                  className="w-16 bg-white dark:bg-zinc-700 border-none rounded-xl px-2 py-2 text-[10px] font-black text-center outline-none"
                />
              </div>
              
              <button
                onClick={generateKey}
                disabled={isGenerating}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
                Gerar Chave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={activeTab === 'keys' ? "Buscar por chave..." : "Buscar por nome, e-mail ou unidade..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-bold placeholder:text-slate-400 outline-none focus:ring-2 ring-yellow-400 transition-all"
            />
          </div>

          {activeTab === 'keys' && (
            <div className="flex bg-slate-50 dark:bg-zinc-800 p-1.5 rounded-2xl">
              {(['all', 'available', 'used'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterStatus === status ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {status === 'all' ? 'Todas' : status === 'available' ? 'Disponíveis' : 'Ativadas'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'keys' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-800/50">
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Chave de Ativação</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Plano</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Duração</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Valor</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Associada a</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ativação</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Expiração</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {filteredKeys.map(key => (
                    <motion.tr 
                      key={key.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${key.is_used ? 'bg-slate-100 text-slate-400' : 'bg-yellow-100 text-yellow-600'}`}>
                            <Key size={16} />
                          </div>
                          <span className="font-mono font-bold text-sm tracking-tight">{key.key_code}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black uppercase px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">
                          {PLANS.find(p => p.type === key.plan_type)?.label}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          {key.duration_type === 'DAYS' ? 
                            `${key.duration_days} ${key.duration_days === 1 ? 'Dia' : 'Dias'}` :
                           (key.plan_type === 'TRIAL' ? '7 Dias' : 
                            key.duration_months === 999 ? 'Vitalício' : 
                            `${key.duration_months || getMonths(key.plan_type)} ${(key.duration_months || getMonths(key.plan_type)) === 1 ? 'Mês' : 'Meses'}`)
                          }
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-bold text-slate-900 dark:text-white">R$ {(key.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-8 py-6">
                        {key.is_used ? (
                          <div className="flex items-center gap-2 text-blue-600">
                            <CheckCircle2 size={14} />
                            <span className="text-[9px] font-black uppercase">Ativada</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <AlertCircle size={14} />
                            <span className="text-[9px] font-black uppercase">Disponível</span>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {key.activated_by_name || '---'}
                          </span>
                          {key.owner_email && (
                            <span className="text-[8px] font-black uppercase text-slate-400">
                              {key.owner_email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            {key.activated_at ? formatDate(key.activated_at) : '---'}
                          </span>
                          {key.activated_at && (
                            <span className="text-[8px] font-black uppercase text-slate-400">
                              {new Date(key.activated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${key.expires_at && new Date(key.expires_at) < new Date() ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                            {key.expires_at ? formatDate(key.expires_at) : '---'}
                          </span>
                          {key.expires_at && (
                            <span className="text-[8px] font-black uppercase text-slate-400">
                              Expiração
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => copyToClipboard(key.key_code)}
                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Copiar Chave"
                          >
                            {copiedKey === key.key_code ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                          </button>
                          <button 
                            onClick={() => setEditingKey(key)}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar Chave"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteKey(key)}
                            disabled={isDeleting === key.id}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Excluir Chave"
                          >
                            {isDeleting === key.id ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-800/50">
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuário</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">E-mail</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidade / Empresa</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Login</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Papel</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Chave Vinculada</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map(user => (
                    <motion.tr 
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-lg">
                            <Users size={16} />
                          </div>
                          <span className="font-bold text-sm tracking-tight">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail size={14} />
                          <span className="text-xs">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Building2 size={14} />
                          <span className="text-xs font-bold">{user.unidade}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">{user.login_acesso}</span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${user.is_full_admin ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                          {user.is_full_admin ? 'Master Admin' : user.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Key size={14} />
                          <span className="text-[10px] font-mono font-bold">{user.activation_key || '---'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={isDeleting === user.id}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Excluir Usuário"
                        >
                          {isDeleting === user.id ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
          
          {((activeTab === 'keys' && filteredKeys.length === 0) || (activeTab === 'users' && filteredUsers.length === 0)) && !isLoading && (
            <div className="py-20 text-center">
              {activeTab === 'keys' ? <Key size={48} className="text-slate-100 dark:text-zinc-800 mx-auto mb-4" /> : <Users size={48} className="text-slate-100 dark:text-zinc-800 mx-auto mb-4" />}
              <p className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Nenhum registro encontrado</p>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingKey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                    <Edit3 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Editar Chave</h3>
                    <p className="text-[10px] font-black uppercase text-slate-400">Modifique as propriedades da chave de ativação</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingKey(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Código da Chave</label>
                  <input 
                    type="text"
                    value={editingKey.key_code}
                    onChange={e => setEditingKey({...editingKey, key_code: e.target.value.toUpperCase()})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-mono font-bold outline-none focus:ring-2 ring-blue-400 transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Plano</label>
                    <select 
                      value={editingKey.plan_type}
                      onChange={e => {
                        const type = e.target.value as ActivationKey['plan_type'];
                        const plan = PLANS.find(p => p.type === type);
                        setEditingKey({
                          ...editingKey, 
                          plan_type: type, 
                          price: plan?.price || editingKey.price,
                          duration_months: type === 'TRIAL' ? 0 : (plan?.months || editingKey.duration_months),
                          duration_type: type === 'TRIAL' ? 'DAYS' : 'MONTHS',
                          duration_days: type === 'TRIAL' ? 7 : undefined
                        });
                      }}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-blue-400 transition-all appearance-none"
                    >
                      {PLANS.map(p => (
                        <option key={p.type} value={p.type}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo Duração</label>
                    <select 
                      value={editingKey.duration_type || 'MONTHS'}
                      onChange={e => {
                        const type = e.target.value as 'MONTHS' | 'DAYS';
                        setEditingKey({
                          ...editingKey, 
                          duration_type: type,
                          duration_days: type === 'DAYS' ? (editingKey.duration_days || 30) : undefined
                        });
                      }}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-blue-400 transition-all appearance-none"
                    >
                      <option value="MONTHS">Meses</option>
                      <option value="DAYS">Dias</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">
                      {(editingKey.duration_type || 'MONTHS') === 'MONTHS' ? 'Duração (Meses)' : 'Duração (Dias)'}
                    </label>
                    <input 
                      type="number"
                      value={(editingKey.duration_type || 'MONTHS') === 'MONTHS' ? (editingKey.duration_months || 0) : (editingKey.duration_days || 0)}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        if ((editingKey.duration_type || 'MONTHS') === 'MONTHS') {
                          setEditingKey({...editingKey, duration_months: val, duration_days: undefined});
                        } else {
                          setEditingKey({...editingKey, duration_days: val, duration_months: 0});
                        }
                      }}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-blue-400 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor (R$)</label>
                  <input 
                    type="text"
                    value={editingKey.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={e => handlePriceChange(e, (val) => setEditingKey({...editingKey, price: val}))}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl font-bold text-right outline-none focus:ring-2 ring-blue-400 transition-all"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button 
                    onClick={() => setEditingKey(null)}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleUpdateKey}
                    disabled={isUpdating}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* Key Deletion Modal */}
        {deleteModalKey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[3rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-50 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${deleteModalKey.is_used ? 'bg-red-50 dark:bg-red-950/30 text-red-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}>
                    {deleteModalKey.is_used ? <ShieldAlert size={26} /> : <Trash2 size={26} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">
                      {deleteModalKey.is_used ? 'Excluir Chave Ativada' : 'Excluir Chave de Ativação'}
                    </h3>
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      {deleteModalKey.is_used ? 'Opções de exclusão de chave e cadastro vinculado' : 'Confirmação de exclusão permanente de chave disponível'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setDeleteModalKey(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6">
                {/* Key Summary */}
                <div className="bg-slate-50 dark:bg-zinc-800/60 p-5 rounded-2xl border border-slate-100 dark:border-zinc-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-yellow-500" />
                      <span className="font-mono font-black text-sm tracking-tight">{deleteModalKey.key_code}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${deleteModalKey.is_used ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700'}`}>
                      {deleteModalKey.is_used ? 'Chave Ativada' : 'Chave Disponível'}
                    </span>
                  </div>

                  {deleteModalKey.is_used && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50 dark:border-zinc-700/50 text-xs">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Atribuída a:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModalKey.activated_by_name || 'Usuário Cadastrado'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">E-mail:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{deleteModalKey.owner_email || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Unidade/Empresa:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModalKey.company_name || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Ativação em:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{deleteModalKey.activated_at ? formatDate(deleteModalKey.activated_at) : '---'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Options for Activated Key */}
                {deleteModalKey.is_used ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Selecione o nível de exclusão:
                    </p>

                    {/* Option 1: Keep Profile */}
                    <label 
                      onClick={() => setDeleteWithProfile(false)}
                      className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${!deleteWithProfile ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-zinc-800' : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}
                    >
                      <input 
                        type="radio" 
                        name="deleteScope" 
                        checked={!deleteWithProfile} 
                        onChange={() => setDeleteWithProfile(false)}
                        className="mt-1 accent-slate-900"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Excluir apenas a Chave de Ativação</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          A chave será excluída da lista master. O perfil e os cadastros associados no sistema continuam preservados (poderão vincular outra chave posteriormente).
                        </p>
                      </div>
                    </label>

                    {/* Option 2: Delete Key + Profile and Account (FULL Admin Exclusive) */}
                    <label 
                      onClick={() => setDeleteWithProfile(true)}
                      className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${deleteWithProfile ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 shadow-sm' : 'border-slate-100 dark:border-zinc-800 hover:border-red-200'}`}
                    >
                      <input 
                        type="radio" 
                        name="deleteScope" 
                        checked={deleteWithProfile} 
                        onChange={() => setDeleteWithProfile(true)}
                        className="mt-1 accent-red-600"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase text-red-600 dark:text-red-400">
                            Excluir Chave e Apagar Permanentemente Perfil e Cadastro
                          </span>
                          <span className="px-2 py-0.5 bg-yellow-400 text-slate-900 rounded text-[7px] font-black uppercase tracking-wider">
                            ADMINISTRADOR (FULL)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                          A chave de ativação, o perfil de usuário atribuído, a empresa cadastrada e o vínculo de assinatura serão <strong className="text-red-600 dark:text-red-400">excluídos permanentemente</strong> do banco de dados e de todos os dispositivos.
                        </p>
                      </div>
                    </label>

                    {deleteWithProfile && (
                      <div className="p-3.5 bg-red-100/70 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-300">
                        <AlertTriangle size={18} className="shrink-0 text-red-600" />
                        <p className="text-[10px] font-bold leading-tight">
                          Esta ação é irreversível. Todos os dados associados a esta ativação serão apagados permanentemente do sistema.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 text-xs text-slate-600 dark:text-slate-300">
                    <p>Tem certeza que deseja excluir esta chave de ativação disponível? Ela não poderá mais ser utilizada para ativar o sistema.</p>
                  </div>
                )}

                {/* Footer buttons */}
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50 dark:border-zinc-800">
                  <button 
                    onClick={() => setDeleteModalKey(null)}
                    disabled={isProcessingDelete}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmDeleteKey}
                    disabled={isProcessingDelete}
                    className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50 text-white ${deleteModalKey.is_used && deleteWithProfile ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800'}`}
                  >
                    {isProcessingDelete ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        {deleteModalKey.is_used && deleteWithProfile ? 'Excluir Permanentemente' : 'Confirmar Exclusão'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionManager;
