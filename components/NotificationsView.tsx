
import React, { useState, useEffect } from 'react';
import { Bell, Info, AlertTriangle, CheckCircle2, Calendar, Trash2, Loader2, Inbox } from 'lucide-react';
import { CommonLoader } from './CommonLoader';
import { supabase, db } from '../services/database';
import { Notice, User } from '../types';
import { formatDateTime } from '../utils/dateFormatter';

interface NotificationsViewProps {
  currentUser: User | null;
}

const NotificationsView: React.FC<NotificationsViewProps> = ({ currentUser }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUserNotices();

    const sub = db.subscribeTable('notices', () => {
      fetchUserNotices();
    });

    const handleRefresh = () => fetchUserNotices();
    window.addEventListener('vialivre-refresh-data', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);

    return () => {
      sub.unsubscribe();
      window.removeEventListener('vialivre-refresh-data', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
    };
  }, [currentUser]);

  const fetchUserNotices = async () => {
    try {
      setIsLoading(true);
      const userRole = currentUser?.role || 'PASSENGER';
      
      let query = supabase
        .from('notices')
        .select('*');
      
      if (currentUser?.role !== 'ADMIN') {
        query = query.or(`target_role.eq.ALL,target_role.eq.${userRole}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'URGENTE': return <AlertTriangle className="text-red-500" size={24} />;
      case 'SISTEMA': return <Info className="text-blue-500" size={24} />;
      case 'RH': return <CheckCircle2 className="text-emerald-500" size={24} />;
      default: return <Bell className="text-yellow-500" size={24} />;
    }
  };

  const getNoticeTooltip = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'URGENTE': return 'Alerta Urgente: Mudança operacional prioritária ou atenção crítica requerida.';
      case 'SISTEMA': return 'Aviso do Sistema: Logs de processamento ou regras operacionais de frota.';
      case 'RH': return 'Recursos Humanos: Atualizações administrativas gerais e escalonamento.';
      default: return 'Informativo: Notificação informativa geral sobre o trajeto ou rotas.';
    }
  };

  const handleDismissNotice = (id: string) => {
    setAnimatingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(() => {
      setHiddenIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setAnimatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 500);
  };

  const visibleNotices = notices.filter(n => !hiddenIds.has(n.id));

  return (
    <div id="notifications-view-container" className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Minhas Notificações</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Avisos e alertas importantes para você</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
            <CommonLoader variant="bus-radar" message="Buscando seus avisos e alertas..." />
          </div>
        ) : visibleNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
            <Inbox className="text-slate-200 dark:text-zinc-800 mb-4" size={64} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Você não tem notificações no momento</p>
          </div>
        ) : (
          visibleNotices.map((notice) => {
            const isUrgentOrDelay = notice.category?.toUpperCase() === 'URGENTE' || notice.category?.toUpperCase() === 'ATRASO';
            const isAnimating = animatingIds.has(notice.id);
            return (
              <div 
                key={notice.id} 
                className={`notification-item bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transform transition-all duration-500 flex gap-6 items-start group ${
                  isAnimating 
                    ? 'opacity-0 -translate-x-12 scale-95 blur-md max-h-0 py-0 my-0 border-transparent overflow-hidden pointer-events-none' 
                    : ''
                }`}
              >
                {/* TOOLTIP TARGET */}
                <div className={`status-indicator-badge relative p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl shrink-0 group/status ${isUrgentOrDelay ? 'animate-pulse ring-2 ring-red-400 ring-offset-2 dark:ring-offset-zinc-950' : ''}`}>
                  {getIcon(notice.category)}

                  {/* HTML TOOLTIP */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 bg-slate-905 dark:bg-zinc-800 text-slate-100 dark:text-zinc-100 text-[8px] font-black uppercase tracking-wider p-3 rounded-xl border-2 border-yellow-400 opacity-0 group-hover/status:opacity-100 transition-all duration-300 shadow-2xl z-50 text-center scale-95 group-hover/status:scale-100 leading-normal">
                    {getNoticeTooltip(notice.category)}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-yellow-400 w-0 h-0"></div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDateTime(notice.created_at || '')}
                      </span>
                      {notice.target_role === 'ALL' && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest">Público</span>
                      )}
                      <span className={`status-indicator-badge px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                        isUrgentOrDelay 
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 animate-pulse border border-rose-200 dark:border-rose-900/30' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                      }`}>
                        {notice.category}
                      </span>
                    </div>

                    <button 
                      onClick={() => handleDismissNotice(notice.id)}
                      className="p-1 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-red-500 dark:hover:bg-red-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all text-slate-400 text-[8px] font-black uppercase tracking-wider"
                      title="Marcar como lido"
                    >
                      Dispensar
                    </button>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic leading-tight mb-2">{notice.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{notice.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
