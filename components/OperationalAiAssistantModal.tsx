import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, Database, CheckCircle2, AlertTriangle, Bus, MapPin, RefreshCw, X, Send, Loader2 } from 'lucide-react';
import { askOperationalAssistant, getOperationalContext, OperationalContextData } from '../services/geminiService';

interface OperationalAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OperationalAiAssistantModal: React.FC<OperationalAiAssistantModalProps> = ({ isOpen, onClose }) => {
  const [context, setContext] = useState<OperationalContextData | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; time: string }>>([
    {
      sender: 'assistant',
      text: 'Olá! Sou o Tico, o Assistente Operacional Inteligente do ViaLivre Gestão. Estou conectado em tempo real ao banco de dados Supabase. Como posso ajudar com a frota, rotas, manutenções ou escalas hoje?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const loadContext = async () => {
    setIsLoadingContext(true);
    const ctx = await getOperationalContext();
    setContext(ctx);
    setIsLoadingContext(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadContext();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!prompt.trim() || isAsking) return;

    const userText = prompt.trim();
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, time: userTime }]);
    setPrompt('');
    setIsAsking(true);

    try {
      const response = await askOperationalAssistant(userText);
      const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { sender: 'assistant', text: response.reply, time: assistantTime }]);
      if (response.contextSummary) {
        setContext(response.contextSummary);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Ocorreu um erro ao consultar o Tico. Verifique a conexão com a base de dados Supabase.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center relative">
              <Bot size={22} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase text-slate-900 dark:text-zinc-100 tracking-wide flex items-center gap-1.5">
                  Tico <span className="text-xs font-bold text-blue-600 dark:text-blue-400">· Assistente Operacional IA</span>
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Database size={11} /> Supabase PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Sincronizado em tempo real com a base de dados do Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Context Ribbon */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1 font-medium">
              <Bus size={13} className="text-blue-500" />
              Frota: <strong className="font-bold">{context?.fleetSummary.active ?? '...'}</strong>/{context?.fleetSummary.total ?? '...'} operacionais
            </span>
            <span className="flex items-center gap-1 font-medium">
              <MapPin size={13} className="text-emerald-500" />
              Rotas Ativas: <strong className="font-bold">{context?.routesSummary.totalActiveRoutes ?? '...'}</strong>
            </span>
            <span className="flex items-center gap-1 font-medium">
              <AlertTriangle size={13} className="text-amber-500" />
              Ocorrências: <strong className="font-bold">{context?.occurrencesSummary.pendingOccurrences ?? '...'}</strong>
            </span>
          </div>
          <button
            onClick={loadContext}
            disabled={isLoadingContext}
            title="Atualizar dados do banco"
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition"
          >
            <RefreshCw size={13} className={isLoadingContext ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 min-h-[300px]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-bl-none border border-slate-200 dark:border-zinc-700/50'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 px-1">
                {m.time}
              </span>
            </div>
          ))}

          {isAsking && (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              <span>Tico consultando inteligência operacional no Supabase...</span>
            </div>
          )}
        </div>

        {/* Quick Query Pills */}
        <div className="px-6 py-2 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Sugestões:</span>
          <button
            onClick={() => setPrompt('Qual é o resumo da frota e veículos em manutenção?')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 shrink-0 transition"
          >
            Status da Frota
          </button>
          <button
            onClick={() => setPrompt('Quais são as rotas operacionais cadastradas?')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 shrink-0 transition"
          >
            Rotas Cadastradas
          </button>
          <button
            onClick={() => setPrompt('Existe alguma ocorrência técnica ou inspeção pendente?')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 shrink-0 transition"
          >
            Ocorrências Pendentes
          </button>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre escalas, frotas, rotas ou ocorrências operacionais..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isAsking}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={15} />
            <span>Enviar</span>
          </button>
        </div>

      </div>
    </div>
  );
};
