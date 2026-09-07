
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addMonths } from 'date-fns';
import { User, ThemeMode, UserRole, SystemSettings } from '../types';
import { 
  BusFront, 
  KeyRound, 
  UserCircle, 
  LogIn, 
  AlertCircle, 
  X, 
  Loader2, 
  Eye, 
  EyeOff, 
  Globe, 
  UserPlus, 
  ArrowLeft, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Briefcase, 
  Moon, 
  Sun,
  Fingerprint,
  Smartphone,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { db } from '../services/database';
import { cpfMask } from '../utils/masks';
import { webAuthnService, StoredBiometricCredential } from '../services/webauthn';
import { triggerHaptic } from '../utils/haptic';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onPassengerAccess: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  systemSettings?: SystemSettings | null;
}

const ROLES: { id: UserRole; label: string }[] = [
  { id: 'ADMIN', label: 'Administrador (Full)' },
  { id: 'DRIVER', label: 'Motorista (Operacional)' },
  { id: 'MECHANIC', label: 'Mecânico (Pátio)' },
  { id: 'FISCAL', label: 'Fiscal (Controle)' },
  { id: 'RH', label: 'RH (Colaboradores)' },
  { id: 'TICKET_AGENT', label: 'Agente de Guichê' },
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister, onPassengerAccess, themeMode, setThemeMode, systemSettings }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUnidade, setRegUnidade] = useState(''); 
  const [regLogin, setRegLogin] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regActivationKey, setRegActivationKey] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [storedBiometricCredentials, setStoredBiometricCredentials] = useState<StoredBiometricCredential[]>([]);
  const [promptBiometricRegisterForUser, setPromptBiometricRegisterForUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if device supports WebAuthn / Biometrics
    const checkBiometrics = async () => {
      const supported = await webAuthnService.isAvailable();
      setIsBiometricsSupported(supported);
      if (supported) {
        const creds = webAuthnService.getStoredCredentials();
        setStoredBiometricCredentials(creds);
      }
    };
    checkBiometrics();
  }, []);

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    setErrorModal(null);
    setSuccessInfo(null);
    triggerHaptic('light');

    try {
      const result = await webAuthnService.authenticateWithBiometrics();
      if (result.success && result.user) {
        triggerHaptic('success');
        setSuccessInfo(result.message);
        setTimeout(() => {
          onLogin(result.user!);
        }, 350);
      } else {
        triggerHaptic('warning');
        setErrorModal(result.message);
      }
    } catch (e: any) {
      triggerHaptic('warning');
      setErrorModal(e.message || "Erro na autenticação biométrica.");
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleRegisterBiometricsNow = async () => {
    if (!promptBiometricRegisterForUser) return;
    setIsBiometricLoading(true);
    triggerHaptic('light');

    try {
      const result = await webAuthnService.registerBiometrics(promptBiometricRegisterForUser);
      if (result.success) {
        triggerHaptic('success');
        const userToLog = promptBiometricRegisterForUser;
        setPromptBiometricRegisterForUser(null);
        onLogin(userToLog);
      } else {
        triggerHaptic('warning');
        setErrorModal(result.message);
        // Continue login anyway
        onLogin(promptBiometricRegisterForUser);
      }
    } catch (e: any) {
      triggerHaptic('warning');
      setErrorModal(e.message || "Erro ao registrar biometria.");
      onLogin(promptBiometricRegisterForUser);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginInput.trim();
    if (!cleanInput || !password.trim()) { 
        setErrorModal("Identifique-se para continuar."); 
        return; 
    }
    
    setIsLoading(true);
    setErrorModal(null);
    try {
        const users = await db.getAllUsers();
        const userProfile = users.find(u => 
            (u.login_acesso === cleanInput || u.cpf?.replace(/\D/g, '') === cleanInput.replace(/\D/g, '') || u.email === cleanInput) && 
            u.senha_acesso === password
        );

        if (!userProfile) { 
            setIsLoading(false); 
            triggerHaptic('warning');
            setErrorModal("Credenciais incorretas ou usuário não localizado."); 
            return; 
        }

        // Ensure master admin or lifetime key users have is_full_admin
        const masterEmails = ['consorcio.imperial.ltda@gmail.com', 'suporte@vialivre.com.br'];
        const isMaster = masterEmails.includes(userProfile.email) || userProfile.login_acesso === 'master';
        
        const updatedUser: User = {
            ...userProfile,
            is_full_admin: isMaster || userProfile.is_full_admin || userProfile.activation_key?.includes('VITALICIO') || false
        };

        // If biometric is supported but not yet registered for this user, offer quick registration
        if (isBiometricsSupported && !webAuthnService.hasBiometricsForUser(updatedUser.id)) {
          setPromptBiometricRegisterForUser(updatedUser);
          setIsLoading(false);
          return;
        }

        triggerHaptic('success');
        onLogin(updatedUser);
    } catch (e) {
        console.error(e);
        triggerHaptic('warning');
        setErrorModal("Erro ao acessar servidor.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regEmail || !regLogin || !regPass || !regUnidade || !regActivationKey) {
          setErrorModal("Preencha todos os campos obrigatórios.");
          return;
      }

      const isMasterKey = regActivationKey.trim().toUpperCase() === 'MASTER-2024-TEST-KEY';
      const keyPattern = /^VL-[A-Z0-9]{8}-[A-Z0-9]{4}$/i;
      if (!isMasterKey && !keyPattern.test(regActivationKey.trim())) {
          setErrorModal("A chave de ativação deve estar no padrão VL-00000000-0000 (ex: VL-XXXXXXXX-XXXX)");
          return;
      }

      setIsLoading(true);
      try {
          const keyCode = regActivationKey.trim().toUpperCase();


          // Validate Activation Key
          const keys = await db.getAllActivationKeys();
          const validKey = keys.find(k => k.key_code === keyCode && !k.is_used);

          if (!validKey) {
              setErrorModal("Chave de ativação inválida ou já utilizada.");
              setIsLoading(false);
              return;
          }

          const systemId = validKey.system_id || crypto.randomUUID();
          const newUser: Partial<User> = {
              full_name: regName,
              name: regName.split(' ')[0],
              email: regEmail,
              unidade: regUnidade,
              login_acesso: regLogin.trim(),
              senha_acesso: regPass,
              role: 'ADMIN',
              is_full_admin: validKey.plan_type === 'LIFETIME' || regEmail === 'consorcio.imperial.ltda@gmail.com',
              system_id: systemId,
              job_title: 'Administrador',
              activation_key: regActivationKey
          };

          const data = await db.create('users', newUser);
          if (data) {
            // Initialize System Settings
            await db.create('system_settings', {
                system_id: systemId,
                system_name: 'ViaLivre Gestão',
                company_name: regUnidade,
                registration_pattern: 'FLX-000'
            });

            // Initialize Main Company
            await db.create('companies', {
                system_id: systemId,
                name: regUnidade,
                active: true,
                contact_email: regEmail
            });

            // Initialize Subscription
            let expiresAt = new Date();
            if (validKey.duration_type === 'DAYS' || (validKey.duration_days && validKey.duration_days > 0 && validKey.duration_type !== 'MONTHS')) {
                const durationDays = Number(validKey.duration_days) || 30;
                expiresAt.setDate(expiresAt.getDate() + durationDays);
            } else {
                const durationMonths = Number(validKey.duration_months) || (validKey.plan_type === 'ANNUAL' ? 12 : validKey.plan_type === 'QUARTERLY' ? 3 : validKey.plan_type === 'SEMI_ANNUAL' ? 6 : validKey.plan_type === 'LIFETIME' ? 999 : 1);
                if (durationMonths === 999) {
                    expiresAt = new Date(2099, 11, 31, 23, 59, 59);
                } else {
                    expiresAt = addMonths(expiresAt, durationMonths);
                }
            }

            const expiresAtISO = expiresAt.toISOString();

            await db.create('subscriptions', {
                system_id: systemId,
                plan_type: validKey.plan_type,
                activated_at: new Date().toISOString(),
                expires_at: expiresAtISO,
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            });

            // Update Activation Key
            await db.update('activation_keys', {
                ...validKey,
                is_used: true,
                activated_at: new Date().toISOString(),
                expires_at: expiresAtISO,
                owner_email: regEmail,
                company_name: regUnidade,
                activated_by_system_id: systemId,
                activated_by_user_id: data.id,
                activated_by_name: regName
            });

            db.setSystemId(systemId);
            onRegister(data as User);
          }
          else throw new Error("Erro ao criar conta.");
      } catch (e: any) {
          console.error(e);
          setErrorModal(e.message || "Erro ao criar conta.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-0 md:p-8 relative overflow-hidden transition-colors duration-500 login-screen-vialivre">
      <div className="bg-white dark:bg-zinc-900 w-full h-full md:h-auto md:max-w-5xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-100 dark:border-zinc-800 relative z-10 transition-colors">
        {/* Painel de Identidade Padrão Amarelo Obrigatório */}
        <div className="bg-yellow-400 w-full md:w-[45%] p-8 sm:p-12 text-slate-900 relative flex flex-col justify-between shrink-0 border-r-4 border-slate-900 transition-colors shadow-inner">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
                <div className="logo-sistema p-2.5 bg-white rounded-2xl shadow-xl border-2 border-slate-900 flex items-center justify-center overflow-hidden transition-all">
                  <img 
                    src="https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png" 
                    className="h-10 w-auto object-contain" 
                    alt="ViaLivre Gestão" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <h1 className="text-2xl font-black uppercase italic tracking-tighter transition-colors text-slate-900">
                  {(() => {
                    const sysName = systemSettings?.system_name || 'ViaLivre Gestão';
                    const compName = (systemSettings?.company_name || '').toLowerCase();
                    const lower = sysName.toLowerCase();
                    if (
                      !systemSettings?.system_name ||
                      (compName && lower === compName) ||
                      lower.includes('nicolau') ||
                      lower.includes('viação') ||
                      lower.includes('viacao') ||
                      lower.includes('transportes') ||
                      lower.includes("d'rio") ||
                      lower.includes('consorcio imperial') ||
                      lower.includes('vialivre')
                    ) {
                      return <>Via<span className="text-slate-900 underline decoration-slate-950 decoration-4">Livre</span> Gestão</>;
                    }
                    return sysName;
                  })()}
                </h1>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black leading-tight tracking-tight uppercase italic transition-colors text-slate-900">
              Gestão simplificada e automatizada para sua empresa
            </h2>
          </div>
          <div className="pt-6">
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-900 opacity-60 transition-colors">Infraestrutura ViaLivre Gestão Transportes 2026</p>
          </div>
        </div>

        <div className="flex-1 p-8 sm:p-20 bg-white dark:bg-zinc-950 flex flex-col justify-center transition-colors">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic transition-colors">{isRegisterMode ? 'Novo Acesso' : 'Entrar'}</h3>
            {/* Única personalização permitida: Alternar entre modo claro e modo escuro */}
            <button 
              onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')} 
              className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-2xl transition-all flex items-center gap-2 border border-slate-200 dark:border-zinc-800 shadow-sm"
              title={themeMode === 'light' ? "Alternar para Modo Escuro" : "Alternar para Modo Claro"}
            >
              {themeMode === 'light' ? (
                <>
                  <Moon size={18} className="text-slate-800" />
                  <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Modo Escuro</span>
                </>
              ) : (
                <>
                  <Sun size={18} className="text-yellow-400" />
                  <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Modo Claro</span>
                </>
              )}
            </button>
          </div>

          {!isRegisterMode ? (
            <form id="login-form-main" onSubmit={handleLogin} className="space-y-6">
                <div className="relative">
                    <UserCircle className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={loginInput || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d+$/.test(val.replace(/\D/g, '')) && val.replace(/\D/g, '').length <= 11) {
                          setLoginInput(cpfMask(val));
                        } else {
                          setLoginInput(val);
                        }
                      }} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const passInput = e.currentTarget.closest('form')?.querySelector('input[type="password"]') as HTMLInputElement;
                          if (passInput) passInput.focus();
                        }
                      }}
                      placeholder="E-mail, Usuário ou CPF" 
                      className="w-full pl-14 pr-4 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl focus:border-yellow-400 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all font-bold text-base" 
                    />
                </div>
                <div className="relative">
                    <KeyRound className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700 transition-colors" size={20} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password || ''} 
                      onChange={(e) => setPassword(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && password && loginInput) {
                          handleLogin(e);
                        }
                      }}
                      placeholder="Senha" 
                      className="w-full pl-14 pr-14 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl focus:border-yellow-400 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all font-mono text-base" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-4 text-slate-300 dark:text-zinc-600 hover:text-yellow-600 transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                <button 
                  disabled={isLoading} 
                  type="submit" 
                  className="relative overflow-hidden w-full py-5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl border-2 border-slate-900 flex items-center justify-center gap-3 active:scale-95 leading-none transition-colors"
                >
                    {isLoading ? (
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 rounded-full border-2 border-slate-900/30 border-t-slate-900"
                          />
                          <Sparkles size={10} className="absolute text-slate-900 animate-pulse" />
                        </div>
                        <span className="font-black tracking-widest animate-pulse">AUTENTICANDO ACESSO...</span>
                      </div>
                    ) : (
                      <>
                        <LogIn size={18}/>
                        <span>ENTRAR NO SISTEMA</span>
                      </>
                    )}

                    {/* Shimmer sweep effect when loading */}
                    {isLoading && (
                      <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none skew-x-12"
                      />
                    )}
                </button>

                {/* WebAuthn Biometric Login Button */}
                {isBiometricsSupported && (
                  <div className="pt-2">
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
                      <span className="flex-shrink mx-4 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">ou biometria</span>
                      <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={isBiometricLoading || isLoading}
                      className="relative overflow-hidden w-full py-4 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg border-2 border-slate-900 dark:border-zinc-700 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                      title="Entrar com Biometria (Digital ou Facial)"
                    >
                      {isBiometricLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex items-center justify-center">
                            <motion.div
                              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-5 h-5 rounded-full border border-yellow-400 absolute"
                            />
                            <Fingerprint className="text-yellow-400 animate-pulse" size={18} />
                          </div>
                          <span className="text-yellow-400">Escaneando Biometria...</span>
                        </div>
                      ) : (
                        <>
                          <Fingerprint className="text-yellow-400" size={20} />
                          <span>Entrar com Biometria (Face ID / Digital)</span>
                        </>
                      )}
                    </button>
                    {storedBiometricCredentials.length > 0 && (
                      <p className="text-center text-[9px] font-bold text-slate-400 dark:text-zinc-500 mt-2">
                        {storedBiometricCredentials.length} credencial(is) biométrica(s) salva(s) neste dispositivo
                      </p>
                    )}
                  </div>
                )}
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
                <div className="relative">
                    <KeyRound className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700" size={20} />
                    <input 
                      required 
                      placeholder="CHAVE DE ATIVAÇÃO (VL-00000000-0000)" 
                      value={regActivationKey || ''} 
                      onChange={e => setRegActivationKey(e.target.value.toUpperCase().substring(0, 20))} 
                      className="w-full pl-14 pr-4 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all text-[1.2rem]" 
                    />
                </div>
                <input required placeholder="Nome Completo" value={regName || ''} onChange={e => setRegName(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                <input required type="email" placeholder="E-mail" value={regEmail || ''} onChange={e => setRegEmail(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                
                <input required placeholder="Unidade / Empresa" value={regUnidade || ''} onChange={e => setRegUnidade(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Login" value={regLogin || ''} onChange={e => setRegLogin(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none transition-colors" />
                    <div className="relative">
                        <input required type={showRegPassword ? "text" : "password"} placeholder="Senha" value={regPass || ''} onChange={e => setRegPass(e.target.value)} className="w-full px-5 pr-12 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none transition-colors" />
                        <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-4 top-4 text-slate-300 dark:text-zinc-600 hover:text-yellow-600 transition-colors">
                            {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button disabled={isLoading || !regActivationKey.trim()} type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all transition-colors disabled:opacity-50">
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <UserPlus size={18}/>}
                    CRIAR ACESSO
                </button>
                <button onClick={() => setIsRegisterMode(false)} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-colors">Voltar para Login</button>
            </form>
          )}

          {successInfo && (
              <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 transition-colors">
                  <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors">{successInfo}</p>
                  <button onClick={() => setSuccessInfo(null)} className="ml-auto text-emerald-400"><X size={16}/></button>
              </div>
          )}

          {errorModal && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 transition-colors">
                  <AlertCircle className="text-red-500 shrink-0" size={20} />
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 transition-colors">{errorModal}</p>
                  <button onClick={() => setErrorModal(null)} className="ml-auto text-red-400"><X size={16}/></button>
              </div>
          )}

          <div className="mt-12 grid grid-cols-2 gap-4 transition-colors">
            <button onClick={onPassengerAccess} className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 hover:text-yellow-600 transition-colors"><Globe size={14}/> Passageiro</button>
            {!isRegisterMode && (
                <button onClick={() => setIsRegisterMode(true)} className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 hover:text-blue-600 transition-all transition-colors"><ShieldCheck size={14}/> Criar Conta</button>
            )}
          </div>
        </div>
      </div>

      {/* Biometric Activation Prompt Modal */}
      {promptBiometricRegisterForUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 max-w-md w-full border border-slate-100 dark:border-zinc-800 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-yellow-400 rounded-3xl flex items-center justify-center mx-auto shadow-lg text-slate-950">
              <Fingerprint size={32} />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">
                Ativar Acesso Biométrico?
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mt-2">
                Deseja habilitar login rápido por Face ID ou Impressão Digital para o usuário <span className="text-slate-900 dark:text-white font-black">{promptBiometricRegisterForUser.name}</span> neste dispositivo?
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl text-[11px] text-slate-600 dark:text-zinc-400 font-bold border border-slate-100 dark:border-zinc-700/50 flex items-center gap-3 text-left">
              <Smartphone size={24} className="text-yellow-500 shrink-0" />
              <span>Acesso seguro com criptografia nativa WebAuthn sem necessidade de digitar senha novamente.</span>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRegisterBiometricsNow}
                disabled={isBiometricLoading}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg border-2 border-slate-900 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isBiometricLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Registrando Biometria...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint size={16} />
                    <span>Sim, Ativar Biometria</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  const userToLog = promptBiometricRegisterForUser;
                  setPromptBiometricRegisterForUser(null);
                  onLogin(userToLog);
                }}
                disabled={isBiometricLoading}
                className="w-full py-3 bg-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Agora não, continuar login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
