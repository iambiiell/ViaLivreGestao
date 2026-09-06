import React, { useState, useEffect, useCallback } from 'react';
import { checkForUpdates } from '../utils/versionChecker';

/**
 * Componente de Alerta de Atualização (src/components/UpdateAlert.jsx)
 * Exibe um banner translúcido em Glassmorphism no canto inferior direito quando
 * uma nova versão for identificada no GitHub.
 */
export const UpdateAlert = ({ onDismiss, onUpdateTriggered }) => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const performCheck = useCallback(async () => {
    try {
      const result = await checkForUpdates();
      if (result && result.hasUpdate) {
        setUpdateInfo(result);
        setIsDismissed(false);
      } else {
        setUpdateInfo(null);
      }
    } catch (e) {
      console.error('[UPDATE_ALERT] Falha na verificação de versão:', e);
    }
  }, []);

  useEffect(() => {
    // Checagem imediata ao montar
    performCheck();

    // Intervalo de 30 minutos (1.800.000 ms)
    const intervalTime = 30 * 60 * 1000;
    const interval = setInterval(() => {
      performCheck();
    }, intervalTime);

    // Event listener para acionamento manual
    const handleManualCheck = () => {
      setIsDismissed(false);
      performCheck();
    };

    window.addEventListener('vialivre-check-github-update', handleManualCheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener('vialivre-check-github-update', handleManualCheck);
    };
  }, [performCheck]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof onDismiss === 'function') onDismiss();
  };

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    if (typeof onUpdateTriggered === 'function') onUpdateTriggered();

    try {
      // 1. Limpeza da Cache API
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }

      // 2. Desregistro de Service Workers para atualização total do PWA
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 3. Limpa manifestos de cache local se houver
      try {
        localStorage.removeItem('vialivre_app_cache_manifest');
      } catch {}

      // 4. Recarrega o aplicativo
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (err) {
      console.warn('[UPDATE_ALERT] Erro na limpeza, executando recarregamento padrão:', err);
      window.location.reload();
    }
  };

  if (!updateInfo || !updateInfo.hasUpdate || isDismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] max-w-[440px] w-[calc(100vw-3rem)] pointer-events-auto"
      role="alert"
      aria-live="polite"
    >
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden transition-all duration-300">
        {/* Borda iluminada superior */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent pointer-events-none" />

        {/* Topo do Alerta */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-yellow-400/20 shrink-0 font-black text-base">
              🚀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-yellow-400/20 text-yellow-800 dark:text-yellow-300 border border-yellow-400/30">
                  Nova Versão
                </span>
                <span className="text-[10px] font-black text-slate-600 dark:text-zinc-400">
                  v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mt-0.5">
                Atualização Disponível
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Lembrar depois"
            aria-label="Fechar alerta"
          >
            ✕
          </button>
        </div>

        {/* Descrição / Notas */}
        <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 mb-5 border border-black/5 dark:border-white/5">
          <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium line-clamp-3 leading-relaxed">
            {updateInfo.releaseNotes || 'Uma nova versão do ViaLivre Gestão está pronta com melhorias, otimizações e correções de segurança.'}
          </p>
          {updateInfo.releaseUrl && (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[11px] font-bold text-yellow-700 dark:text-yellow-400 hover:underline mt-2 tracking-wide"
            >
              Ver notas no GitHub ↗
            </a>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isUpdating}
            className="flex-1 py-3 px-4 rounded-2xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-black text-xs uppercase tracking-wider transition-all active:scale-95 text-center cursor-pointer"
          >
            Lembrar depois
          </button>

          <button
            type="button"
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="flex-1 py-3 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-400/25 transition-all hover:scale-[1.02] active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2"
          >
            {isUpdating ? 'Atualizando...' : 'Atualizar agora'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateAlert;
