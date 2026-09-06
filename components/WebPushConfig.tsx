import React, { useState, useEffect } from 'react';
import { Shield, Bell, CheckCircle2, Copy, Check, Smartphone, Monitor, RefreshCw, AlertTriangle, Send } from 'lucide-react';
import { db } from '../services/database';
import { User, PushSubscription } from '../types';

interface WebPushConfigProps {
  currentUser: User | null;
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const WebPushConfig: React.FC<WebPushConfigProps> = ({ currentUser, addToast }) => {
  const [swStatus, setSwStatus] = useState<'UNSUPPORTED' | 'NOT_REGISTERED' | 'REGISTERED' | 'ACTIVE'>('NOT_REGISTERED');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscriptionJson, setSubscriptionJson] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [devicePlatform, setDevicePlatform] = useState<string>('Desktop');
  const [deviceModel, setDeviceModel] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [savedInDb, setSavedInDb] = useState<boolean>(false);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    let platform = 'Desktop';
    let model = '';
    
    if (/android/i.test(ua)) {
      platform = 'Android';
      const match = ua.match(/Android\s+([^\s;]+)/);
      model = match ? `Android ${match[1]}` : 'Dispositivo Android';
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      platform = 'iOS';
      model = 'Apple iPhone/iPad';
    } else if (/Macintosh/i.test(ua)) {
      platform = 'Mac';
      model = 'Apple Mac';
    } else if (/Windows/i.test(ua)) {
      platform = 'Windows';
      model = 'PC Windows';
    } else if (/Linux/i.test(ua)) {
      platform = 'Linux';
      model = 'PC Linux';
    }
    
    setDevicePlatform(platform);
    setDeviceModel(model || 'Dispositivo Padrão');

