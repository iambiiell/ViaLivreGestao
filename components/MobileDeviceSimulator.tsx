import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sparkles, 
  ArrowLeft,
  Info
} from 'lucide-react';
import { MobileSystemView, MobileSystemViewProps } from './MobileSystemView';

interface MobileDeviceSimulatorProps extends MobileSystemViewProps {
  onSwitchToDesktop: () => void;
}

export const MobileDeviceSimulator: React.FC<MobileDeviceSimulatorProps> = (props) => {
  const { onSwitchToDesktop } = props;

  // Scale / Zoom options: 1.0 (100%), 0.9 (90%), 0.82 (82% for smaller laptop screens)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerHeight < 860) {
      return 0.88;
    }
    return 1.0;
  });

  const [isChassisVisible, setIsChassisVisible] = useState<boolean>(true);

  // Auto-adjust scale on resize if screen height is constrained
  useEffect(() => {
    const handleResize = () => {
      if (window.innerHeight < 820) {
        setZoomLevel(0.85);
      } else if (window.innerHeight < 920) {
        setZoomLevel(0.92);
      } else {
        setZoomLevel(1.0);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-slate-900/95 dark:bg-black text-slate-100 flex flex-col items-center justify-start py-3 px-2 overflow-y-auto custom-scrollbar select-none">
      
      {/* Top Floating Simulator Controls Bar */}
      <div className="w-full max-w-2xl bg-slate-950/90 dark:bg-zinc-900/90 border border-slate-800 dark:border-zinc-700 rounded-2xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xl mb-4 backdrop-blur-md z-40 shrink-0">
        
        {/* Device Title & Standard Dimensions Tag */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-sm">
            <Smartphone size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Versão Mobile
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-yellow-400 text-slate-950">
                412 × 732 px
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-medium">
              Tamanho padrão Android / Mobile para controle de frota
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Selector */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700 text-[10px] font-black">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.75, Number((prev - 0.1).toFixed(2))))}
              className="p-1 text-slate-300 hover:text-white"
              title="Diminuir Zoom"
            >
              <ZoomOut size={12} />
            </button>
            <span className="px-1.5 text-yellow-400 font-mono">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.15, Number((prev + 0.1).toFixed(2))))}
              className="p-1 text-slate-300 hover:text-white"
              title="Aumentar Zoom"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Toggle Chassis / Fullscreen View */}
          <button
            onClick={() => setIsChassisVisible(!isChassisVisible)}
            className={`p-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1 ${
              isChassisVisible 
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' 
                : 'bg-yellow-400/20 border-yellow-400 text-yellow-400'
            }`}
            title={isChassisVisible ? 'Ocultar carcaça do smartphone' : 'Exibir carcaça do smartphone'}
          >
            {isChassisVisible ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span className="hidden sm:inline text-[10px] uppercase font-black">
              {isChassisVisible ? 'Sem Moldura' : 'Com Moldura'}
            </span>
          </button>

          {/* Switch to Desktop Button */}
          <button
            onClick={onSwitchToDesktop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            title="Alternar para a visualização padrão de Computador (Desktop)"
          >
            <Monitor size={14} />
            <span>Versão Desktop</span>
          </button>
        </div>
      </div>

      {/* Simulator Presentation Area */}
      <div 
        className="flex-1 flex items-center justify-center p-2 transition-transform duration-200 origin-top"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        {isChassisVisible ? (
          /* Realistic Smartphone Chassis */
          <div className="relative p-3 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-[50px] shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_0_2px_rgba(255,255,255,0.1),0_0_40px_rgba(234,179,8,0.15)] border-2 border-slate-600/60">
            
            {/* Phone Buttons on Chassis */}
            {/* Volume Up / Down on Left */}
            <div className="absolute -left-[5px] top-28 w-[4px] h-12 bg-slate-600 rounded-l-md" />
            <div className="absolute -left-[5px] top-44 w-[4px] h-12 bg-slate-600 rounded-l-md" />
            
            {/* Power Button on Right */}
            <div className="absolute -right-[5px] top-32 w-[4px] h-16 bg-slate-600 rounded-r-md" />

            {/* Top Phone Speaker Notch & Camera Hole-Punch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 pointer-events-none">
              <div className="w-12 h-1 bg-slate-950 rounded-full" />
              <div className="w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-800" />
            </div>

            {/* Screen Bezel (Standard 412px x 732px inner display) */}
            <div className="w-[412px] h-[732px] rounded-[38px] overflow-hidden bg-black shadow-inner border border-slate-950 relative">
              <MobileSystemView 
                {...props} 
                isEmbedded={true}
                onSwitchToDesktop={onSwitchToDesktop}
              />
            </div>

            {/* Bottom Home Indicator Bar on Chassis */}
            <div className="w-28 h-1 bg-slate-500/50 rounded-full mx-auto mt-2 pointer-events-none" />
          </div>
        ) : (
          /* Frameless direct 412x732 standard view */
          <div className="w-[412px] h-[732px] rounded-[32px] overflow-hidden shadow-2xl border-2 border-slate-700 bg-black relative">
            <MobileSystemView 
              {...props} 
              isEmbedded={true}
              onSwitchToDesktop={onSwitchToDesktop}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default MobileDeviceSimulator;
