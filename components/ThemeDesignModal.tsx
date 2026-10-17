import React from 'react';
import { 
  Palette, 
  X, 
  Sun, 
  Moon, 
  Layers, 
  Check, 
  Pipette, 
  Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SystemSettings, ThemeMode } from '../types';
import { 
  PRESET_THEME_COLORS, 
  resolveThemeColors, 
  isValidHexColor, 
  applyThemeVariables 
} from '../utils/themeHelper';
import { db } from '../services/database';

export interface ThemeDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  systemSettings?: SystemSettings | null;
  onUpdateSettings?: (settings: any) => void;
}

export const ThemeDesignModal: React.FC<ThemeDesignModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  onChangeThemeMode,
  systemSettings,
  onUpdateSettings
}) => {
  if (!isOpen) return null;

  const currentThemeColor = systemSettings?.theme_color || 'yellow';
  const resolved = resolveThemeColors(currentThemeColor);

  const handleSelectColor = (colorId: string) => {
    applyThemeVariables(colorId);
    if (onUpdateSettings) {
      onUpdateSettings({
        ...(systemSettings || {
          id: 'sys-set-001',
          system_id: db.getSystemId() || 'sys-vialivre-default',
          system_name: 'ViaLivre Gestão',
          company_name: 'ViaLivre Gestão',
          registration_pattern: 'FLX-000',
          theme_color: 'yellow',
          glass_effect: true,
          support_email: 'via.nicolau.sa@gmail.com'
        }),
        theme_color: colorId
      });
    }
  };

  const handleToggleGlass = () => {
    if (onUpdateSettings) {
      const isCurrentlyGlass = systemSettings?.glass_effect !== false;
      onUpdateSettings({
        ...(systemSettings || {
          id: 'sys-set-001',
          system_id: db.getSystemId() || 'sys-vialivre-default',
          system_name: 'ViaLivre Gestão',
          company_name: 'ViaLivre Gestão',
          registration_pattern: 'FLX-000',
          theme_color: 'yellow',
          glass_effect: true,
          support_email: 'via.nicolau.sa@gmail.com'
        }),
        glass_effect: !isCurrentlyGlass
      });
    }
  };

  const handleToggleContrast = () => {
    if (systemSettings && onUpdateSettings) {
      onUpdateSettings({
        ...systemSettings,
        high_contrast: !systemSettings.high_contrast
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-3.5 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md overflow-hidden select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-[400px] max-h-[88vh] rounded-[28px] shadow-2xl border-2 border-yellow-400 p-5 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 flex flex-col relative"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shadow-xs">
                <Palette size={20} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
                  Design e Cores
                </h2>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">
                  Personalização da Interface
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-all active:scale-90"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="mt-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1 text-left">
            
            {/* 1. Theme Mode: Claro vs Escuro */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-2 tracking-wider">
                Aparência do Painel
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('light')}
                  className={`min-h-[48px] p-3 rounded-2xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    themeMode === 'light' 
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-400/10 text-slate-900 dark:text-yellow-400 shadow-sm ring-2 ring-yellow-400/30' 
                      : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-slate-300'
                  }`}
                >
                  <Sun size={18} className={themeMode === 'light' ? 'text-yellow-500' : ''} />
                  <span>Modo Claro</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('dark')}
                  className={`min-h-[48px] p-3 rounded-2xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    themeMode === 'dark' 
                      ? 'border-yellow-400 bg-yellow-400/15 text-white dark:text-yellow-400 shadow-sm ring-2 ring-yellow-400/30' 
                      : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-slate-300'
                  }`}
                >
                  <Moon size={18} className={themeMode === 'dark' ? 'text-yellow-400' : ''} />
                  <span>Modo Escuro</span>
                </button>
              </div>
            </div>

            {/* 2. Glassmorphism Effect */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-2 tracking-wider">
                Efeito Visual
              </label>
              <button 
                type="button" 
                onClick={handleToggleGlass}
                className={`min-h-[50px] p-3.5 rounded-2xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-between w-full cursor-pointer select-none active:scale-95 ${
                  systemSettings?.glass_effect !== false 
                    ? 'border-yellow-400 bg-yellow-400/10 text-slate-900 dark:text-yellow-400 shadow-sm ring-2 ring-yellow-400/20' 
                    : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 bg-slate-50/50 dark:bg-zinc-800/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers size={18} className={systemSettings?.glass_effect !== false ? 'text-yellow-500 dark:text-yellow-400' : 'text-slate-400 dark:text-zinc-500'} />
                  <span>Efeito Translúcido (Vidro)</span>
                </span>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                  systemSettings?.glass_effect !== false 
                    ? 'bg-yellow-400 text-slate-950 font-black' 
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  {systemSettings?.glass_effect !== false ? 'Ativado' : 'Desativado'}
                </span>
              </button>
            </div>

            {/* 3. Accessibility / High Contrast */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-2 tracking-wider">
                Acessibilidade
              </label>
              <button 
                type="button" 
                onClick={handleToggleContrast}
                className={`min-h-[50px] p-3.5 rounded-2xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-between w-full active:scale-95 ${
                  systemSettings?.high_contrast 
                    ? 'border-yellow-400 bg-yellow-400/10 text-slate-900 dark:text-yellow-400 ring-2 ring-yellow-400/20' 
                    : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 bg-slate-50/50 dark:bg-zinc-800/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[9px] font-black">A</span>
                  <span>Modo Alto Contraste</span>
                </span>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                  systemSettings?.high_contrast 
                    ? 'bg-yellow-400 text-slate-950 font-black' 
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  {systemSettings?.high_contrast ? 'Ativado' : 'Desativado'}
                </span>
              </button>
            </div>

            {/* 4. Color Palette & Custom Hex */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                  Cor Primária do Sistema
                </label>
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                  {resolved.hex}
                </span>
              </div>

              {/* Custom Color Native Picker */}
              <div className="p-3 mb-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="color"
                    value={resolved.hex}
                    onChange={(e) => handleSelectColor(e.target.value.toLowerCase())}
                    className="w-10 h-10 rounded-xl border-2 border-white dark:border-zinc-700 cursor-pointer shadow-md bg-transparent p-0 overflow-hidden shrink-0"
                    title="Escolher cor personalizada"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100 truncate">Cor Personalizada</p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">Toque para selecionar</p>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={7}
                  placeholder="#FACC15"
                  value={resolved.isCustom ? (systemSettings?.theme_color || '') : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('#') && (isValidHexColor(val) || val.length === 4 || val.length === 7)) {
                      handleSelectColor(val.toLowerCase());
                    }
                  }}
                  className="w-24 h-10 px-2 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold uppercase text-center text-slate-900 dark:text-white outline-none focus:border-yellow-400"
                />
              </div>

              {/* Preset Palette List with large touch buttons */}
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {PRESET_THEME_COLORS.map(palette => {
                  const isSelected = currentThemeColor === palette.id || currentThemeColor.toLowerCase() === palette.primary.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={palette.id}
                      onClick={() => handleSelectColor(palette.id)}
                      className={`min-h-[46px] p-2.5 rounded-2xl border-2 transition-all flex items-center justify-between w-full active:scale-98 ${
                        isSelected 
                          ? 'border-yellow-400 bg-yellow-400/10 dark:bg-yellow-400/15 shadow-sm ring-1 ring-yellow-400/40' 
                          : 'border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-5 h-5 rounded-full shadow-sm border border-black/10 shrink-0" 
                          style={{ backgroundColor: palette.primary }} 
                        />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                          {palette.name}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer Close Button */}
          <div className="pt-3.5 border-t border-slate-200 dark:border-zinc-800 shrink-0 mt-2">
            <button
              onClick={onClose}
              className="w-full min-h-[48px] py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95 transition-all"
            >
              Concluir e Aplicar
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ThemeDesignModal;
