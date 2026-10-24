import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, ArrowRight, Copy, Check } from 'lucide-react';
import { EmailService } from '../services/emailService';

interface VerificationCodeModalProps {
  isOpen: boolean;
  email: string;
  userName?: string;
  purpose: 'REGISTER' | 'PASSWORD_RESET' | 'PASSENGER_REGISTER';
  onSuccess: (code: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export const VerificationCodeModal: React.FC<VerificationCodeModalProps> = ({
  isOpen,
  email,
  userName = 'Usuário',
  purpose,
  onSuccess,
  onCancel,
  title,
  subtitle
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showHelperInfo, setShowHelperInfo] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Find the latest code sent to this email from log for developer/user convenience
  const latestLogCode = useMemo(() => {
    const logs = EmailService.getEmailLog();
    const cleanEmail = (email || '').trim().toLowerCase();
    const found = logs.find(l => l.to.toLowerCase() === cleanEmail && l.code);
    return found?.code || null;
  }, [email, isResending]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setErrorMsg(null);
      setSuccessMsg(null);
      setCountdown(60);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [isOpen, email]);

  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMsg(null);
    const cleaned = value.replace(/\D/g, '');

    // If pasted multiple digits
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 6).split('');
      const newDigits = [...digits];
      pasteDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(pasteDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      if (pasteDigits.length === 6) {
        verifyCompleteCode(newDigits.join(''));
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned.slice(-1);
    setDigits(newDigits);

    // Auto-advance focus to next digit box
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits filled
    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      verifyCompleteCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const verifyCompleteCode = (codeToVerify: string) => {
    setIsVerifying(true);
    setErrorMsg(null);

    setTimeout(() => {
      const result = EmailService.verifyCode(email, codeToVerify, purpose);
      if (result.valid) {
        setSuccessMsg(result.message);
        setTimeout(() => {
          setIsVerifying(false);
          onSuccess(codeToVerify);
        }, 500);
      } else {
        setIsVerifying(false);
        setErrorMsg(result.message);
      }
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setErrorMsg('Por favor, preencha todos os 6 dígitos numéricos.');
      return;
    }
    verifyCompleteCode(fullCode);
  };

  const handleResendCode = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { code } = await EmailService.sendVerificationCodeEmail(email, userName, purpose);
      setSuccessMsg(`Novo código enviado para ${email}!`);
      setCountdown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setErrorMsg('Erro ao reenviar o código. Verifique sua conexão.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCopyHelperCode = () => {
    if (latestLogCode) {
      navigator.clipboard?.writeText(latestLogCode);
      setCopiedCode(true);
      const splitDigits = latestLogCode.split('');
      setDigits(splitDigits);
      setTimeout(() => {
        setCopiedCode(false);
        verifyCompleteCode(latestLogCode);
      }, 500);
    }
  };

  if (!isOpen) return null;

  const defaultTitle = purpose === 'PASSWORD_RESET' 
    ? 'Redefinição de Senha' 
    : 'Confirmação de Segurança';
  const defaultSubtitle = purpose === 'PASSWORD_RESET'
    ? 'Insira o código de 6 dígitos enviado para redefinir sua senha'
    : 'Insira o código de 6 dígitos enviado por e-mail para confirmar seu cadastro';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] border-4 border-yellow-400 shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="p-6 bg-yellow-400 text-slate-950 flex items-center justify-between border-b-2 border-slate-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-950 text-yellow-400 flex items-center justify-center shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase italic leading-tight">
                {title || defaultTitle}
              </h3>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-900/80">
                Autenticação em 2 Etapas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-xl bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 flex items-center justify-center transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 mx-auto flex items-center justify-center">
              <Mail size={24} />
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
              {subtitle || defaultSubtitle}:
            </p>
            <p className="text-sm font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 py-1.5 px-3 rounded-xl inline-block max-w-full truncate border border-slate-200 dark:border-zinc-700">
              {email}
            </p>
          </div>

          {/* 6 Digit Input Boxes */}
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  disabled={isVerifying}
                  className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-black rounded-2xl border-2 transition-all outline-none bg-slate-50 dark:bg-zinc-800 text-slate-950 dark:text-white ${
                    digit 
                      ? 'border-yellow-400 ring-2 ring-yellow-400/30' 
                      : 'border-slate-200 dark:border-zinc-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2"
              >
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Success Message */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isVerifying || digits.join('').length !== 6}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Validando Código...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Código</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || isResending}
                  className="font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-wider hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
                  <span>{countdown > 0 ? `Reenviar código em ${countdown}s` : 'Reenviar Novo Código'}</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="font-bold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 uppercase"
                >
                  Voltar
                </button>
              </div>
            </div>
          </form>

          {/* Quick Code Helper Banner (Ensures 100% testability in iframe/local dev) */}
          {latestLogCode && (
            <div className="p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-2xl flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-black text-yellow-800 dark:text-yellow-400 block">
                  Simulação de E-mail / Teste Local:
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                  Código Gerado: <strong>{latestLogCode}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyHelperCode}
                className="px-2.5 py-1.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-[10px] uppercase tracking-wider active:scale-90 transition-all flex items-center gap-1 shrink-0 shadow-xs"
                title="Preencher automaticamente com este código"
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedCode ? 'Preenchido' : 'Preencher'}</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default VerificationCodeModal;
