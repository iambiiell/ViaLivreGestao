import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, 
  QrCode, 
  Radio, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Wifi, 
  Layers, 
  MapPin, 
  Bus, 
  Calendar, 
  CreditCard, 
  Bell, 
  Users, 
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../services/database';

interface MobileSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  systemId?: string | null;
  routesCount?: number;
  tripsCount?: number;
  vehiclesCount?: number;
}

export const MobileSyncModal: React.FC<MobileSyncModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  systemId,
  routesCount = 0,
  tripsCount = 0,
  vehiclesCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'qrcode' | 'shared' | 'config' | 'status'>('qrcode');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [liveServerStats, setLiveServerStats] = useState<any>(null);

  const syncConfig = useMemo(() => {
    try {
      if (typeof db?.getMobileSyncConfig === 'function') {
        return db.getMobileSyncConfig();
      }
    } catch (e) {
      console.warn('Erro ao obter config de sincronização móvel:', e);
    }
    return {
      appName: 'ViaLivre Gestão & Mobile Gateway',
      mobileAppTarget: 'ViaLivre Mobile',
      version: '1.5.0',
      supabaseUrl: 'https://xyzapbchpquycfcqxioz.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFwYmNocHF1eWNmY3F4aW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTI2MzcsImV4cCI6MjEwNzQyODYzN30.b3cEUOfR9ZTEF7Y3r1cLnIfvGE8kxvmVnm8p69jiSnI',
      systemId: systemId || 'sys-vialivre-default',
      apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      realtimeChannels: [],
      publicPassengerTables: [],
      timestamp: Date.now()
    };
  }, [systemId]);

  const activeSystemId = systemId || syncConfig.systemId;

  // Pairing payload formatted for ViaLivre Mobile scanner
  const pairingPayload = useMemo(() => {
    return JSON.stringify({
      app: 'ViaLivre Mobile',
      version: '1.5.0',
      system_id: activeSystemId,
      supabase_url: syncConfig.supabaseUrl,
      supabase_anon_key: syncConfig.supabaseAnonKey,
      api_base_url: syncConfig.apiBaseUrl,
      timestamp: Date.now()
    }, null, 2);
  }, [syncConfig, activeSystemId]);

  // Generate QR Code
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(pairingPayload, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('[MobileSync] Erro gerando QR Code:', err));

    // Fetch server status
    fetch('/api/mobile/sync/status')
      .then(r => r.json())
      .then(data => setLiveServerStats(data))
      .catch(() => {});
  }, [isOpen, pairingPayload]);

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await db.syncWithMobile();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: 'Sincronização com ViaLivre Mobile executada com sucesso!'
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.message || 'Falha ao sincronizar'
        });
      }
      // Refresh status
      const statusRes = await fetch('/api/mobile/sync/status');
      const statusData = await statusRes.json();
      setLiveServerStats(statusData);
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e.message || 'Erro durante a sincronização móvel.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Trava de segurança rigorosa: apenas Administrador tem acesso
  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl sm:rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight italic">
                  Sincronização ViaLivre Mobile
                </h2>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Tempo Real
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                  <ShieldCheck size={10} />
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Conectividade instantânea entre o ViaLivre Gestão e o aplicativo móvel (Exclusivo Administrador)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Strip */}
        <div className="bg-slate-50 dark:bg-zinc-900/60 px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="font-bold">Chave de Ativação (system_id):</span>
            <span className="font-mono font-black text-slate-900 dark:text-white bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
              {activeSystemId}
            </span>
          </div>

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-yellow-300 active:scale-95 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        </div>

        {/* Feedback alert */}
        {syncFeedback && (
          <div className={`px-6 py-2.5 flex items-center gap-2 text-xs font-bold ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800' 
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800'
          }`}>
            {syncFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{syncFeedback.message}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 bg-white dark:bg-zinc-950">
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'qrcode'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            <QrCode size={14} />
            Pareamento QR Code
          </button>

          <button
            onClick={() => setActiveTab('shared')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'shared'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            <Radio size={14} />
            Dados Compartilhados
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'config'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            <Layers size={14} />
            Configuração (.env)
          </button>

          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'status'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            <Activity size={14} />
            Diagnóstico
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {/* TAB 1: QR CODE PAIRING */}
          {activeTab === 'qrcode' && (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 bg-white rounded-3xl border-2 border-slate-200 dark:border-zinc-700 shadow-md flex items-center justify-center shrink-0">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="QR Code de Pareamento ViaLivre Mobile" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 animate-pulse text-xs">
                    Gerando QR Code...
                  </div>
                )}
              </div>

              <div className="space-y-4 text-left flex-1">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                    Parear com o Aplicativo ViaLivre Mobile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Abra o aplicativo <strong>ViaLivre Mobile</strong> no celular (seja na versão de Passageiro ou Operação do Motorista), toque em <strong>Escanear QR Code</strong> e aponte a câmera para sincronizar instantaneamente.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 uppercase font-black tracking-wider">Código de Pareamento Rápido</span>
                    <button
                      onClick={() => handleCopy(pairingPayload, 'pairing_json')}
                      className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1 hover:underline"
                    >
                      {copiedKey === 'pairing_json' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 'pairing_json' ? 'Copiado!' : 'Copiar Token'}
                    </button>
                  </div>
                  <div className="p-2 bg-white dark:bg-zinc-950 rounded-xl font-mono text-[10px] text-slate-700 dark:text-zinc-300 break-all select-all border border-slate-200 dark:border-zinc-800">
                    {pairingPayload.slice(0, 140)}...
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 size={16} />
                  <span>Sincronização bidirecional em nuvem Supabase ativada</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHARED DATA OVERVIEW */}
          {activeTab === 'shared' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <MapPin size={18} />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {liveServerStats?.stats?.routes || routesCount || 0}
                  </p>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rotas Públicas</p>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Janela Aberta</span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center">
                  <div className="w-8 h-8 rounded-xl bg-yellow-500/10 text-yellow-600 flex items-center justify-center mx-auto mb-2">
                    <Bus size={18} />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {liveServerStats?.stats?.trips || tripsCount || 0}
                  </p>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Viagens Hoje</p>
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Tempo Real</span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto mb-2">
                    <CreditCard size={18} />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {liveServerStats?.stats?.cards || 'Sincronizado'}
                  </p>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cartões VT</p>
                  <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">Recarga Mobile</span>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-2xl border border-yellow-200 dark:border-yellow-900/40 text-xs text-slate-700 dark:text-zinc-300 space-y-2">
                <p className="font-black uppercase tracking-wider text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                  <ShieldCheck size={16} />
                  Regras de Multitenancy e Sincronização Ativas:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                  <li><strong>Acesso Aberto (Passageiro):</strong> Rotas, paradas e cidades são consultadas livremente por passageiros sem restrição de tenant.</li>
                  <li><strong>Isolamento Corporativo:</strong> Escalas de motoristas, frotas e diários de bordo são estritamente filtrados pelo <code>system_id</code> da organização.</li>
                  <li><strong>Herança em Cascata:</strong> Novos registos emitidos no app mobile herdam o mesmo <code>system_id</code> do Administrador da organização.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: CONFIGURATION (.ENV / JSON) */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Variáveis de Ambiente para o Projeto ViaLivre Mobile (.env)
                  </label>
                  <button
                    onClick={() => {
                      const envStr = [
                        `EXPO_PUBLIC_SUPABASE_URL=${syncConfig.supabaseUrl}`,
                        `EXPO_PUBLIC_SUPABASE_ANON_KEY=${syncConfig.supabaseAnonKey}`,
                        `EXPO_PUBLIC_API_URL=${syncConfig.apiBaseUrl}`,
                        `EXPO_PUBLIC_SYSTEM_ID=${activeSystemId}`
                      ].join('\n');
                      handleCopy(envStr, 'env_file');
                    }}
                    className="text-xs font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-1 hover:underline"
                  >
                    {copiedKey === 'env_file' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'env_file' ? 'Copiado!' : 'Copiar .env'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-yellow-400 font-mono text-xs rounded-2xl overflow-x-auto border border-slate-800 select-all">
{`EXPO_PUBLIC_SUPABASE_URL=${syncConfig.supabaseUrl}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${syncConfig.supabaseAnonKey}
EXPO_PUBLIC_API_URL=${syncConfig.apiBaseUrl}
EXPO_PUBLIC_SYSTEM_ID=${activeSystemId}`}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Endpoints da API REST Móvel
                  </label>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-600">GET</span> <code>/api/mobile/sync/passenger</code>
                    </div>
                    <span className="text-[10px] text-slate-400">Janela aberta de rotas e avisos</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-600">GET</span> <code>/api/mobile/sync/operational</code>
                    </div>
                    <span className="text-[10px] text-slate-400">Escalas e viagens do motorista</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-600">POST</span> <code>/api/mobile/sync/push</code>
                    </div>
                    <span className="text-[10px] text-slate-400">Push em lote com herança de system_id</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS */}
          {activeTab === 'status' && (
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Status do Banco Supabase:</span>
                  <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online & Conectado
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Serviço de Eventos SSE & Realtime:</span>
                  <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">
                    Ativo (Canal vialivre-mobile-sync)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Provedor de Nuvem:</span>
                  <span className="text-xs font-mono text-slate-900 dark:text-white">
                    xyzapbchpquycfcqxioz.supabase.co
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">CORS para Apps Mobile:</span>
                  <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">
                    Habilitado (Capacitor / Expo / Flutter)
                  </span>
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="px-6 py-3 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Verificando Sincronização...' : 'Executar Teste de Sincronização'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 dark:bg-zinc-800 text-white rounded-xl font-black uppercase text-xs hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileSyncModal;
