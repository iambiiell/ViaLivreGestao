import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Confirmar Ação',
    message: 'Tem certeza que deseja prosseguir?',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  const [resolveFn, setResolveFn] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: 'danger',
      ...opts
    });
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolveFn(() => resolve);
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setIsOpen(false);
    if (resolveFn) {
      resolveFn(result);
      setResolveFn(null);
    }
  }, [resolveFn]);

  return {
    isOpen,
    options,
    confirm,
    handleClose
  };
}

interface ConfirmDialogModalProps {
  isOpen: boolean;
  options: ConfirmOptions;
  onClose: (result: boolean) => void;
}

export const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({ isOpen, options, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 dark:bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[2.5rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col"
      >
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-black">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">{options.title}</h3>
          </div>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 sm:p-8 space-y-4">
          <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-zinc-300 leading-relaxed">
            {options.message}
          </p>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-zinc-900 border-t dark:border-zinc-800 flex justify-end gap-3">
          <button
            onClick={() => onClose(false)}
            className="px-6 py-3 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 transition-all"
          >
            {options.cancelText || 'Cancelar'}
          </button>
          <button
            onClick={() => onClose(true)}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 transition-all"
          >
            <Trash2 size={16} />
            {options.confirmText || 'Confirmar Exclusão'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
