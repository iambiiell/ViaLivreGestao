
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar, 
  Key, 
  Building2, 
  Mail, 
  Fingerprint,
  RefreshCw,
  ExternalLink,
  UserCircle,
  Trash2,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivationKey, User, Subscription } from '../types';
import { db } from '../services/database';
import { formatDate } from '../utils/dateFormatter';
import { KeyActivationHistoryModal } from './KeyActivationHistoryModal';

interface LicenseManagementProps {
  currentUser: User | null;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const LicenseManagement: React.FC<LicenseManagementProps> = ({ currentUser, addToast }) => {
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedKeyForHistory, setSelectedKeyForHistory] = useState<ActivationKey | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const [keysData, subsData, usersData] = await Promise.all([
        db.getActivationKeys(),
        db.getSubscriptions(),
        db.getUsers()
      ]);
      setKeys(keysData || []);
      setSubscriptions(subsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching keys:', error);
      addToast('Erro ao carregar gestão de licenças', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta chave cadastrada?')) return;
    setIsDeleting(id);
    try {
      await db.delete('activation_keys', id);
      addToast('Chave de ativação excluída com sucesso!', 'success');
      fetchKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      addToast('Erro ao excluir chave cadastrada.', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredKeys = useMemo(() => {
    return keys.filter(k => 
      k.key_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.owner_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.activated_by_system_id?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.key_code || '').localeCompare(b.key_code || ''));
  }, [keys, searchTerm]);

  if (!currentUser?.is_full_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <ShieldCheck size={64} className="text-slate-200 mb-4" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-400">Acesso Restrito</h2>
        <p className="text-slate-400 max-w-md mt-2">Esta área é exclusiva para o Administrador (Full).</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gestão de Licenças</h2>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monitoramento global de chaves ativadas e empresas vinculadas</p>
        </div>
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por chave, empresa ou e-mail..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all dark:text-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
          onClick={fetchKeys}
          className="p-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
          title="Atualizar"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-800/50">
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">Chave</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">Empresa</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">Usuário</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">E-mail</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">Data Ativação</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">System ID</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-black tracking-widest">Ações</th>
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
                    className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group ${!key.is_used ? 'opacity-50' : ''}`}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <Key size={16} className={key.is_used ? 'text-blue-500' : 'text-slate-300'} />
                        <span className="font-mono font-bold text-sm tracking-tight">{key.key_code}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300">
                          {key.company_name || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <UserCircle size={14} className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300">
                          {key.activated_by_name || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          {key.owner_email || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          {key.activated_at ? formatDate(key.activated_at) : 'Aguardando'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Fingerprint size={14} className="text-slate-400" />
                        <span className="font-mono text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors">
                          {key.activated_by_system_id || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setSelectedKeyForHistory(key)}
                          className="p-2 text-slate-400 hover:text-yellow-500 transition-all active:scale-95"
                          title="Ver Histórico de Ativações e Registro Inicial"
                        >
                          <History size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteKey(key.id)}
                          disabled={isDeleting === key.id}
                          className="p-2 text-slate-400 hover:text-red-500 transition-all active:scale-95 disabled:opacity-50"
                          title="Excluir Chave"
                        >
                          {isDeleting === key.id ? (
                            <RefreshCw size={16} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredKeys.length === 0 && !isLoading && (
            <div className="py-20 text-center">
              <ShieldCheck size={48} className="text-slate-100 dark:text-zinc-800 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Nenhuma licença localizada</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalhado de Histórico de Ativações */}
      {selectedKeyForHistory && (
        <KeyActivationHistoryModal
          isOpen={!!selectedKeyForHistory}
          onClose={() => setSelectedKeyForHistory(null)}
          currentKey={selectedKeyForHistory}
          subscription={subscriptions.find(s => s.system_id === (selectedKeyForHistory.activated_by_system_id || selectedKeyForHistory.system_id)) || subscriptions[0] || null}
          allSystemKeys={keys.filter(k => 
            (k.activated_by_system_id && k.activated_by_system_id === selectedKeyForHistory.activated_by_system_id) ||
            (k.system_id && k.system_id === selectedKeyForHistory.system_id) ||
            k.id === selectedKeyForHistory.id
          )}
          initialAdmin={users.find(u => u.id === selectedKeyForHistory.activated_by_user_id) || users.find(u => u.role === 'ADMIN' || u.is_full_admin) || currentUser}
        />
      )}
    </div>
  );
};

export default LicenseManagement;
