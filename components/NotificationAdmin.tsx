
import React, { useState, useEffect } from 'react';
import { Bell, Send, Trash2, Users, ShieldCheck, Loader2, Plus, X, Globe, Truck, Settings, AlertTriangle } from 'lucide-react';
import { supabase, db } from '../services/database';
import { Notice, UserRole, User } from '../types';

interface NotificationAdminProps {
  currentUser: User | null;
}

const ROLES: { value: UserRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos os Usuários' },
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'RH', label: 'Recursos Humanos' },
  { value: 'FISCAL', label: 'Fiscais' },
  { value: 'DRIVER', label: 'Motoristas' },
  { value: 'MECHANIC', label: 'Mecânicos' },
  { value: 'TICKET_AGENT', label: 'Agentes de Vendas' },
  { value: 'PASSENGER', label: 'Passageiros' },
];

const NotificationAdmin: React.FC<NotificationAdminProps> = ({ currentUser }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    target_role: 'ALL' as UserRole | 'ALL',
    category: 'SISTEMA',
    attachment_info: ''
  });

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      setIsLoading(true);
      const data = await db.fetchAll<Notice>('notices');
      setNotices(data || []);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendNotice = async () => {
    if (!newNotice.title || !newNotice.content) {
      alert('Por favor, preencha o título e o conteúdo do aviso.');
      return;
    }

    try {
      setIsSending(true);
      const { data: noticeData, error: noticeError } = await supabase
        .from('notices')
        .insert([{
          ...newNotice,
          created_by: currentUser?.id || 'system',
          system_id: currentUser?.system_id,
          is_active: true
        }])
        .select()
        .single();

      if (noticeError) throw noticeError;

      // Also create a system notification for the badge
      await supabase.from('notifications').insert([{
        user_id: null, // Global or role-based
        title: `Novo Aviso: ${newNotice.title}`,
        message: newNotice.content.substring(0, 100) + '...',
        type: newNotice.category === 'URGENTE' ? 'WARNING' : 'INFO',
        category: 'SYSTEM',
        target_role: newNotice.target_role,
        system_id: currentUser?.system_id,
        is_read: false,
        created_at: new Date().toISOString()
      }]);

      setNewNotice({ title: '', content: '', target_role: 'ALL', category: 'SISTEMA', attachment_info: '' });
      setIsModalOpen(false);
      fetchNotices();
    } catch (error) {
      console.error('Erro ao enviar aviso:', error);
      alert('Erro ao enviar aviso. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aviso?')) return;

    try {
      await db.delete('notices', id);
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Erro ao excluir aviso:', error);
    }
  };

  const filteredNotices = filterCategory === 'ALL' 
    ? notices 
    : notices.filter(n => n.category === filterCategory);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Módulo de Notificações</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Gestão de avisos e alertas inteligentes para a equipe</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-yellow-400 transition-all"
          >
            <option value="ALL">Todos os Setores</option>
            <option value="SISTEMA">Geral</option>
            <option value="RH">RH</option>
            <option value="OPERACIONAL">Operacional</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="URGENTE">Urgente</option>
          </select>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-yellow-500 active:scale-95 transition-all border-2 border-slate-900"
          >
            <Plus size={18} /> Novo Aviso
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800">
            <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando avisos...</p>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800">
            <Bell className="text-slate-200 dark:text-zinc-800 mb-4" size={64} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum aviso encontrado para este filtro</p>
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div key={notice.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                      notice.target_role === 'ALL' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {ROLES.find(r => r.value === notice.target_role)?.label || notice.target_role}
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {new Date(notice.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic leading-tight mb-2">{notice.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-3">{notice.content}</p>
                  {notice.attachment_info && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 w-fit">
                      <Plus size={12} className="text-yellow-500" />
                      <span className="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Anexo: {notice.attachment_info}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => handleDeleteNotice(notice.id)}
                  className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl border dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">Novo Aviso Inteligente</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Público-Alvo *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => setNewNotice({ ...newNotice, target_role: role.value })}
                        className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${
                          newNotice.target_role === role.value 
                            ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-lg' 
                            : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400 dark:text-zinc-600 hover:border-slate-200'
                        }`}
                      >
                        {role.value === 'ALL' ? <Users size={14} /> : <ShieldCheck size={14} />}
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Setor / Categoria *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'SISTEMA', label: 'GERAL', icon: <Globe size={14} /> },
                      { value: 'RH', label: 'RH', icon: <Users size={14} /> },
                      { value: 'OPERACIONAL', label: 'OPERACIONAL', icon: <Truck size={14} /> },
                      { value: 'MANUTENCAO', label: 'MANUTENÇÃO', icon: <Settings size={14} /> },
                      { value: 'URGENTE', label: 'URGENTE', icon: <AlertTriangle size={14} /> }
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setNewNotice({ ...newNotice, category: cat.value })}
                        className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${
                          newNotice.category === cat.value 
                            ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-lg' 
                            : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400 dark:text-zinc-600 hover:border-slate-200'
                        }`}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Título do Aviso *</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-transparent focus:border-yellow-400 transition-all"
                  placeholder="Ex: Reunião de Segurança"
                  value={newNotice.title}
                  onChange={e => setNewNotice({ ...newNotice, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Conteúdo da Mensagem *</label>
                <textarea 
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-transparent focus:border-yellow-400 transition-all min-h-[120px] resize-none"
                  placeholder="Descreva o aviso detalhadamente..."
                  value={newNotice.content || ''}
                  onChange={e => setNewNotice({ ...newNotice, content: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Informação de Anexo (Opcional)</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-transparent focus:border-yellow-400 transition-all"
                  placeholder="Ex: Novo itinerário em anexo"
                  value={newNotice.attachment_info}
                  onChange={e => setNewNotice({ ...newNotice, attachment_info: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSendNotice}
                  disabled={isSending}
                  className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 transition-all disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  Disparar Notificação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationAdmin;