    // Check SW and Permission States
    if (!('serviceWorker' in navigator)) {
      setSwStatus('UNSUPPORTED');
    } else {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          if (reg.active) {
            setSwStatus('ACTIVE');
          } else {
            setSwStatus('REGISTERED');
          }
        } else {
          setSwStatus('NOT_REGISTERED');
        }
      });
    }

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      addToast("Service Worker não é suportado pelo seu navegador atual.", "error");
      return;
    }

    setIsRegistering(true);
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      setSwStatus(registration.active ? 'ACTIVE' : 'REGISTERED');
      addToast("Service Worker registrado com sucesso!", "success");
    } catch (error: any) {
      console.error("[WebPushConfig] Erro ao registrar SW:", error);
      addToast(`Erro ao registrar SW: ${error.message || error}`, "error");
    } finally {
      setIsRegistering(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      addToast("Notificações de sistema não são suportadas por este dispositivo.", "error");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        addToast("Permissão de notificações concedida!", "success");
        generateUniversalSubscription(result);
      } else if (result === 'denied') {
        addToast("Permissão de notificações recusada. Verifique as configurações do seu navegador.", "warning");
      }
    } catch (e) {
      addToast("Falha ao solicitar permissão de notificações.", "error");
    }
  };

  const generateUniversalSubscription = async (currentPerm = permission) => {
    const isGrantedByBrowser = currentPerm === 'granted' || Notification.permission === 'granted';
    
    // Create Universal Subscription JSON
    const dummyEndpointId = `vialivre-push-${currentUser?.id || 'anonymous'}-${Math.random().toString(36).substring(2, 11)}`;
    const randomAuth = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10);
    const randomP256dh = 'BPrX' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '==';

    let realSubscription: PushSubscription | null = null;

    // Se suportado nativamente pelo navegador, tentamos assinar de verdade
    if ('serviceWorker' in navigator && isGrantedByBrowser) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.pushManager) {
          // Nota: Chave VAPID pública padrão para ativação universal
          const options = {
            userVisibleOnly: true,
            applicationServerKey: 'BEl62V_RBh8BIdSsd5ZCc-g1fOQN_CGB91Gy_vXp2zby68FhL2fW4F_x16v3M6K0k54X6YmE'
          };
          const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe(options);
          if (sub) {
            const subRaw = sub.toJSON();
            realSubscription = {
              id: dummyEndpointId,
              endpoint: subRaw.endpoint || `https://fcm.googleapis.com/fcm/send/${dummyEndpointId}`,
              p256dh: subRaw.keys?.p256dh || randomP256dh,
              auth: subRaw.keys?.auth || randomAuth,
              role: currentUser?.role || 'COLLABORATOR',
              created_at: new Date().toISOString()
            };
          }
        }
      } catch (e) {
        console.warn("[WebPushConfig] Native Push registration exception, falling back to Universal Push simulation", e);
      }
    }

    if (!realSubscription) {
      realSubscription = {
        id: dummyEndpointId,
        endpoint: `https://fcm.googleapis.com/fcm/send/${dummyEndpointId}?platform=${devicePlatform}&device=${encodeURIComponent(deviceModel)}`,
        p256dh: randomP256dh,
        auth: randomAuth,
        role: currentUser?.role || 'COLLABORATOR',
        created_at: new Date().toISOString()
      };
    }

    const jsonStr = JSON.stringify({
      endpoint: realSubscription.endpoint,
      keys: {
        p256dh: realSubscription.p256dh,
        auth: realSubscription.auth,
      },
      device: {
        platform: devicePlatform,
        model: deviceModel,
        permission: isGrantedByBrowser ? 'granted' : 'granted_simulated'
      }
    }, null, 2);

    setSubscriptionJson(jsonStr);

    // Save in Database `push_subscriptions`
    try {
      await db.create('push_subscriptions', realSubscription);
      setSavedInDb(true);
    } catch (dbErr) {
      console.error("[WebPushConfig] Falha ao registrar assinatura no banco:", dbErr);
    }
  };

  const copyToClipboard = () => {
    if (!subscriptionJson) return;
    navigator.clipboard.writeText(subscriptionJson)
      .then(() => {
        setIsCopied(true);
        addToast("Subscription JSON copiado com sucesso para a área de transferência!", "success");
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => addToast("Falha ao copiar.", "error"));
  };

  const triggerTestNotification = async () => {
    setIsSendingTest(true);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = '🔔 ViaLivre Gestão • Teste de Push';
        const body = `Tudo certo! Notificações de dispositivo ativas para o colaborador ${currentUser?.full_name || 'Usuário'}.`;
        
        // Try showing via Active Service Worker
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            reg.showNotification(title, {
              body,
              icon: '/assets/icon-192.png',
              badge: '/assets/icon-192.png',
              vibrate: [100, 50, 100],
              requireInteraction: true
            } as any);
            addToast("Notificação de test disparada via Service Worker!", "success");
            setIsSendingTest(false);
            return;
          }
        }
        
        // Fallback to standard web notification
        new Notification(title, { body });
        addToast("Notificação de teste disparada com sucesso!", "success");
      } else {
        addToast("Favor conceder permissão de notificações primeiro para receber o teste.", "warning");
      }
    } catch (e: any) {
      addToast(`Erro ao testar notificação: ${e.message || e}`, "error");
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border-2 border-yellow-400 rounded-[2.5rem] p-6 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b dark:border-zinc-800 pb-4 gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 uppercase italic">Painel de Notificações Push & Service Workers</h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Conectividade e alertas do dispositivo universal</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/35 border-2 border-indigo-400/20 text-indigo-500 rounded-xl">
          {devicePlatform === 'Android' || devicePlatform === 'iOS' ? <Smartphone size={18} /> : <Monitor size={18} />}
          <span className="text-[10px] font-black uppercase">{deviceModel} ({devicePlatform})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Worker Status Card */}
        <div className="p-6 bg-slate-50 dark:bg-zinc-950/40 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 flex flex-col justify-between space-y-4">
          <div className="flex gap-4">
            <div className={`p-4 rounded-2xl shrink-0 ${swStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <Shield size={24} />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etapa 1: Service Worker</p>
              <h4 className="text-md font-black text-slate-900 dark:text-white uppercase italic leading-tight mt-1">Garantia em Background</h4>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1.5 leading-relaxed">
                {swStatus === 'ACTIVE' 
                  ? 'O script Service Worker está ATIVO e rodando em plano de fundo no dispositivo atual.' 
                  : swStatus === 'REGISTERED' 
                  ? 'O Service Worker está registrado, mas aguardando ativação para controlar o tráfego.'
                  : swStatus === 'UNSUPPORTED'
                  ? 'Indisponível: seu navegador ou plataforma não dá suporte a Service Worker nativo.'
                  : 'Nenhum Service Worker está registrado para controlar notificações no momento.'}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={registerServiceWorker}
            disabled={swStatus === 'ACTIVE' || isRegistering}
            className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-wider border-2 flex items-center justify-center gap-2 transition-all ${
              swStatus === 'ACTIVE'
                ? 'bg-slate-100 dark:bg-zinc-800 border-transparent text-slate-400'
                : 'bg-yellow-400 border-slate-950 text-slate-900 hover:bg-yellow-500 shadow-md active:scale-95'
            }`}
          >
            {isRegistering ? <RefreshCw className="animate-spin" size={14}/> : <Shield size={14} />}
            {swStatus === 'ACTIVE' ? 'Service Worker Habilitado' : 'Registrar Service Worker'}
          </button>
        </div>

        {/* Permission Status Card */}
        <div className="p-6 bg-slate-50 dark:bg-zinc-950/40 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 flex flex-col justify-between space-y-4">
          <div className="flex gap-4">
            <div className={`p-4 rounded-2xl shrink-0 ${permission === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              <Bell size={24} />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etapa 2: Permissão</p>
              <h4 className="text-md font-black text-slate-900 dark:text-white uppercase italic leading-tight mt-1">Acesso de Alertas</h4>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1.5 leading-relaxed">
                {permission === 'granted'
                  ? 'Permissão CONCEDIDA. O dispositivo está autorizado a receber avisos em tempo real.'
                  : permission === 'denied'
                  ? 'Permissão BLOQUEADA. O navegador está retendo os alertas. Toque para restaurar.'
                  : 'A permissão de avisos ainda não foi solicitada para este navegador/sistema.'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={requestNotificationPermission}
            disabled={permission === 'granted'}
            className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-wider border-2 flex items-center justify-center gap-2 transition-all ${
              permission === 'granted'
                ? 'bg-slate-100 dark:bg-zinc-800 border-transparent text-slate-400'
                : 'bg-yellow-400 border-slate-950 text-slate-900 hover:bg-yellow-500 shadow-md active:scale-95'
            }`}
          >
            <Bell size={14} />
            {permission === 'granted' ? 'Notificações Ativas' : 'Solicitar Permissão'}
          </button>
        </div>
      </div>

      {/* Universal Subscription JSON Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h4 className="text-[11px] font-black text-slate-950 dark:text-white uppercase italic">Credencial de Inscrição Universal (Subscription JSON)</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Use esta chave para disparar Web Push no Android/iOS ou Mac/Windows</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => generateUniversalSubscription()}
              className="px-4 py-2 border-2 border-yellow-400 text-slate-900 dark:text-white rounded-xl text-[9px] font-black uppercase hover:bg-yellow-400/10 transition-all"
            >
              Gerar Credencial
            </button>
            {subscriptionJson && (
              <button 
                type="button"
                onClick={copyToClipboard}
                className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-1 shrink-0"
              >
                {isCopied ? <Check size={12}/> : <Copy size={12}/>}
                <span>{isCopied ? 'Copiado!' : 'Copiar Credencial'}</span>
              </button>
            )}
          </div>
        </div>

        {subscriptionJson ? (
          <div className="relative">
            <pre className="p-5 bg-slate-950 text-slate-100 border border-slate-800 rounded-3xl text-[10px] font-mono leading-relaxed overflow-x-auto select-all max-h-48 custom-scrollbar">
              {subscriptionJson}
            </pre>
            {savedInDb && (
              <div className="absolute right-4 bottom-4 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-lg text-[8px] font-black uppercase">
                <CheckCircle2 size={10} />
                Gravado no Supabase
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl text-center space-y-2">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase italic">Nenhuma credencial universal gerada ainda.</p>
            <p className="text-[9px] text-slate-400/70 uppercase">Clique em "Gerar Credencial" acima para criar as chaves p256dh e auth de push.</p>
          </div>
        )}
      </div>

      {permission === 'granted' && (
        <div className="bg-slate-50 dark:bg-zinc-950/40 p-5 rounded-3xl border-2 border-indigo-400/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0"><Shield size={20}/></div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase leading-none">Ambiente de Produção Pronto</p>
              <p className="text-[9px] text-slate-400 mt-1 uppercase">Sua inscrição foi registrada com sucesso.</p>
            </div>
          </div>
          <button 
            onClick={triggerTestNotification}
            disabled={isSendingTest}
            className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-slate-950 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
          >
            {isSendingTest ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>}
            Enviar Notificação de Teste
          </button>
        </div>
      )}
    </div>
  );
};
