
import React, { useState, useMemo } from 'react';
import { Notice, User, AppNotification } from '../types';
import { Plus, Bell, X, Trash2, Info, Send, Calendar, Hash, Clock, Tag, AlertCircle, Loader2, Search, Save, Megaphone, Smartphone } from 'lucide-react';
import { db, generateUUID } from '../services/database';
import { MockNotificationService } from '../services/MockNotificationService';
import { NotificationService } from '../services/NotificationService';
import { formatDate } from '../utils/dateFormatter';

interface NoticeManagerProps {
  notices: Notice[];
  currentUser: User | null;
  onAddNotice: (notice: Partial<Notice>) => void;
  onDeleteNotice: (id: string) => void;
}

const CATEGORIES = [
    { id: 'GERAL', label: 'Geral', color: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400' },
    { id: 'MANUTENCAO', label: 'Manutenção', color: 'bg-amber-100 dark:bg-amber-900/10 text-amber-700 dark:text-amber-500' },
    { id: 'ATRASO', label: 'Atraso', color: 'bg-red-100 dark:bg-red-900/10 text-red-600 dark:text-red-500' },
    { id: 'SEGURANCA', label: 'Segurança', color: 'bg-emerald-100 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-500' },
];

const NoticeManager: React.FC<NoticeManagerProps> = ({ notices = [], currentUser, onAddNotice, onDeleteNotice }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [formData, setFormData] = useState<Partial<Notice>>({ 
    title: '', 
    content: '', 
    category: 'GERAL',
    target_role: 'ALL',
    is_active: true,
  });

  const filteredNotices = useMemo(() => {
    return (notices || []).filter(n => 
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [notices, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.content?.trim()) return;
    
    setIsSending(true);
    try {
        const newNotice = {
          ...formData,
          protocol: `NTC-${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString(),
        };
        await onAddNotice(newNotice);

        // Envio automático para colaboradores inscritos/que aceitam notificações
        try {
            const allUsers = await db.getAllUsers();
            const targetRole = formData.target_role || 'ALL';
            
            const matchingCollaborators = allUsers.filter(u => {
              const isCollaborator = u.role && u.role !== 'PASSENGER';
              if (!isCollaborator) return false;
              
              const matchesRole = targetRole === 'ALL' || u.role === targetRole;
              if (!matchesRole) return false;
              
              const prefs = u.notification_preferences;
              // Acesso às notificações aceito por padrão (true), a menos que explicitamente optado por false
              const acceptsNotices = !prefs || (prefs as any).notices !== false;
              return acceptsNotices;
            });

            // Envia e registra as notificações para cada colaborador
            for (const col of matchingCollaborators) {
              const notifTitle = `📢 Novo Comunicado: ${newNotice.title}`;
              const notifMsg = `Um novo comunicado foi publicado para a categoria ${newNotice.category}: "${newNotice.content}"`;
              
              // 1. Dispara o push no dispositivo e simulador
              await MockNotificationService.sendPush(col.id, notifTitle, notifMsg);
              NotificationService.sendLocalNotification(notifTitle, {
                body: notifMsg,
                icon: 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png'
              });
              
              // 2. Registra o alerta no banco de notificações em tempo real
              await db.create<AppNotification>('notifications', {
                id: generateUUID(),
                system_id: col.system_id || currentUser?.system_id,
                user_id: col.id,
                title: notifTitle,
                message: notifMsg,
                type: 'INFO',
                category: 'SYSTEM',
                target_role: col.role,
                is_read: false,
                created_at: new Date().toISOString()
              });
            }
            if (matchingCollaborators.length > 0) {

            }
        } catch (pushErr) {
            console.error('[NoticeManager] Erro ao enviar notificações automáticas:', pushErr);
        }

        if (sendPush) {

        }

        setIsModalOpen(false);
        setFormData({ title: '', content: '', category: 'GERAL', is_active: true });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2rem] border-2 border-yellow-400 gap-4 transition-colors">
        <div className="flex-1 w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-zinc-100 tracking-tighter uppercase italic leading-none transition-colors">Central de Comunicados</h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input type="text" placeholder="Pesquisar mensagens..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl hover:bg-yellow-500 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl border-2 border-slate-900"><Plus size={18} /> Novo Alerta</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotices.map(notice => {
          const categoryInfo = CATEGORIES.find(c => c.id === notice.category) || CATEGORIES[0];
          return (
            <div 
              key={notice.id} 
              onClick={() => setSelectedNotice(notice)}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border-2 border-yellow-400 flex flex-col justify-between group hover:shadow-xl hover:scale-[1.02] cursor-pointer transition-all relative overflow-hidden transition-colors h-full"
            >
              <div>
                 <div className="flex items-center justify-between mb-4 animate-in">
                      <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl bg-slate-900 text-yellow-400 transition-colors`}><Megaphone size={20}/></div>
                          <div>
                            <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs truncate max-w-[120px] transition-colors">{notice.title}</h3>
                            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{categoryInfo.label}</span>
                          </div>
                      </div>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if(window.confirm('Excluir esta mensagem permanentemente?')) onDeleteNotice(notice.id); 
                        }} 
                        className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18}/>
                      </button>
                 </div>
                 <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border-2 border-yellow-400/20 mb-4 transition-colors">
                      <p className="text-slate-600 dark:text-zinc-300 text-[11px] leading-relaxed italic transition-colors line-clamp-3">"{notice.content}"</p>
                 </div>
              </div>
              <div className="flex justify-between items-center border-t-2 border-yellow-400 pt-4 transition-colors mt-auto">
                  <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Clock size={12}/> {notice.created_at ? new Date(notice.created_at).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                  <span className="text-[8px] font-mono text-indigo-500 font-bold">{notice.protocol}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border-4 border-yellow-400 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Novo Comunicado</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div>
                    <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2 transition-colors">Título do Alerta</label>
                    <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Manutenção na Via Dutra" />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2 transition-colors">Categoria</label>
                    <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2 transition-colors">Público-Alvo</label>
                    <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={formData.target_role} onChange={e => setFormData({...formData, target_role: e.target.value})}>
                        <option value="ALL">Todos os Usuários</option>
                        <option value="PASSENGER">Passageiro</option>
                        <option value="DRIVER">Motoristas</option>
                        <option value="CONDUCTOR">Cobradores</option>
                        <option value="FISCAL">Fiscais</option>
                        <option value="AGENTE">Agentes de Vendas</option>
                        <option value="DESPACHANTE">Despachantes</option>
                        <option value="ADMIN">Administradores</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2 transition-colors">Mensagem Completa</label>
                    <textarea rows={4} className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Escreva os detalhes aqui..." />
                </div>
                <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border-2 border-dashed border-indigo-400/30 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-indigo-500">
                        <Smartphone size={20}/>
                        <div>
                          <p className="text-[10px] font-black uppercase leading-none">Notificação Push</p>
                          <p className="text-[8px] text-slate-400 mt-1 uppercase">Enviar para passageiros inscritos</p>
                        </div>
                    </div>
                    <input type="checkbox" className="w-6 h-6 rounded-lg accent-indigo-500" checked={sendPush} onChange={e => setSendPush(e.target.checked)} />
                </div>
                <button disabled={isSending} type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-yellow-400 transition-all">
                    {isSending ? <Loader2 className="animate-spin" /> : <Send size={20}/>} Publicar Agora
                </button>
            </form>
          </div>
        </div>
      )}

      {selectedNotice && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[130] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[85vh] transition-colors animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3">
                  <Megaphone className="text-yellow-400 animate-bounce" size={24}/>
                  <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 uppercase italic">Detalhes do Alerta</h3>
                </div>
                <button onClick={() => setSelectedNotice(null)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950 transition-colors text-left">
                <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Título</span>
                    <h4 className="text-xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight mt-1">{selectedNotice.title}</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Categoria</span>
                    <div className="mt-1">
                      <span className="px-3 py-1 bg-yellow-400 text-slate-900 font-black uppercase tracking-widest text-[8px] rounded-lg">
                        {CATEGORIES.find(c => c.id === selectedNotice.category)?.label || selectedNotice.category || 'Geral'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Público-Alvo</span>
                    <p className="text-[10px] font-black text-indigo-500 uppercase mt-1 tracking-wider">
                      {selectedNotice.target_role === 'ALL' ? 'Todos os Usuários' : selectedNotice.target_role}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mensagem do Comunicado</span>
                    <div className="mt-2 bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs leading-relaxed italic transition-colors">
                      "{selectedNotice.content}"
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-zinc-800 pt-4 text-[9px] font-black uppercase text-slate-400">
                    <div className="flex items-center gap-1.5"><Clock size={12}/> Emitido em: {selectedNotice.created_at ? formatDate(selectedNotice.created_at) : 'Hoje'}</div>
                    <div className="text-right font-mono text-indigo-400">Protocolo: {selectedNotice.protocol}</div>
                </div>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setSelectedNotice(null)} className="px-8 py-4 bg-slate-900 text-white rounded-[2rem] text-[10px] uppercase font-black tracking-widest transition-all hover:bg-slate-800 border-2 border-yellow-400 shadow-lg active:scale-95">Fechar Alerta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeManager;
