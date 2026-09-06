
import React, { useState, useMemo, useEffect, useRef, Component, ErrorInfo } from 'react';
import { BusRoute, Trip, Company, Notice, Vehicle, ImpCard, ImpCardPaymentMethod, ImpCardRecharge, PushSubscription, City, SystemSettings } from '../types';
import { Clock, Search, X, Bus, MapPin, Bell, ShoppingCart, Loader2, Megaphone, SmartphoneNfc, Moon, Sun, Users, Ticket, Share2, ArrowRight, CreditCard, DollarSign, Briefcase, Palette, Check, Layers, Star, AlertTriangle, RefreshCw } from 'lucide-react';
import { cpfMask, cepMask, phoneMask } from '../utils/masks';
import { fetchAddress } from '../services/cep';
import TicketAgentInterface from './TicketAgentInterface';
import JobApplicationForm from './JobApplicationForm';
import { db, supabase } from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import TransportCard from './TransportCard';
import { PRESET_THEME_COLORS, resolveThemeColors, isValidHexColor } from '../utils/themeHelper';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { NotificationService } from '../services/NotificationService';
import { safeLocalStorage, sanitizeCardForSession } from '../utils/storage';

interface PassengerInterfaceProps {
  routes: BusRoute[];
  trips: Trip[];
  companies: Company[];
  cities: City[];
  notices?: Notice[];
  vehicles?: Vehicle[];
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onExit: () => void;
  onOpenTicketing: (tripId?: string, passengerData?: any, routeId?: string) => void;
  systemSettings?: SystemSettings | null;
  onUpdateSettings?: (settings: any) => void;
  themeMode?: string;
  onChangeThemeMode?: (theme: any) => void;
}

// Defensive Error Boundary for Passenger Portal
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onExit?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PassengerErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PassengerInterface render crash caught by boundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    try {
      window.location.reload();
    } catch {}
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-amber-500/20 text-yellow-400 rounded-3xl flex items-center justify-center mb-6 border border-yellow-400/40 animate-pulse shadow-2xl">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-black uppercase italic mb-2 tracking-tight">Recuperação de Interface</h2>
          <p className="text-xs text-slate-400 max-w-md uppercase font-semibold mb-6 leading-relaxed">
            Ocorreu uma instabilidade temporária ao carregar dados do portal de passageiros. Não se preocupe, seus dados estão seguros.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="px-6 py-3.5 bg-yellow-400 text-slate-950 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-xl hover:bg-yellow-300 active:scale-95 transition-all"
            >
              <RefreshCw size={16} /> Recarregar Portal
            </button>
            {this.props.onExit && (
              <button
                onClick={this.props.onExit}
                className="px-6 py-3.5 bg-slate-800 text-slate-300 rounded-2xl font-black text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all"
              >
                Voltar ao Início
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const PassengerInterfaceContent: React.FC<PassengerInterfaceProps> = ({ 
  routes = [], 
  trips = [], 
  companies = [], 
  cities = [], 
  notices = [], 
  vehicles = [], 
  addToast, 
  onExit, 
  onOpenTicketing,
  systemSettings,
  onUpdateSettings,
  themeMode,
  onChangeThemeMode
}) => {
  const [localTrips, setLocalTrips] = useState<Trip[]>(trips || []);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // Keep localTrips synchronized with incoming props and real-time database updates
  useEffect(() => {
    if (Array.isArray(trips)) {
      setLocalTrips(trips);
    }
  }, [trips]);

  useEffect(() => {
    let isMounted = true;

    const syncTrips = async () => {
      try {
        const latest = await db.getTrips();
        if (Array.isArray(latest) && isMounted) {
          setLocalTrips(latest);
          setDataLoadError(null);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar viagens do passageiro:', err);
      }
    };

    syncTrips();
    const interval = setInterval(syncTrips, 5000);

    let channel: any = null;
    try {
      if (supabase) {
        channel = supabase
          .channel('passenger-trips-sync-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload: any) => {
            if (!isMounted) return;
            try {
              if (payload?.eventType === 'INSERT') {
                const newTrip = payload.new as Trip;
                if (newTrip?.id) {
                  setLocalTrips(prev => {
                    const safePrev = Array.isArray(prev) ? prev : [];
                    const exists = safePrev.some(t => t?.id === newTrip.id);
                    return exists ? safePrev.map(t => t?.id === newTrip.id ? newTrip : t) : [newTrip, ...safePrev];
                  });
                }
              } else if (payload?.eventType === 'UPDATE') {
                const updatedTrip = payload.new as Trip;
                if (updatedTrip?.id) {
                  setLocalTrips(prev => {
                    const safePrev = Array.isArray(prev) ? prev : [];
                    return safePrev.map(t => t?.id === updatedTrip.id ? updatedTrip : t);
                  });
                }
              } else if (payload?.eventType === 'DELETE') {
                const deletedId = payload?.old?.id;
                if (deletedId) {
                  setLocalTrips(prev => {
                    const safePrev = Array.isArray(prev) ? prev : [];
                    return safePrev.filter(t => t?.id !== deletedId);
                  });
                }
              }
            } catch (innerErr) {
              console.warn('Erro ao processar alteração em tempo real:', innerErr);
            }
          })
          .subscribe();
      }
    } catch (subErr) {
      console.warn('Erro ao inscrever no canal em tempo real do Supabase:', subErr);
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'routes' | 'notices' | 'recharge' | 'work-with-us'>('routes');
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => safeLocalStorage.getItem('passenger_push_optin') === 'true');
  const [pushAlert, setPushAlert] = useState<Notice | null>(null);
  const [showThemePopup, setShowThemePopup] = useState(false);

  // Recharge state
  const [rechargeQuery, setRechargeQuery] = useState('');
  const [rechargeCard, setRechargeCard] = useState<ImpCard | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>('0,00');
  const [rechargePaymentMethod, setRechargePaymentMethod] = useState<ImpCardPaymentMethod>('PIX');
  const [isRecharging, setIsRecharging] = useState(false);

  // Independent Sessions: Vale Transporte (Card) vs Passageiro (Ticket Buyer)
  const [loggedInCard, setLoggedInCard] = useState<ImpCard | null>(() => {
    try {
      const saved = safeLocalStorage.getItem('fluxo_vt_card_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [loggedInBuyer, setLoggedInBuyer] = useState<ImpCard | null>(() => {
    try {
      const saved = safeLocalStorage.getItem('fluxo_passenger_buyer_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Real-time synchronization of Vale Transporte card balance based on registered CPF
  const syncCardWithDatabase = async () => {
    try {
      const cards = await db.getImpCards();
      if (!cards || cards.length === 0) return;

      const activeCpf = (loggedInCard?.cpf || loggedInBuyer?.cpf || '').replace(/\D/g, '');
      const activeCardId = loggedInCard?.id;
      const activeCardNumber = (loggedInCard?.card_number || '').replace(/\D/g, '');

      // 1. Synchronize Vale Transporte card (prefer non-passenger_buyer card of type Vale Transporte)
      if (activeCpf || activeCardId || activeCardNumber) {
        let matchingCard: ImpCard | undefined;
        
        if (activeCpf) {
          // Find standard physical/digital VT card matching CPF
          matchingCard = cards.find(c => (c.cpf || '').replace(/\D/g, '') === activeCpf && !c.is_passenger_buyer) ||
                         cards.find(c => (c.cpf || '').replace(/\D/g, '') === activeCpf);
        }
        
        if (!matchingCard && (activeCardId || activeCardNumber)) {
          matchingCard = cards.find(c => c.id === activeCardId || (c.card_number || '').replace(/\D/g, '') === activeCardNumber);
        }

        if (matchingCard) {
          const sanitized = sanitizeCardForSession(matchingCard);
          if (sanitized) {
            setLoggedInCard(prev => {
              if (!prev || prev.balance !== sanitized.balance || prev.id !== sanitized.id) {
                safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitized));
                return sanitized as ImpCard;
              }
              return prev;
            });
          }
        }
      }

      // 2. Synchronize loggedInBuyer if exists
      if (loggedInBuyer) {
        const cleanBuyerCpf = (loggedInBuyer.cpf || '').replace(/\D/g, '');
        const matchingBuyer = cards.find(c => (c.cpf || '').replace(/\D/g, '') === cleanBuyerCpf && c.is_passenger_buyer) ||
                              cards.find(c => c.id === loggedInBuyer.id);
        if (matchingBuyer) {
          const sanitizedBuyer = sanitizeCardForSession(matchingBuyer);
          if (sanitizedBuyer) {
            setLoggedInBuyer(prev => {
              if (!prev || JSON.stringify(prev) !== JSON.stringify(sanitizedBuyer)) {
                safeLocalStorage.setItem('fluxo_passenger_buyer_session', JSON.stringify(sanitizedBuyer));
                return sanitizedBuyer as ImpCard;
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar saldo do cartão VT:', err);
    }
  };

  useEffect(() => {
    // Initial sync
    syncCardWithDatabase();

    // Listen for custom app events
    const handleCustomSync = () => syncCardWithDatabase();
    window.addEventListener('vialivre-refresh-data', handleCustomSync);
    window.addEventListener('vialivre-vt-card-updated', handleCustomSync);
    window.addEventListener('focus', handleCustomSync);

    // Periodic polling sync every 3.5 seconds
    const interval = setInterval(syncCardWithDatabase, 3500);

    // Realtime Supabase subscription on imp_cards table
    let channel: any = null;
    if (supabase) {
      try {
        channel = supabase
          .channel('public:imp_cards_passenger_sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'imp_cards' }, () => {
            syncCardWithDatabase();
          })
          .subscribe();
      } catch (e) {
        // Fallback to polling interval
      }
    }

    return () => {
      window.removeEventListener('vialivre-refresh-data', handleCustomSync);
      window.removeEventListener('vialivre-vt-card-updated', handleCustomSync);
      window.removeEventListener('focus', handleCustomSync);
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [loggedInCard?.cpf, loggedInCard?.id, loggedInBuyer?.cpf, loggedInBuyer?.id]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  
  const [authModalTab, setAuthModalTab] = useState<'PASSENGER' | 'CARD'>('PASSENGER');
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loginContext, setLoginContext] = useState<'GENERAL' | 'PURCHASE'>('GENERAL');
  
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegisteringPassword, setIsRegisteringPassword] = useState(false);
  const [pendingCardForPassword, setPendingCardForPassword] = useState<ImpCard | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Lock background scrolling when any modal/popup is open
  useBodyScrollLock(Boolean(showThemePopup || showAuthModal || showCardModal || showBuyerModal || pushAlert));
  
  const [registrationForm, setRegistrationForm] = useState<Partial<ImpCard>>({
    name: '',
    surname: '',
    cpf: '',
    rg: '',
    birth_date: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    phone: '',
    email: '',
    type: 'Vale Transporte',
    password: '',
    balance: 0,
    responsible_name: '',
    responsible_birth_date: '',
    relationship: ''
  });

  const handleRegisterPassenger = async () => {
    if (!registrationForm.cpf || !registrationForm.name || !registrationForm.password) {
        addToast("CPF, Nome e Senha são obrigatórios.", "warning");
        return;
    }
    
    setIsRecharging(true);
    try {
        const { id, ...cleanRegistrationForm } = registrationForm as any;
        const cleanRegCpf = (cleanRegistrationForm.cpf || '').replace(/\D/g, '');

        if (authModalTab === 'PASSENGER') {
            // Register a permanent purchase/passenger buyer (always generate new record)
            const newPassenger = await db.create<ImpCard>('imp_cards', {
                ...cleanRegistrationForm,
                card_number: 'PASS-' + Math.floor(100000 + Math.random() * 900000).toString(),
                type: 'Especial',
                is_passenger_buyer: true,
                balance: 0,
                created_at: new Date().toISOString()
            } as any);

            const sanitizedPassenger = sanitizeCardForSession(newPassenger);
            addToast("Cadastro de Passageiro realizado! Sua conta de compras está pronta.", "success");
            setLoggedInBuyer(sanitizedPassenger as ImpCard);
            safeLocalStorage.setItem('fluxo_passenger_buyer_session', JSON.stringify(sanitizedPassenger));
            setShowAuthModal(false);
            
            // If we are purchasing, pass it to selected route details
            if (loginContext === 'PURCHASE') {
              onOpenTicketing(undefined, sanitizedPassenger, selectedRouteDetails?.id);
            }
            return;
        } else {
            // Register a traditional transport card account (always generate new record)
            const cardNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
            const newCard = await db.create<ImpCard>('imp_cards', {
                ...cleanRegistrationForm,
                card_number: cardNumber,
                is_passenger_buyer: false,
                created_at: new Date().toISOString()
            } as ImpCard);

            const sanitizedCard = sanitizeCardForSession(newCard);
            addToast(`Vale Transporte cadastrado! Número do Cartão: ${cardNumber}`, "success");
            setLoggedInCard(sanitizedCard as ImpCard);
            safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitizedCard));
            setShowAuthModal(false);
            return;
        }
    } catch (error) {
        addToast("Erro ao realizar cadastro.", "error");
    } finally {
        setIsRecharging(false);
    }
  };

  const [hiddenNotices, setHiddenNotices] = useState<Set<string>>(() => {
      const saved = safeLocalStorage.getItem('passenger_hidden_notices');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [readNotices, setReadNotices] = useState<Set<string>>(() => {
      const saved = safeLocalStorage.getItem('passenger_read_notices');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [selectedRouteDetails, setSelectedRouteDetails] = useState<BusRoute | null>(null);
  const [detailDirection, setDetailDirection] = useState<'IDA' | 'VOLTA'>('IDA');
  const [scheduleDate, setScheduleDate] = useState<string>(getTodayDateStr);

  // Favorite Routes State
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<Set<string>>(() => {
    try {
      const saved = safeLocalStorage.getItem('passenger_favorite_routes');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const toggleFavoriteRoute = (routeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteRouteIds(prev => {
      const next = new Set(prev);
      const isFav = next.has(routeId);
      if (isFav) {
        next.delete(routeId);
        addToast("Rota removida dos favoritos.", "info");
      } else {
        next.add(routeId);
        addToast("Rota favoritada! Você receberá notificações de qualquer alteração.", "success");
      }
      safeLocalStorage.setItem('passenger_favorite_routes', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Track changes on favorite routes and notify passenger
  const prevRoutesRef = useRef<BusRoute[]>(routes);
  useEffect(() => {
    if (prevRoutesRef.current && prevRoutesRef.current.length > 0 && favoriteRouteIds.size > 0) {
      const prevMap = new Map<string, BusRoute>(prevRoutesRef.current.map(r => [r.id, r]));
      routes.forEach(currentRoute => {
        if (favoriteRouteIds.has(currentRoute.id)) {
          const prev = prevMap.get(currentRoute.id);
          if (prev) {
            const priceChanged = prev.price !== currentRoute.price;
            const originChanged = prev.origin !== currentRoute.origin || prev.destination !== currentRoute.destination;
            const scheduleChanged = JSON.stringify(prev.schedule) !== JSON.stringify(currentRoute.schedule);
            
            if (priceChanged || originChanged || scheduleChanged) {
              const msg = `Aviso: A rota favoritada ${currentRoute.prefixo_linha} (${currentRoute.origin} x ${currentRoute.destination}) teve seus dados/horários atualizados!`;
              addToast(msg, "warning");
              NotificationService.sendLocalNotification(`Atualização na Linha ${currentRoute.prefixo_linha}`, {
                body: msg,
                icon: '/icon-192.png'
              });
            }
          }
        }
      });
    }
    prevRoutesRef.current = routes;
  }, [routes, favoriteRouteIds]);

  // New Filters for Passenger
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [cepSearch, setCepSearch] = useState<string>('');
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepCity, setCepCity] = useState<string>('');

  const handleCepSearch = async () => {
    if (cepSearch.replace(/\D/g, '').length !== 8) {
      addToast("CEP inválido. Digite 8 números.", "warning");
      return;
    }

    setIsCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepSearch.replace(/\D/g, '')}/json/`);
      const data = await response.json();
      if (data.erro) {
        addToast("CEP não encontrado.", "error");
        setCepCity('');
      } else {
        setCepCity(data.localidade);
        addToast(`Buscando rotas em ${data.localidade} e região (raio 10km)...`, "success");
      }
    } catch (error) {
      addToast("Erro ao consultar CEP.", "error");
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleRegistrationCepSearch = async (cep: string) => {
    const maskedCep = cepMask(cep);
    setRegistrationForm(prev => ({ ...prev, cep: maskedCep }));
    const cleanCep = maskedCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsCepLoading(true);
      try {
        const data = await fetchAddress(cleanCep);
        if (data) {
          setRegistrationForm(prev => ({
            ...prev,
            address_street: (data.addressStreet || '').toUpperCase(),
            address_neighborhood: (data.addressNeighborhood || '').toUpperCase(),
            address_city: (data.addressCity || '').toUpperCase(),
            address_state: (data.addressState || '').toUpperCase()
          }));
        }
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const handleRegistrationCpfChange = async (rawCpf: string) => {
    const masked = cpfMask(rawCpf);
    const cleanCpf = rawCpf.replace(/\D/g, '');
    setRegistrationForm(prev => ({ ...prev, cpf: masked }));

    if (cleanCpf.length === 11) {
      try {
        const [cards, sales, users] = await Promise.all([
          db.getImpCards().catch(() => []),
          db.getSales().catch(() => []),
          db.getUsers().catch(() => [])
        ]);

        // 1. Check if there is an existing card / passenger registration in imp_cards
        const foundCard = (cards || []).find(c => (c.cpf || '').replace(/\D/g, '') === cleanCpf);
        if (foundCard) {
          setRegistrationForm(prev => ({
            ...prev,
            name: foundCard.name || prev.name || '',
            surname: foundCard.surname || prev.surname || '',
            rg: foundCard.rg || prev.rg || '',
            birth_date: foundCard.birth_date || prev.birth_date || '',
            phone: foundCard.phone ? phoneMask(foundCard.phone) : prev.phone || '',
            email: foundCard.email || prev.email || '',
            cep: foundCard.cep ? cepMask(foundCard.cep) : prev.cep || '',
            address_street: foundCard.address_street || prev.address_street || '',
            address_number: foundCard.address_number || prev.address_number || '',
            address_complement: foundCard.address_complement || prev.address_complement || '',
            address_neighborhood: foundCard.address_neighborhood || prev.address_neighborhood || '',
            address_city: foundCard.address_city || prev.address_city || '',
            address_state: foundCard.address_state || prev.address_state || '',
            responsible_name: foundCard.responsible_name || foundCard.guardian_name || prev.responsible_name || '',
            responsible_birth_date: foundCard.responsible_birth_date || prev.responsible_birth_date || '',
            relationship: foundCard.relationship || prev.relationship || ''
          }));
          addToast("Cadastro localizado pelo CPF! Dados preenchidos automaticamente.", "success");
          return;
        }

        // 2. Check in sales history
        const sortedSales = [...(sales || [])].sort((a, b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        const previousSale = sortedSales.find(s => (s.passenger_cpf || '').replace(/\D/g, '') === cleanCpf);
        if (previousSale) {
          const parts = (previousSale.passenger_name || '').trim().split(' ');
          const fName = parts[0] || '';
          const lName = parts.slice(1).join(' ') || '';
          setRegistrationForm(prev => ({
            ...prev,
            name: fName || prev.name || '',
            surname: lName || prev.surname || '',
            birth_date: previousSale.passenger_birth || prev.birth_date || '',
            phone: previousSale.passenger_phone ? phoneMask(previousSale.passenger_phone) : prev.phone || '',
            email: previousSale.passenger_email || prev.email || '',
            cep: previousSale.address_cep ? cepMask(previousSale.address_cep) : prev.cep || '',
            address_street: previousSale.address_street || prev.address_street || '',
            address_number: previousSale.address_number || prev.address_number || '',
            address_complement: previousSale.address_complement || prev.address_complement || '',
            address_neighborhood: previousSale.address_neighborhood || prev.address_neighborhood || '',
            address_city: previousSale.address_city || prev.address_city || '',
            address_state: previousSale.address_state || prev.address_state || '',
            responsible_name: previousSale.responsible_name || prev.responsible_name || '',
            responsible_birth_date: previousSale.responsible_birth || prev.responsible_birth_date || '',
            relationship: previousSale.relationship || prev.relationship || ''
          }));
          addToast("Dados de passagens anteriores recuperados pelo CPF!", "success");
          return;
        }

        // 3. Check in users
        const foundUser = (users || []).find(u => (u.cpf || '').replace(/\D/g, '') === cleanCpf);
        if (foundUser) {
          const parts = (foundUser.full_name || '').trim().split(' ');
          const fName = parts[0] || '';
          const lName = parts.slice(1).join(' ') || '';
          setRegistrationForm(prev => ({
            ...prev,
            name: fName || prev.name || '',
            surname: lName || prev.surname || '',
            phone: foundUser.phone ? phoneMask(foundUser.phone) : prev.phone || '',
            email: foundUser.email || prev.email || ''
          }));
          addToast("Dados de usuário localizados pelo CPF!", "success");
        }
      } catch (err) {
        console.error("Erro na busca de CPF no cadastro:", err);
      }
    }
  };

  // Auto-sync Vale Transporte data when entering the 'recharge' tab or if loggedInCard/loggedInBuyer changes
  useEffect(() => {
    if (activeTab === 'recharge') {
      const targetCpf = (loggedInCard?.cpf || loggedInBuyer?.cpf || rechargeQuery || '').replace(/\D/g, '');
      if (targetCpf && (targetCpf.length === 11 || targetCpf.length === 8)) {
        db.getImpCards().then(cards => {
          const found = (cards || []).find(c => {
            const cleanCpf = (c.cpf || '').replace(/\D/g, '');
            const cleanCard = (c.card_number || '').replace(/\D/g, '');
            return (cleanCpf === targetCpf || cleanCard === targetCpf);
          });
          if (found) {
            const sanitizedFound = sanitizeCardForSession(found) as ImpCard;
            setRechargeCard(sanitizedFound);
            if (loggedInCard && loggedInCard.id === found.id) {
              setLoggedInCard(sanitizedFound);
              safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitizedFound));
            }
          }
        }).catch(err => console.warn('Erro ao sincronizar saldo do cartão:', err));
      }
    }
  }, [activeTab, loggedInCard?.id, loggedInCard?.cpf, loggedInBuyer?.cpf]);

  const markAsRead = (id: string) => {
      const newRead = new Set(readNotices);
      newRead.add(id);
      setReadNotices(newRead);
      safeLocalStorage.setItem('passenger_read_notices', JSON.stringify(Array.from(newRead)));
  };

  const lastNoticesCount = useRef(notices.length);

  useEffect(() => {
    const handleTabChange = (e: any) => {
        if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('change-tab', handleTabChange);
    return () => window.removeEventListener('change-tab', handleTabChange);
  }, []);

  useEffect(() => {
      if (notificationsEnabled && notices.length > lastNoticesCount.current) {
          const newNotice = notices[notices.length - 1];
          if (!hiddenNotices.has(newNotice.id)) {
            setTimeout(() => setPushAlert(newNotice), 0);
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
            NotificationService.sendLocalNotification(newNotice.title || 'Novo Comunicado', {
              body: newNotice.content || 'Há um novo comunicado ou alerta disponível no mural.',
              icon: '/icon-192.png'
            });
            setTimeout(() => setPushAlert(null), 8000);
          }
      }
      lastNoticesCount.current = notices.length;
  }, [notices, notificationsEnabled, hiddenNotices]);

  const toggleNotifications = async () => {
      const newVal = !notificationsEnabled;
      setNotificationsEnabled(newVal);
      safeLocalStorage.setItem('passenger_push_optin', String(newVal));

      if (newVal) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await db.create<PushSubscription>('push_subscriptions', {
              endpoint: 'https://fcm.googleapis.com/demo-endpoint',
              p256dh: 'demo-p256dh',
              auth: 'demo-auth',
              role: 'PASSENGER',
              created_at: new Date().toISOString()
            });
            addToast("Notificações nativas ativadas!", "success");
          }
        } catch (error) {
          console.error("Error requesting notification permission:", error);
        }
      }
  };

  const toggleTheme = () => {
      const isDark = document.documentElement.classList.toggle('dark');
      setIsDarkMode(isDark);
      safeLocalStorage.setItem('fluxo_theme', isDark ? 'dark' : 'light');
  };

  const handleRechargeSearch = async () => {
    if (!rechargeQuery) return;
    const cleanQuery = rechargeQuery.replace(/\D/g, '');
    const isNumeric = /^\d+$/.test(cleanQuery);
    if (isNumeric && cleanQuery.length > 0 && cleanQuery.length < 11) {
      addToast("CPF deve ter 11 dígitos para consulta.", "warning");
      return;
    }
    try {
      const cards = await db.getImpCards();
      const found = cards.find(c => {
        const cleanCpf = (c.cpf || '').replace(/\D/g, '');
        const cleanCard = (c.card_number || '').replace(/\D/g, '');
        if (cleanQuery && (cleanCpf === cleanQuery || cleanCard === cleanQuery)) {
          return true;
        }
        return `${c.name} ${c.surname}`.toLowerCase().includes(rechargeQuery.toLowerCase());
      });
      if (found) {
        setRechargeCard(found);
      } else {
        addToast("Cartão não encontrado.", "error");
        setRechargeCard(null);
      }
    } catch (error) {
      addToast("Erro ao buscar cartão.", "error");
    }
  };

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount.replace(/\./g, '').replace(',', '.'));
    if (!rechargeCard || amount <= 0) return;
    setIsRecharging(true);
    try {
      const newBalance = (Number(rechargeCard.balance) || 0) + amount;
      const updatedCard = { ...rechargeCard, balance: newBalance };
      await db.update('imp_cards', updatedCard);
      await db.create<ImpCardRecharge>('imp_card_recharges', {
        card_id: rechargeCard.id,
        amount: amount,
        payment_method: rechargePaymentMethod,
        created_at: new Date().toISOString()
      });

      // Synchronize immediately if matching logged-in user
      const cleanRechargeCpf = (rechargeCard.cpf || '').replace(/\D/g, '');
      const cleanActiveCpf = (loggedInCard?.cpf || loggedInBuyer?.cpf || '').replace(/\D/g, '');
      if (cleanRechargeCpf && cleanRechargeCpf === cleanActiveCpf) {
        const sanitized = sanitizeCardForSession(updatedCard) as ImpCard;
        setLoggedInCard(sanitized);
        safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitized));
      }

      window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      await syncCardWithDatabase();

      addToast(`Recarga de R$ ${amount.toFixed(2)} via ${rechargePaymentMethod} realizada com sucesso!`);
      setRechargeCard(null);
      setRechargeAmount('0,00');
      setRechargeQuery('');
    } catch (error) {
      addToast("Erro ao realizar recarga.", "error");
    } finally {
      setIsRecharging(false);
    }
  };

  const handleAuthLogin = async () => {
    if (!loginIdentifier) {
      addToast("Informe seu CPF, Cartão ou E-mail.", "warning");
      return;
    }
    const cleanIdentifier = loginIdentifier.replace(/\D/g, '');
    if (/^\d+$/.test(cleanIdentifier) && cleanIdentifier.length > 0 && cleanIdentifier.length < 11 && cleanIdentifier.length !== 8) {
      addToast("CPF deve ter 11 dígitos ou Cartão 8 dígitos.", "warning");
      return;
    }
    try {
      const cards = await db.getImpCards();
      const found = cards.find(c => {
        const cleanCpf = (c.cpf || '').replace(/\D/g, '');
        const cleanCard = (c.card_number || '').replace(/\D/g, '');
        
        // Scope search depending on authModalTab
        const isTargetType = authModalTab === 'PASSENGER' ? c.is_passenger_buyer === true : !c.is_passenger_buyer;
        if (!isTargetType) return false;

        const matchesInput = (cleanIdentifier && (cleanCpf === cleanIdentifier || cleanCard === cleanIdentifier)) ||
                             c.cpf === loginIdentifier || c.card_number === loginIdentifier ||
                             (c.email && c.email.toLowerCase() === loginIdentifier.toLowerCase().trim());
        
        return matchesInput;
      });

      if (!found) {
        addToast(`Nenhum cadastro de ${authModalTab === 'PASSENGER' ? 'Passageiro Comprador' : 'Vale Transporte'} encontrado para este documento.`, "error");
        return;
      }

      if (!found.password) {
        setPendingCardForPassword(found);
        setIsRegisteringPassword(true);
      } else {
        if (found.password === loginPassword) {
          if (authModalTab === 'PASSENGER') {
            const sanitizedBuyer = sanitizeCardForSession(found) as ImpCard;
            setLoggedInBuyer(sanitizedBuyer);
            safeLocalStorage.setItem('fluxo_passenger_buyer_session', JSON.stringify(sanitizedBuyer));
            
            // Check if there is also a matching Vale Transporte card for this CPF
            const cleanCpf = (found.cpf || '').replace(/\D/g, '');
            if (cleanCpf) {
              const matchingVt = cards.find(c => (c.cpf || '').replace(/\D/g, '') === cleanCpf && !c.is_passenger_buyer);
              if (matchingVt) {
                const sanitizedVt = sanitizeCardForSession(matchingVt) as ImpCard;
                setLoggedInCard(sanitizedVt);
                safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitizedVt));
              }
            }

            setShowAuthModal(false);
            addToast(`Bem-vindo(a), ${found.name}! Conta de compras conectada.`, "success");
            if (loginContext === 'PURCHASE') {
              onOpenTicketing(undefined, sanitizedBuyer, selectedRouteDetails?.id);
            }
          } else {
            const sanitizedCard = sanitizeCardForSession(found) as ImpCard;
            setLoggedInCard(sanitizedCard);
            safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitizedCard));
            setShowAuthModal(false);
            addToast(`Vale Transporte conectado! Saldo: R$ ${Number(found.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "success");
          }
          window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
        } else {
          addToast("Senha incorreta.", "error");
        }
      }
    } catch (error) {
      addToast("Erro no login.", "error");
    }
  };

  const handleRegisterPassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      addToast("As senhas não coincidem.", "error");
      return;
    }
    if (!pendingCardForPassword) return;
    try {
      const updatedCard = { ...pendingCardForPassword, password: newPassword };
      await db.update('imp_cards', updatedCard);
      
      if (pendingCardForPassword.is_passenger_buyer) {
        const sanitizedBuyer = sanitizeCardForSession(updatedCard) as ImpCard;
        setLoggedInBuyer(sanitizedBuyer);
        safeLocalStorage.setItem('fluxo_passenger_buyer_session', JSON.stringify(sanitizedBuyer));
        setShowAuthModal(false);
        setIsRegisteringPassword(false);
        setPendingCardForPassword(null);
        addToast("Senha cadastrada com sucesso! Conta de compras conectada.");
        if (loginContext === 'PURCHASE') {
          onOpenTicketing(undefined, sanitizedBuyer, selectedRouteDetails?.id);
        }
      } else {
        const sanitizedCard = sanitizeCardForSession(updatedCard) as ImpCard;
        setLoggedInCard(sanitizedCard);
        safeLocalStorage.setItem('fluxo_vt_card_session', JSON.stringify(sanitizedCard));
        setShowAuthModal(false);
        setIsRegisteringPassword(false);
        setPendingCardForPassword(null);
        addToast("Senha cadastrada com sucesso! Vale Transporte conectado.");
      }
      window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
      await syncCardWithDatabase();
    } catch (error) {
      addToast("Erro ao cadastrar senha.", "error");
    }
  };

  const handleLogoutCard = () => {
    setLoggedInCard(null);
    safeLocalStorage.removeItem('fluxo_vt_card_session');
    setShowCardModal(false);
    addToast("Você saiu da conta de Vale Transporte.", "info");
  };

  const handleLogoutBuyer = () => {
    setLoggedInBuyer(null);
    safeLocalStorage.removeItem('fluxo_passenger_buyer_session');
    setShowBuyerModal(false);
    addToast("Você saiu da conta de Compra de Passagens.", "info");
  };

  const formatCurrencyRTL = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = parseInt(cleanValue || '0') / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleBuyClick = (tripId?: string, routeId?: string) => {
    if (!loggedInBuyer) {
        setLoginContext('PURCHASE');
        setAuthModalTab('PASSENGER');
        setAuthModalMode('LOGIN');
        setShowAuthModal(true);
        addToast("Para comprar passagens, faça login com sua conta de Passageiro ou cadastre-se (o login do Cartão é independente).", "info");
    } else {
        onOpenTicketing(tripId, loggedInBuyer || undefined, routeId);
    }
  };

  const currentSchedules = useMemo(() => {
    if (!selectedRouteDetails) return [];
    try {
      const dateParts = (scheduleDate || '').split('-');
      const year = Number(dateParts[0]) || new Date().getFullYear();
      const month = (Number(dateParts[1]) || (new Date().getMonth() + 1)) - 1;
      const dayNum = Number(dateParts[2]) || new Date().getDate();
      const dateObj = new Date(year, month, dayNum, 12, 0, 0);
      const day = dateObj.getDay();
      
      // 1. Horários estáticos da rota
      let staticList: { time: string; direction: 'IDA' | 'VOLTA' }[] = [];
      if (selectedRouteDetails.schedule) {
        if (day === 0) staticList = selectedRouteDetails.schedule.sunday || [];
        else if (day === 6) staticList = selectedRouteDetails.schedule.saturday || [];
        else staticList = selectedRouteDetails.schedule.weekdays || [];
      }
      const staticFiltered = (staticList || []).filter(item => item && (!item.direction || (item.direction || '').toUpperCase() === (detailDirection || 'IDA').toUpperCase()));

      // 2. Viagens / Escalas ativas cadastradas no dia para a rota e direção
      const scheduledTripsForDay = (localTrips || []).filter(t => {
        if (!t || t.route_id !== selectedRouteDetails.id) return false;
        const tripDateOnly = t.trip_date ? t.trip_date.split('T')[0] : '';
        if (tripDateOnly !== scheduleDate) return false;
        const tripDir = (t.direction || 'IDA').toUpperCase();
        if (tripDir !== (detailDirection || 'IDA').toUpperCase()) return false;
        if (t.status === 'Cancelada') return false;
        return true;
      });

      // 3. Mesclar horários em Map para evitar duplicidade
      const timesMap = new Map<string, { time: string; direction: 'IDA' | 'VOLTA'; hasActiveTrip: boolean; trip?: Trip }>();

      staticFiltered.forEach(item => {
        if (item?.time) {
          timesMap.set(item.time, { time: item.time, direction: detailDirection, hasActiveTrip: false });
        }
      });

      scheduledTripsForDay.forEach(trip => {
        if (trip?.departure_time) {
          timesMap.set(trip.departure_time, {
            time: trip.departure_time,
            direction: detailDirection,
            hasActiveTrip: true,
            trip
          });
        }
      });

      return Array.from(timesMap.values()).sort((a, b) => (a?.time || '').localeCompare(b?.time || ''));
    } catch (e) {
      return [];
    }
  }, [selectedRouteDetails, scheduleDate, detailDirection, localTrips]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      setIsDragging(true);
      setStartX(e.pageX - scrollRef.current.offsetLeft);
      setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const normalize = (str: any) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  const filteredRoutes = useMemo(() => {
      if (!Array.isArray(routes)) return [];
      let result = routes.filter(Boolean);
      if (showOnlyFavorites) {
        result = result.filter(r => r?.id && favoriteRouteIds.has(r.id));
      }
      if (searchTerm) {
        const nSearch = normalize(searchTerm);
        result = result.filter(r => 
          normalize(r?.prefixo_linha).includes(nSearch) || 
          normalize(r?.destination).includes(nSearch) ||
          normalize(r?.origin).includes(nSearch)
        );
      }
      if (filterCompany) {
        result = result.filter(r => r?.company_id === filterCompany);
      }
      const targetCity = cepCity || filterCity;
      if (targetCity) {
        const nCity = normalize(targetCity);
        result = result.filter(r => 
          normalize(r?.origin).includes(nCity) || 
          normalize(r?.destination).includes(nCity) ||
          (r?.city && normalize(r.city).includes(nCity))
        );
      }
      return result.sort((a, b) => (a?.prefixo_linha || '').localeCompare(b?.prefixo_linha || '', undefined, { numeric: true }));
  }, [routes, searchTerm, filterCompany, filterCity, cepCity, showOnlyFavorites, favoriteRouteIds]);

  const activeNotices = useMemo(() => {
      return (notices || []).filter(n => {
        if (!n || !n.id) return false;
        const matchesRole = !n.target_role || n.target_role === 'PASSENGER' || n.target_role === 'ALL';
        return matchesRole && !hiddenNotices.has(n.id);
      });
  }, [notices, hiddenNotices]);

  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans relative overflow-x-hidden md:max-w-3xl md:mx-auto shadow-2xl">
      
      {/* Modal de Autenticação / Cadastro Independente (Passageiro vs Vale Transporte) */}
      {showAuthModal && (
          <div className="fixed inset-0 z-[800] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <div className={`bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] border-4 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-500 ${authModalTab === 'PASSENGER' ? 'border-indigo-600' : 'border-yellow-400'}`}>
                  {/* Header */}
                  <div className={`p-6 border-b flex justify-between items-center ${authModalTab === 'PASSENGER' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-yellow-400 text-slate-900 border-yellow-500'}`}>
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${authModalTab === 'PASSENGER' ? 'bg-white text-indigo-600' : 'bg-slate-900 text-white'}`}>
                              {authModalTab === 'PASSENGER' ? <Ticket size={22}/> : <CreditCard size={22}/>}
                          </div>
                          <div>
                            <h3 className="text-lg font-black uppercase italic leading-tight">
                              {authModalMode === 'REGISTER' 
                                ? (authModalTab === 'PASSENGER' ? 'Cadastrar Passageiro' : 'Cadastrar Vale Transporte') 
                                : (authModalTab === 'PASSENGER' ? 'Login de Passageiro' : 'Acesso ao Cartão VT')}
                            </h3>
                            <p className="text-[9px] font-bold opacity-80 uppercase tracking-wider">
                              {authModalTab === 'PASSENGER' ? 'Conta para compra de passagens' : 'Gestão de saldo & cartão'}
                            </p>
                          </div>
                      </div>
                      <button onClick={() => { setShowAuthModal(false); setIsRegisteringPassword(false); }} className="p-2 bg-black/20 hover:bg-black/40 text-current rounded-xl transition-all"><X size={20}/></button>
                  </div>

                  {/* Tabs: Escolha do Tipo de Conta Independente */}
                  {!isRegisteringPassword && (
                      <div className="flex border-b dark:border-zinc-800 shrink-0 bg-slate-100 dark:bg-zinc-950 p-1.5 gap-1.5">
                          <button 
                              type="button"
                              onClick={() => { setAuthModalTab('PASSENGER'); setIsRegisteringPassword(false); }}
                              className={`flex-1 py-3 px-2 rounded-2xl text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 transition-all ${authModalTab === 'PASSENGER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                          >
                              <Ticket size={14} />
                              Comprar Passagens
                          </button>
                          <button 
                              type="button"
                              onClick={() => { setAuthModalTab('CARD'); setIsRegisteringPassword(false); }}
                              className={`flex-1 py-3 px-2 rounded-2xl text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 transition-all ${authModalTab === 'CARD' ? 'bg-yellow-400 text-slate-900 shadow-md font-extrabold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                          >
                              <CreditCard size={14} />
                              Vale Transporte
                          </button>
                      </div>
                  )}

                  <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                      {/* Explicação da Independência dos Logins */}
                      {authModalTab === 'PASSENGER' ? (
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 p-4 rounded-2xl text-[10px] font-black uppercase leading-relaxed text-center border-2 border-indigo-200 dark:border-indigo-800/60 shadow-sm">
                          🎟️ Conta exclusiva para compras de passagens online, seleção de assentos e bilhetes. O login é 100% independente do seu Cartão VT.
                        </div>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 p-4 rounded-2xl text-[10px] font-black uppercase leading-relaxed text-center border-2 border-yellow-200 dark:border-yellow-800/40 shadow-sm">
                          💳 Conta exclusiva para consulta de saldo, recargas e extrato do seu Cartão Físico/Digital (Vale Transporte/Estudante).
                        </div>
                      )}

                      {/* Modo: Cadastro */}
                      {authModalMode === 'REGISTER' ? (
                          <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-400">Preencha seus dados de cadastro</span>
                                <button 
                                  onClick={() => setAuthModalMode('LOGIN')}
                                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                                >
                                  Já tem conta? Entrar
                                </button>
                              </div>

                              {authModalTab === 'CARD' && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Categoria do Cartão</label>
                                    <select 
                                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" 
                                      value={registrationForm.type} 
                                      onChange={e => setRegistrationForm({...registrationForm, type: e.target.value as any})}
                                    >
                                      <option value="Vale Transporte">Vale Transporte</option>
                                      <option value="Estudante">Estudante</option>
                                      <option value="Cidadão">Cidadão</option>
                                      <option value="Sênior">Sênior (Melhor Idade)</option>
                                      <option value="Especial">Especial</option>
                                    </select>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome *</label>
                                      <input type="text" placeholder="JOÃO" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.name} onChange={e => setRegistrationForm({...registrationForm, name: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sobrenome *</label>
                                      <input type="text" placeholder="SILVA" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.surname} onChange={e => setRegistrationForm({...registrationForm, surname: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CPF *</label>
                                      <input type="text" placeholder="000.000.000-00" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.cpf} onChange={e => handleRegistrationCpfChange(e.target.value)} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data de Nasc.</label>
                                      <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.birth_date} onChange={e => setRegistrationForm({...registrationForm, birth_date: e.target.value})} />
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Telefone</label>
                                      <input type="text" placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.phone} onChange={e => setRegistrationForm({...registrationForm, phone: phoneMask(e.target.value)})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">E-mail</label>
                                      <input type="email" placeholder="usuario@email.com" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.email} onChange={e => setRegistrationForm({...registrationForm, email: e.target.value})} />
                                  </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-1">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CEP</label>
                                      <input type="text" placeholder="00000-000" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.cep} onChange={e => handleRegistrationCepSearch(e.target.value)} />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Rua / Av.</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.address_street} onChange={e => setRegistrationForm({...registrationForm, address_street: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Número</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.address_number} onChange={e => setRegistrationForm({...registrationForm, address_number: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Bairro</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.address_neighborhood} onChange={e => setRegistrationForm({...registrationForm, address_neighborhood: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cidade</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.address_city} onChange={e => setRegistrationForm({...registrationForm, address_city: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Estado</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-slate-200 dark:border-zinc-700" value={registrationForm.address_state} onChange={e => setRegistrationForm({...registrationForm, address_state: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>

                              {registrationForm.birth_date && (new Date().getFullYear() - new Date(registrationForm.birth_date).getFullYear() < 18) && (
                                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-blue-100 dark:border-blue-900/20">
                                    <h4 className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-2"><Users size={12}/> Dados do Responsável (Menores)</h4>
                                    <input type="text" placeholder="NOME DO RESPONSÁVEL" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.responsible_name} onChange={e => setRegistrationForm({...registrationForm, responsible_name: e.target.value.toUpperCase()})} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="date" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.responsible_birth_date} onChange={e => setRegistrationForm({...registrationForm, responsible_birth_date: e.target.value})} />
                                        <input type="text" placeholder="PARENTESCO" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.relationship} onChange={e => setRegistrationForm({...registrationForm, relationship: e.target.value.toUpperCase()})} />
                                    </div>
                                </div>
                              )}

                              <div className="pt-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Senha de Acesso *</label>
                                  <input type="password" placeholder="MÍNIMO 4 CARACTERES" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm font-black outline-none border-2 border-indigo-400" value={registrationForm.password} onChange={e => setRegistrationForm({...registrationForm, password: e.target.value})} />
                              </div>

                              <button 
                                onClick={handleRegisterPassenger} 
                                className={`w-full py-4 ${authModalTab === 'PASSENGER' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-yellow-400 text-slate-900 hover:bg-yellow-300 font-extrabold'} text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:opacity-50 transition-all`}
                                disabled={isRecharging}
                              >
                                {isRecharging ? <Loader2 className="animate-spin mx-auto"/> : authModalTab === 'PASSENGER' ? 'Criar Conta de Compras' : 'Cadastrar Vale Transporte'}
                              </button>
                          </div>
                      ) : isRegisteringPassword ? (
                          /* Cadastro de Senha Inicial */
                          <div className="space-y-6">
                              <p className="text-[10px] font-black uppercase text-slate-400 text-center">Este cadastro ainda não possui senha. Crie sua senha de acesso:</p>
                              <div className="space-y-4">
                                  <input type="password" placeholder="NOVA SENHA" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black border border-slate-200 dark:border-zinc-700" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                  <input type="password" placeholder="CONFIRMAR SENHA" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black border border-slate-200 dark:border-zinc-700" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                              </div>
                              <button onClick={handleRegisterPassword} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Salvar Senha e Entrar</button>
                          </div>
                      ) : (
                          /* Modo: Login */
                          <div className="space-y-6">
                              <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">
                                      {authModalTab === 'PASSENGER' ? 'CPF ou E-mail' : 'Número do Cartão ou CPF'}
                                    </label>
                                    <input 
                                      type="text" 
                                      placeholder={authModalTab === 'PASSENGER' ? "000.000.000-00 ou email" : "Número do cartão ou CPF"} 
                                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black border border-slate-200 dark:border-zinc-700 outline-none" 
                                      value={loginIdentifier} 
                                      onChange={e => setLoginIdentifier(e.target.value)} 
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Senha</label>
                                    <input 
                                      type="password" 
                                      placeholder="••••••••" 
                                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black border border-slate-200 dark:border-zinc-700 outline-none" 
                                      value={loginPassword} 
                                      onChange={e => setLoginPassword(e.target.value)} 
                                    />
                                  </div>
                              </div>
                              <button 
                                onClick={handleAuthLogin} 
                                className={`w-full py-4 ${authModalTab === 'PASSENGER' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'} rounded-2xl font-black uppercase text-xs shadow-xl transition-all`}
                              >
                                {authModalTab === 'PASSENGER' ? 'Entrar para Comprar' : 'Acessar Vale Transporte'}
                              </button>

                              <div className="pt-4 border-t dark:border-zinc-800 text-center space-y-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Não possui uma conta ainda?</p>
                                  <button 
                                    onClick={() => setAuthModalMode('REGISTER')} 
                                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${authModalTab === 'PASSENGER' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40' : 'border-yellow-400 text-slate-900 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/30'}`}
                                  >
                                    Criar Conta de {authModalTab === 'PASSENGER' ? 'Passageiro' : 'Vale Transporte'}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Gestão do Vale Transporte (Card) */}
      {showCardModal && loggedInCard && (
          <div className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
               <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] border-4 border-yellow-400 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b dark:border-zinc-800 flex justify-between items-center bg-yellow-400 text-slate-900">
                      <div>
                        <h3 className="text-2xl font-black uppercase italic">Meu Vale Transporte</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">Cartão de Transporte Digital</p>
                      </div>
                      <button onClick={() => setShowCardModal(false)} className="p-2 bg-slate-900 text-white rounded-xl"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 flex flex-col items-center custom-scrollbar">
                      <TransportCard name={`${loggedInCard.name} ${loggedInCard.surname}`} cardNumber={loggedInCard.card_number} photoUrl={loggedInCard.photo_url} category={loggedInCard.type.toUpperCase()} />
                      
                      <div className="w-full space-y-4">
                          <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] border-2 border-slate-100 dark:border-zinc-700 text-center space-y-4">
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase">Saldo Disponível no Cartão</p>
                                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">R$ {loggedInCard.balance?.toFixed(2) || '0.00'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setShowCardModal(false);
                                    setActiveTab('recharge');
                                    setRechargeCard(loggedInCard);
                                    setRechargeQuery(loggedInCard.card_number);
                                  }}
                                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                  <CreditCard size={14}/> Recarregar Agora
                                </button>
                                <button 
                                  onClick={handleLogoutCard}
                                  className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-700 active:scale-95 transition-all"
                                >
                                  Desconectar
                                </button>
                              </div>
                          </div>
                      </div>
                  </div>
               </div>
          </div>
      )}

      {/* Modal de Gestão da Conta de Passageiro (Comprador de Passagens) */}
      {showBuyerModal && loggedInBuyer && (
          <div className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
               <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[3rem] border-4 border-indigo-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b dark:border-zinc-800 flex justify-between items-center bg-indigo-600 text-white">
                      <div>
                        <h3 className="text-2xl font-black uppercase italic">Minha Conta de Passageiro</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Identificação para Emissão de Bilhetes</p>
                      </div>
                      <button onClick={() => setShowBuyerModal(false)} className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      <div className="p-6 bg-indigo-50 dark:bg-indigo-950/40 rounded-[2rem] border-2 border-indigo-100 dark:border-indigo-900/30 space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md shrink-0">
                              {loggedInBuyer.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-base font-black uppercase">{loggedInBuyer.name} {loggedInBuyer.surname}</h4>
                              <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">CPF: {loggedInBuyer.cpf}</p>
                              {loggedInBuyer.email && <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{loggedInBuyer.email}</p>}
                            </div>
                          </div>
                          
                          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-center space-y-1">
                            <p className="text-[10px] font-black text-emerald-600 uppercase">● Conta Autenticada para Compras</p>
                            <p className="text-[10px] text-slate-400 uppercase">Seus dados serão preenchidos automaticamente na reserva e compra de passagens.</p>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => {
                                setShowBuyerModal(false);
                                setActiveTab('routes');
                              }}
                              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                            >
                              <Ticket size={14}/> Comprar Passagem
                            </button>
                            <button 
                              onClick={handleLogoutBuyer}
                              className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-700 active:scale-95 transition-all"
                            >
                              Desconectar
                            </button>
                          </div>
                      </div>
                  </div>
               </div>
          </div>
      )}

      {pushAlert && (
          <div className="fixed top-24 left-4 right-4 z-[1000]">
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] border-4 border-yellow-400 shadow-2xl flex items-start gap-4">
                  <div className="p-3 bg-yellow-400 rounded-2xl text-slate-900"><Bell size={24} className="animate-ring"/></div>
                  <div className="flex-1">
                      <p className="font-black uppercase text-xs">{pushAlert.title}</p>
                      <p className="text-[10px] text-slate-400 italic">"{pushAlert.content}"</p>
                  </div>
                  <button onClick={() => setPushAlert(null)}><X size={20}/></button>
              </div>
          </div>
      )}


      <div className="bg-yellow-400 text-slate-900 p-4 sm:p-6 sticky top-0 z-30 shadow-md transition-colors">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
           <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                   <Bus className="text-yellow-500" size={24}/>
               </div>
               <div>
                 <h1 className="font-black text-lg sm:text-xl uppercase italic leading-tight">Passageiro ViaLivre</h1>
                 <p className="text-[9px] font-bold text-slate-800 uppercase tracking-widest hidden sm:block">Portal de Itinerários & Bilhetagem</p>
               </div>
           </div>
           <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Botão 1: Vale Transporte / Cartão (Login Independente e Sincronizado por CPF) */}
                <button 
                  onClick={() => {
                    if (loggedInCard) {
                      setShowCardModal(true);
                    } else {
                      setAuthModalTab('CARD');
                      setAuthModalMode('LOGIN');
                      setShowAuthModal(true);
                    }
                  }} 
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm ${loggedInCard ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900/15 hover:bg-slate-900/25 text-slate-900'}`}
                  title={loggedInCard ? `Gerenciar Vale Transporte (${loggedInCard.card_number || loggedInCard.name}) - Saldo: R$ ${Number(loggedInCard.balance || 0).toFixed(2)}` : "Entrar / Criar Conta de Vale Transporte"}
                >
                  <CreditCard size={14} className={loggedInCard ? 'text-emerald-200' : 'text-slate-800'} />
                  <span className="truncate max-w-[150px] font-black">
                    {loggedInCard 
                      ? `VT: R$ ${Number(loggedInCard.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : 'VT: Entrar / Consultar'}
                  </span>
                </button>

                {/* Botão 2: Conta de Compra de Passagens (Login Independente) */}
                <button 
                  onClick={() => {
                    if (loggedInBuyer) {
                      setShowBuyerModal(true);
                    } else {
                      setAuthModalTab('PASSENGER');
                      setAuthModalMode('LOGIN');
                      setShowAuthModal(true);
                    }
                  }} 
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm ${loggedInBuyer ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-900 text-yellow-400 hover:bg-slate-800'}`}
                  title={loggedInBuyer ? "Minha Conta de Passageiro" : "Entrar / Criar Conta de Compras"}
                >
                  <Ticket size={14} className={loggedInBuyer ? 'text-indigo-200' : 'text-yellow-400'} />
                  <span className="truncate max-w-[110px]">{loggedInBuyer ? loggedInBuyer.name.split(' ')[0] : 'Comprar Passagens'}</span>
                </button>

                <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all ${notificationsEnabled ? 'bg-slate-900 text-yellow-400 font-extrabold border-2 border-yellow-400' : 'bg-slate-900/10 hover:bg-slate-900/20'}`} title={notificationsEnabled ? "Notificações Ativas" : "Permitir Acesso às Notificações"}><SmartphoneNfc size={18}/></button>
                <button onClick={() => setShowThemePopup(true)} className="p-2 bg-slate-900/10 hover:bg-slate-900/20 rounded-xl transition-all text-slate-800" title="Design e Cores"><Palette size={18}/></button>
                <button onClick={onExit} className="px-3 py-2 bg-slate-900/10 hover:bg-slate-900/20 rounded-xl text-[10px] font-black uppercase">Sair</button>
           </div>
        </div>
        
        <div className="flex bg-slate-900/10 rounded-2xl p-1">
            <button onClick={() => setActiveTab('routes')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'routes' ? 'bg-white shadow-sm' : ''}`}>Itinerários</button>
            <button onClick={() => setActiveTab('recharge')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'recharge' ? 'bg-white shadow-sm' : ''}`}>Recarga</button>
            <button onClick={() => setActiveTab('notices')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'notices' ? 'bg-white shadow-sm' : ''}`}>Mural</button>
            <button onClick={() => setActiveTab('work-with-us')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'work-with-us' ? 'bg-white shadow-sm' : ''}`}>Vagas</button>
        </div>
      </div>

      {selectedRouteDetails && (
          <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] border-4 border-yellow-400 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 bg-yellow-400 text-slate-900 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="text-xl font-black uppercase italic">Itinerário Detalhado</h3>
                          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{selectedRouteDetails.prefixo_linha}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteRoute(selectedRouteDetails.id, e)}
                          className={`p-2 rounded-xl transition-all ${
                            favoriteRouteIds.has(selectedRouteDetails.id)
                              ? 'bg-slate-900 text-yellow-400 font-black shadow-md'
                              : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
                          }`}
                          title={favoriteRouteIds.has(selectedRouteDetails.id) ? "Remover dos Favoritos" : "Favoritar Rota (Notificações de Alteração)"}
                        >
                          <Star size={18} className={favoriteRouteIds.has(selectedRouteDetails.id) ? "fill-yellow-400 text-yellow-400" : ""} />
                        </button>
                      </div>
                      <button onClick={() => setSelectedRouteDetails(null)} className="p-2 bg-slate-900 text-white rounded-xl"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-center">
                            <div className="flex-1 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-black text-slate-400">Origem</p>
                                <p className="font-black text-sm">{selectedRouteDetails.origin}</p>
                            </div>
                            <ArrowRight className="text-yellow-400 shrink-0" />
                            <div className="flex-1 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-black text-slate-400">Destino</p>
                                <p className="font-black text-sm">{selectedRouteDetails.destination}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 text-center">
                                <p className="text-[10px] font-black uppercase text-emerald-600">Tarifa Integral</p>
                                <p className="text-xl font-black">R$ {(Number(selectedRouteDetails?.price) || 0).toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 text-center">
                                <p className="text-[10px] font-black uppercase text-blue-600">Prefixo</p>
                                <p className="text-xl font-black">{selectedRouteDetails?.prefixo_linha || ''}</p>
                            </div>
                        </div>
                      </div>

                      {/* Seções */}
                      {selectedRouteDetails.sections && selectedRouteDetails.sections.length > 0 && (
                          <div className="space-y-3">
                              <h4 className="text-xs font-black uppercase italic flex items-center gap-2">
                                <MapPin size={14} className="text-yellow-500" /> Seções Intermediárias
                              </h4>
                              <div className="grid gap-2">
                                  {(selectedRouteDetails.sections || []).map((section, idx) => (
                                      <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-dotted border-slate-200 dark:border-zinc-850 flex justify-between items-center text-[10px]">
                                          <div className="flex flex-col">
                                              <span className="font-black uppercase">{section?.origin} x {section?.destination}</span>
                                              <span className="text-slate-400">Tarifa Seção</span>
                                          </div>
                                          <span className="font-black text-emerald-600">R$ {(Number(section?.price) || 0).toFixed(2)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Horários */}
                      <div className="space-y-4">
                          <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-2xl border dark:border-zinc-800">
                              <h4 className="text-xs font-black uppercase italic flex items-center gap-2">
                                <Clock size={14} className="text-yellow-500" /> Quadro de Horários
                              </h4>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center bg-slate-100 dark:bg-zinc-800 p-3 rounded-2xl">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase text-slate-500">Data:</span>
                                  <input 
                                    type="date" 
                                    value={scheduleDate} 
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-700 font-extrabold text-xs uppercase outline-none shadow-sm text-slate-700 dark:text-white border dark:border-zinc-600"
                                  />
                              </div>
                              <div className="flex p-0.5 bg-slate-200 dark:bg-zinc-700 rounded-xl max-sm:w-full">
                                  <button 
                                    onClick={() => setDetailDirection('IDA')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${detailDirection === 'IDA' ? 'bg-white dark:bg-zinc-600 shadow-sm' : 'opacity-65'}`}
                                  >Ida</button>
                                  <button 
                                    onClick={() => setDetailDirection('VOLTA')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${detailDirection === 'VOLTA' ? 'bg-white dark:bg-zinc-600 shadow-sm' : 'opacity-65'}`}
                                  >Volta</button>
                              </div>
                          </div>

                          {selectedRouteDetails.route_type === 'URBANO' && (
                              <div className="p-4 bg-amber-50 dark:bg-yellow-950/15 text-amber-800 dark:text-yellow-500 border border-yellow-250 dark:border-yellow-500/30 rounded-2xl text-[9px] font-black uppercase text-center leading-relaxed">
                                  ⚠️ Rota Urbana / Municipal: O pagamento da tarifa é realizado diretamente ao operador, a bordo do veículo. Não há venda antecipada de passagens no autoatendimento.
                              </div>
                          )}

                          <div className="grid grid-cols-1 gap-3">
                              {currentSchedules.length > 0 ? (
                                  currentSchedules.map((item, sIdx) => {
                                      const matchingTrip = item.trip || (localTrips || []).find(t => 
                                          t.route_id === selectedRouteDetails.id &&
                                          (!t.direction || t.direction.toUpperCase() === detailDirection.toUpperCase()) &&
                                          (t.trip_date ? t.trip_date.split('T')[0] === scheduleDate : false) &&
                                          t.departure_time === item.time &&
                                          t.status !== 'Cancelada'
                                      );

                                      const isTripInProgress = matchingTrip && (matchingTrip.status === 'Em Andamento' || matchingTrip.status === 'Em Rota') && !matchingTrip.finished;
                                      const isTripFinished = matchingTrip && (matchingTrip.finished || matchingTrip.status === 'Concluída');
                                      const hasConductor = matchingTrip?.conductor_name && matchingTrip.conductor_name !== 'Não atribuído' && matchingTrip.conductor_name !== 'Nenhum';

                                      return (
                                          <div 
                                            key={sIdx} 
                                            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                                              matchingTrip 
                                                ? (isTripInProgress 
                                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 shadow-sm' 
                                                    : isTripFinished 
                                                      ? 'bg-slate-100/60 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 opacity-75' 
                                                      : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/60 shadow-sm')
                                                : 'bg-slate-50/50 dark:bg-zinc-950 border-slate-150 dark:border-zinc-850'
                                            }`}
                                          >
                                            <div className="flex-1 space-y-2 text-left">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-3 py-1 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-xl text-xs font-mono">{item.time}</span>
                                                    {matchingTrip ? (
                                                      isTripInProgress ? (
                                                        <span className="px-2.5 py-0.5 bg-emerald-500 text-white font-extrabold rounded-lg text-[9px] uppercase shadow-sm flex items-center gap-1.5 animate-pulse">
                                                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                          Em Viagem Agora
                                                        </span>
                                                      ) : isTripFinished ? (
                                                        <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-extrabold rounded-lg text-[9px] uppercase">
                                                          Viagem Concluída
                                                        </span>
                                                      ) : (
                                                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold rounded-lg text-[9px] uppercase border border-emerald-500/40 flex items-center gap-1">
                                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                          Escala Ativa
                                                        </span>
                                                      )
                                                    ) : (
                                                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold rounded-lg text-[8px] uppercase">
                                                        Previsto no Quadro
                                                      </span>
                                                    )}
                                                    {matchingTrip && (
                                                      <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-800 dark:text-yellow-400 font-black rounded-md text-[9px] uppercase border border-yellow-400/40">
                                                        Carro: {matchingTrip.bus_number}
                                                      </span>
                                                    )}
                                                </div>

                                                {matchingTrip ? (
                                                  <div className="text-[10px] text-slate-700 dark:text-zinc-200 font-bold uppercase space-y-0.5">
                                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                                        <span className="flex items-center gap-1 text-slate-900 dark:text-zinc-100 font-extrabold">
                                                          <span className="text-slate-400 font-normal">Motorista:</span> {matchingTrip.driver_name || 'Escalado'}
                                                        </span>
                                                        {hasConductor && (
                                                          <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-300">
                                                            <span className="text-slate-400 font-normal">Cobrador:</span> {matchingTrip.conductor_name}
                                                          </span>
                                                        )}
                                                      </div>
                                                  </div>
                                                ) : (
                                                  <span className="block text-[9px] italic text-slate-400 font-semibold uppercase">Escala ainda não programada para este dia</span>
                                                )}
                                            </div>
                                            
                                            {matchingTrip ? (
                                              selectedRouteDetails.route_type === 'URBANO' ? (
                                                <div className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 text-amber-600 dark:text-amber-500 font-black uppercase text-[9px] rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-500/50 text-center leading-none">
                                                  Pagamento no veículo
                                                </div>
                                              ) : isTripFinished ? (
                                                <div className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-xl text-[9px] font-black uppercase">
                                                  Encerrada
                                                </div>
                                              ) : (
                                                <button 
                                                  onClick={() => handleBuyClick(matchingTrip.id, selectedRouteDetails.id)}
                                                  className="px-4 py-2.5 bg-indigo-600 dark:bg-indigo-500 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                                                >
                                                  <span>Comprar</span>
                                                  <ShoppingCart size={13} className="text-white/70"/>
                                                </button>
                                              )
                                            ) : (
                                              selectedRouteDetails.route_type !== 'URBANO' && (
                                                <button 
                                                  onClick={() => handleBuyClick(undefined, selectedRouteDetails.id)}
                                                  className="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-indigo-600 dark:bg-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-700 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 transition-all active:scale-95 shrink-0 border border-indigo-200/50 dark:border-indigo-900/30"
                                                >
                                                  <span>Pré-venda</span>
                                                  <ShoppingCart size={12} className="opacity-70"/>
                                                </button>
                                              )
                                            )}
                                          </div>
                                      );
                                  })
                              ) : (
                                  <div className="py-8 text-center text-slate-400 text-[10px] font-black uppercase italic border border-dashed rounded-2xl">
                                      Sem horários programados neste dia para direção {detailDirection === 'IDA' ? 'Ida' : 'Volta'}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-zinc-900 border-t dark:border-zinc-800 flex flex-col gap-2 shrink-0">
                      <p className="text-[9px] font-black uppercase text-slate-400 text-center italic">
                        {selectedRouteDetails.route_type === 'URBANO' 
                          ? 'Esta linha não aceita venda online. Efetue pagamento direto ao motorista/cobrador no veículo.' 
                          : 'Escolha um horário acima para comprar sua passagem'}
                      </p>
                  </div>
              </div>
          </div>
      )}

      <div 
        ref={scrollRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
        className="flex-1 overflow-y-auto pb-24"
      >
            <div className="p-6 space-y-8">
                {activeTab === 'routes' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 space-y-6 text-center">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-black uppercase italic">Encontre sua <span className="text-yellow-600">Viagem</span></h2>
                                <button
                                    onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                                    className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                                        showOnlyFavorites 
                                            ? 'bg-amber-400 text-slate-950 shadow-md font-black' 
                                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                                    }`}
                                >
                                    <Star size={14} className={showOnlyFavorites ? "fill-slate-950 text-slate-950" : "text-amber-500"} />
                                    <span>Favoritas ({favoriteRouteIds.size})</span>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="relative"><Search className="absolute left-4 top-4 text-slate-400" size={18}/><input type="text" placeholder="Pesquisar Linha..." className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-zinc-800 outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none">
                                        <option value="">Todas Empresas</option>
                                        {(companies || []).map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                                    </select>
                                    <input type="text" placeholder="Cidade..." className="px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none" value={filterCity} onChange={e => setFilterCity(e.target.value)} />
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="CEP..." className="flex-1 px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none" value={cepSearch} onChange={e => setCepSearch(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                                    <button onClick={handleCepSearch} className="px-6 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-xl font-black uppercase text-[10px]">Buscar</button>
                                </div>
                                {cepCity && <p className="text-[10px] font-black text-emerald-600 uppercase">Localizado: {cepCity} (Raio 10km)</p>}
                            </div>
                        </div>

                        <div className="bg-slate-900 p-8 rounded-[2.5rem] border-4 border-indigo-400 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/10 rounded-3xl mx-auto flex items-center justify-center mb-2">
                                <Ticket size={32} className="text-indigo-400" />
                            </div>
                            <h3 className="text-white font-black uppercase italic">Bilhete Digital</h3>
                            <button 
                                onClick={() => {
                                    onOpenTicketing(undefined, loggedInCard || undefined);
                                }} 
                                className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <ShoppingCart size={16}/> Escolher Rota e Horário
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {filteredRoutes.length === 0 ? (
                                <div className="py-12 bg-white dark:bg-zinc-900 rounded-[2rem] border-2 border-dashed text-center"><p className="text-slate-400 font-black uppercase text-[10px]">Nenhuma rota encontrada</p></div>
                            ) : (
                                filteredRoutes.map(route => {
                                    const todayStr = getTodayDateStr();
                                    const todayTrips = (localTrips || []).filter(t => 
                                        t.route_id === route.id && 
                                        (t.trip_date ? t.trip_date.split('T')[0] === todayStr : false) &&
                                        t.status !== 'Cancelada'
                                    );

                                    const activeNow = todayTrips.find(t => (t.status === 'Em Andamento' || t.status === 'Em Rota') && !t.finished);

                                    const activeOrScheduledTrips = todayTrips
                                        .filter(t => !t.finished && t.status !== 'Concluída')
                                        .sort((a, b) => a.departure_time.localeCompare(b.departure_time));

                                    const completedTrips = todayTrips
                                        .filter(t => t.finished || t.status === 'Concluída')
                                        .sort((a, b) => a.departure_time.localeCompare(b.departure_time));

                                    const staticSchedule = (() => {
                                        if (!route.schedule) return [];
                                        const dateObj = new Date();
                                        const day = dateObj.getDay();
                                        if (day === 0) return route.schedule.sunday || [];
                                        if (day === 6) return route.schedule.saturday || [];
                                        return route.schedule.weekdays || [];
                                    })();

                                    const isFav = favoriteRouteIds.has(route.id);

                                    return (
                                        <div key={route.id} onClick={() => { setSelectedRouteDetails(route); setDetailDirection('IDA'); }} className={`bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border hover:border-yellow-400 cursor-pointer transition-all shadow-sm ${isFav ? 'border-amber-400/80 ring-2 ring-amber-400/20' : 'border-slate-150 dark:border-zinc-800'}`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-900 text-yellow-400 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wider">{route.prefixo_linha}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => toggleFavoriteRoute(route.id, e)}
                                                        className={`p-1.5 rounded-xl transition-all ${
                                                            isFav 
                                                                ? 'bg-amber-400/20 text-amber-500 hover:bg-amber-400/30' 
                                                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-amber-500 hover:bg-slate-200'
                                                        }`}
                                                        title={isFav ? "Remover dos Favoritos" : "Favoritar esta rota (receba notificações de alterações)"}
                                                    >
                                                        <Star size={16} className={isFav ? "fill-amber-400 text-amber-500" : ""} />
                                                    </button>
                                                </div>
                                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">R$ {(Number(route?.price) || 0).toFixed(2)}</span>
                                            </div>
                                            <h4 className="font-black text-sm uppercase italic mb-3.5 text-slate-800 dark:text-zinc-100">{route?.origin || ''} x {route?.destination || ''}</h4>
                                            
                                            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-black uppercase">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={13} className="text-indigo-500"/>
                                                        <span>Escalas de Hoje {activeOrScheduledTrips.length > 0 ? `(${activeOrScheduledTrips.length})` : ''}:</span>
                                                    </div>
                                                    {activeNow && (
                                                        <span className="px-2 py-0.5 bg-emerald-500 text-white font-extrabold rounded-md text-[8px] flex items-center gap-1 animate-pulse shadow-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                                            Ônibus {activeNow.bus_number} Em Rota
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid gap-2.5">
                                                    {activeOrScheduledTrips.length > 0 ? (
                                                        activeOrScheduledTrips.map((t, idx) => {
                                                            const isInProgress = (t.status === 'Em Andamento' || t.status === 'Em Rota') && !t.finished;
                                                            const hasConductor = t.conductor_name && t.conductor_name !== 'Não atribuído' && t.conductor_name !== 'Nenhum';

                                                            return (
                                                                <div 
                                                                    key={`${t.id}-${idx}`} 
                                                                    className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col gap-2.5 ${
                                                                        isInProgress 
                                                                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-sm' 
                                                                            : 'bg-slate-50 dark:bg-zinc-950 border-slate-200/70 dark:border-zinc-800'
                                                                    }`}
                                                                >
                                                                    {/* Linha superior: horário, status e veículo */}
                                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="px-2.5 py-1 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-lg text-xs font-mono">
                                                                                {t.departure_time}
                                                                            </span>
                                                                            {isInProgress ? (
                                                                                <span className="px-2 py-0.5 bg-emerald-500 text-white font-extrabold rounded-md text-[8px] uppercase flex items-center gap-1 animate-pulse shadow-sm">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                                                    Em Viagem Agora
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold rounded-md text-[8px] uppercase border border-emerald-500/30 flex items-center gap-1">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                    Escala Ativa
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                                                                {t.direction || 'IDA'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="px-2.5 py-0.5 bg-yellow-400/20 text-yellow-800 dark:text-yellow-400 font-black rounded-md text-[9px] uppercase border border-yellow-400/40">
                                                                            Carro: {t.bus_number}
                                                                        </span>
                                                                    </div>

                                                                    {/* Linha de tripulação: Motorista e Cobrador */}
                                                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-850 text-[10px] uppercase">
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-bold text-slate-700 dark:text-zinc-300">
                                                                            <span className="flex items-center gap-1">
                                                                                <span className="text-slate-400 font-normal">Motorista:</span> {t.driver_name || 'Escalado'}
                                                                            </span>
                                                                            {hasConductor && (
                                                                                <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                                                                                    <span className="text-slate-400 font-normal">Cobrador:</span> {t.conductor_name}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Botão de Ação / Compra */}
                                                                        <div className="shrink-0">
                                                                            {route.route_type !== 'URBANO' ? (
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleBuyClick(t.id, route.id);
                                                                                    }}
                                                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-slate-900 active:scale-95 text-white font-black rounded-xl text-[9px] uppercase flex items-center gap-1.5 transition-all shadow-sm"
                                                                                >
                                                                                    <span>Comprar</span>
                                                                                    <ShoppingCart size={11} className="text-white/80" />
                                                                                </button>
                                                                            ) : (
                                                                                <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg text-[8px] font-black uppercase border border-amber-300 dark:border-amber-700">
                                                                                    Pagamento no Carro
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : completedTrips.length > 0 ? (
                                                        <div className="p-3 bg-slate-50/70 dark:bg-zinc-950/70 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1">
                                                            <span className="text-[9px] italic text-slate-500 dark:text-zinc-400 font-bold uppercase block">
                                                                Todas as escalas de hoje ({completedTrips.length}) já foram concluídas
                                                            </span>
                                                            <span className="text-[8px] text-slate-400 uppercase">
                                                                Clique na rota para consultar o quadro de horários completo
                                                            </span>
                                                        </div>
                                                    ) : staticSchedule.length > 0 ? (
                                                        <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-850 space-y-2 text-left">
                                                            <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase">
                                                                <span>Quadro Previsto da Linha:</span>
                                                                <span className="text-indigo-500 font-bold">Ver todos</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {staticSchedule.slice(0, 6).map((st, sidx) => (
                                                                    <span key={sidx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-[9px] rounded-md font-mono">
                                                                        {st.time} ({st.direction || 'IDA'})
                                                                    </span>
                                                                ))}
                                                                {staticSchedule.length > 6 && (
                                                                    <span className="px-1.5 py-0.5 text-slate-400 font-bold text-[9px]">
                                                                        +{staticSchedule.length - 6}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-2.5 bg-slate-50/50 dark:bg-zinc-950/50 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                                                            <span className="text-[9px] italic text-slate-400 uppercase">
                                                                Sem escalas registradas para hoje. Clique para ver detalhes.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'recharge' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 space-y-6">
                            <h2 className="text-2xl font-black uppercase italic">Meus <span className="text-yellow-600">Saldos</span></h2>
                            <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  placeholder="DIGITE O CPF OU Nº DO CARTÃO..." 
                                  className="flex-1 px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none dark:text-white border-2 border-transparent focus:border-yellow-400 transition-all" 
                                  value={rechargeQuery} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setRechargeQuery(val);
                                    const clean = val.replace(/\D/g, '');
                                    if (clean.length === 11 || clean.length === 8) {
                                      db.getImpCards().then(cards => {
                                        const found = (cards || []).find(c => {
                                          const cleanCpf = (c.cpf || '').replace(/\D/g, '');
                                          const cleanCard = (c.card_number || '').replace(/\D/g, '');
                                          return (cleanCpf === clean || cleanCard === clean);
                                        });
                                        if (found) {
                                          setRechargeCard(found);
                                        }
                                      }).catch(() => {});
                                    }
                                  }} 
                                />
                                <button onClick={handleRechargeSearch} className="px-6 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-xl font-black uppercase text-[10px] hover:scale-105 active:scale-95 transition-all shadow-md">Buscar</button>
                            </div>
                        </div>
                        {rechargeCard && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-400 p-8 rounded-[2.5rem] border-4 border-slate-900 space-y-6">
                                <h3 className="font-black uppercase italic text-center">{rechargeCard?.name || ''} {rechargeCard?.surname || ''}</h3>
                                <div className="p-4 bg-white rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-slate-400">Saldo Atual</p><p className="text-2xl font-black">R$ {(Number(rechargeCard?.balance) || 0).toFixed(2)}</p></div>
                                <div className="space-y-4">
                                    <input type="text" className="w-full py-4 text-center text-2xl font-black bg-slate-900 text-yellow-400 rounded-2xl outline-none" value={rechargeAmount} onChange={e => setRechargeAmount(formatCurrencyRTL(e.target.value))} />
                                    <button onClick={handleRecharge} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Confirmar Recarga</button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {activeTab === 'work-with-us' && (
                    <div className="animate-in fade-in duration-500">
                        <JobApplicationForm onSuccess={() => setActiveTab('routes')} addToast={addToast} currentUser={loggedInCard ? { id: loggedInCard.id, full_name: `${loggedInCard.name}`, role: 'PASSENGER' } : null as any} />
                    </div>
                )}

                {activeTab === 'notices' && (
                    <div className="space-y-6 transition-colors">
                        <h2 className="text-2xl font-black uppercase italic px-2">Mural de <span className="text-yellow-600">Avisos</span></h2>
                        {activeNotices.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-black uppercase text-[10px] italic">Sem novidades.</div>
                        ) : (
                            activeNotices.map(notice => (
                                <div key={notice.id} className={`bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-l-8 transition-all ${!readNotices.has(notice.id) ? 'border-yellow-400' : 'border-slate-200 dark:border-zinc-800'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2"><Megaphone size={16} className="text-yellow-500"/><h4 className="font-black text-[10px] uppercase">{notice.title}</h4></div>
                                        <button onClick={() => markAsRead(notice.id)} className="text-[8px] font-black uppercase text-slate-400 hover:text-slate-600">Lido</button>
                                    </div>
                                    <p className="text-xs italic text-slate-500 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl">"{notice.content}"</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            <AnimatePresence>
              {showThemePopup && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md text-slate-900 dark:text-zinc-100 overflow-hidden overscroll-contain"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowThemePopup(false);
                  }}
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`w-full max-w-md rounded-[2.5rem] shadow-2xl border-4 border-yellow-400 p-6 sm:p-7 relative max-h-[90vh] flex flex-col ${
                      systemSettings?.glass_effect !== false 
                        ? 'glass-panel text-slate-950 dark:text-zinc-100' 
                        : 'bg-white dark:bg-zinc-900 text-slate-950 dark:text-zinc-100'
                    }`}
                  >
                  {/* Header */}
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Palette className="text-yellow-400 animate-pulse" size={24} />
                      <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-950 dark:text-white">Design e Cores</h2>
                    </div>
                    <button onClick={() => setShowThemePopup(false)} className="p-1.5 bg-slate-50 dark:bg-zinc-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-all">
                      <X size={20} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="mt-5 space-y-6 overflow-y-auto custom-scrollbar flex-1 modal-scroll-container pr-1">
                    {/* Theme Preset Toggles */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Aparência do Painel</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button" 
                          onClick={() => onChangeThemeMode?.('light')}
                          className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'light' ? 'border-yellow-400 bg-yellow-50/20 text-slate-900' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200 bg-transparent'}`}
                        >
                          <Sun size={16} className={themeMode === 'light' ? 'text-yellow-500' : ''} />
                          Modo Claro
                        </button>
                        <button 
                          type="button" 
                          onClick={() => onChangeThemeMode?.('dark')}
                          className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'dark' ? 'border-yellow-400 bg-yellow-400/10 text-white animate-pulse' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-805'}`}
                        >
                          <Moon size={16} className={themeMode === 'dark' ? 'text-yellow-400' : ''} />
                          Modo Escuro
                        </button>
                      </div>
                    </div>

                    {/* Glassmorphism Effect Option */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Efeito de Vidro (Glassmorphism)</label>
                      <button 
                        type="button" 
                        id="passenger-toggle-glass-btn"
                        onClick={() => {
                          if (onUpdateSettings) {
                            const isCurrentlyGlass = systemSettings?.glass_effect !== false;
                            onUpdateSettings({
                              ...(systemSettings || {
                                id: 'sys-set-001',
                                system_id: 'sys-vialivre-default',
                                system_name: 'ViaLivre Gestão',
                                company_name: 'Viação Nicolau S/A',
                                registration_pattern: 'FLX-000',
                                theme_color: 'yellow',
                                glass_effect: true,
                                support_email: 'via.nicolau.sa@gmail.com'
                              }),
                              glass_effect: !isCurrentlyGlass
                            });
                          }
                        }}
                        className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-between w-full cursor-pointer select-none ${
                          systemSettings?.glass_effect !== false 
                            ? 'border-yellow-400 bg-yellow-400/10 text-slate-950 dark:text-yellow-400 font-black shadow-sm ring-2 ring-yellow-400/20' 
                            : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/50'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-black">
                          <Layers size={16} className={systemSettings?.glass_effect !== false ? 'text-yellow-400 animate-pulse' : 'text-slate-400'} />
                          Efeito Translúcido (Vidro)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                            systemSettings?.glass_effect !== false 
                              ? 'bg-yellow-400 text-slate-950 border border-slate-950' 
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                          }`}>
                            {systemSettings?.glass_effect !== false ? 'Ativado' : 'Desativado'}
                          </span>
                          <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
                            systemSettings?.glass_effect !== false ? 'bg-yellow-400 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                          }`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      </button>
                      <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">
                        Aplica acabamento translúcido e bordas de sobreposição em todo o sistema.
                      </p>
                    </div>

                    {/* Accessibility Options */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Acessibilidade</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (systemSettings && onUpdateSettings) {
                            onUpdateSettings({ ...systemSettings, high_contrast: !systemSettings.high_contrast });
                          }
                        }}
                        className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-between w-full ${systemSettings?.high_contrast ? 'border-yellow-400 bg-yellow-400/10 text-slate-950 dark:text-yellow-400 font-black' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200 bg-transparent'}`}
                      >
                        <span className="flex items-center gap-2 font-black">
                          <span className="w-4 h-4 rounded-full border-2 border-current bg-transparent flex items-center justify-center text-[8px] font-black">A</span>
                          Alto Contraste
                        </span>
                        <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${systemSettings?.high_contrast ? 'bg-yellow-400 text-slate-950 border border-slate-950' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                          {systemSettings?.high_contrast ? 'Ativado' : 'Desativado'}
                        </span>
                      </button>
                      <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">Melhora a legibilidade do sistema para passageiros e motoristas em ambientes externos.</p>
                    </div>

                    {/* Accent Color Palette & Custom Primary Color Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Cor Primária do Portal</label>
                        {systemSettings?.theme_color && (
                          <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                            {resolveThemeColors(systemSettings.theme_color).hex}
                          </span>
                        )}
                      </div>

                      {/* Seletor Livre de Cor */}
                      <div className="p-2.5 mb-2 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="color"
                            value={resolveThemeColors(systemSettings?.theme_color).hex}
                            onChange={(e) => {
                              if (systemSettings && onUpdateSettings) {
                                onUpdateSettings({ ...systemSettings, theme_color: e.target.value.toLowerCase() });
                              }
                            }}
                            className="w-8 h-8 rounded-xl border-2 border-white dark:border-zinc-700 cursor-pointer shadow bg-transparent p-0 overflow-hidden shrink-0"
                            title="Escolher cor personalizada"
                          />
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase text-slate-800 dark:text-zinc-200 truncate">Cor Livre</p>
                            <p className="text-[8px] font-mono text-slate-400">Color Picker</p>
                          </div>
                        </div>

                        <input
                          type="text"
                          maxLength={7}
                          placeholder="#FACC15"
                          value={resolveThemeColors(systemSettings?.theme_color).isCustom ? (systemSettings?.theme_color || '') : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('#') && val.length <= 7 && systemSettings && onUpdateSettings) {
                              if (isValidHexColor(val) || val.length === 4 || val.length === 7) {
                                onUpdateSettings({ ...systemSettings, theme_color: val.toLowerCase() });
                              }
                            }
                          }}
                          className="w-18 px-1.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-[9px] font-mono font-bold uppercase text-center dark:text-white outline-none focus:ring-1 focus:ring-yellow-400 shrink-0"
                        />
                      </div>

                      {/* Grade de Paletas Pré-definidas */}
                      <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {PRESET_THEME_COLORS.map(palette => {
                          const currentTheme = systemSettings?.theme_color || 'yellow';
                          const isSelected = currentTheme === palette.id || currentTheme.toLowerCase() === palette.primary.toLowerCase();
                          return (
                            <button
                              type="button"
                              key={palette.id}
                              onClick={() => {
                                if (systemSettings && onUpdateSettings) {
                                  onUpdateSettings({ ...systemSettings, theme_color: palette.id });
                                }
                              }}
                              className={`p-2 rounded-xl border-2 transition-all flex items-center justify-between w-full ${
                                isSelected 
                                  ? 'border-yellow-400 bg-slate-50 dark:bg-zinc-800/50 shadow-sm' 
                                  : 'border-slate-100 dark:border-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700 bg-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/10 shrink-0" 
                                  style={{ backgroundColor: palette.primary }} 
                                />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate">{palette.name.split(' (')[0]}</span>
                              </div>
                              {isSelected ? (
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#eab308] dark:text-yellow-400 px-1.5 py-0.5 bg-yellow-400/10 rounded flex items-center gap-0.5 shrink-0">
                                  <Check size={9} /> Ativo
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono text-slate-400 shrink-0">{palette.primary}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
      </div>
    </div>
  );
};

const PassengerInterface: React.FC<PassengerInterfaceProps> = (props) => {
  return (
    <PassengerErrorBoundary onExit={props.onExit}>
      <PassengerInterfaceContent {...props} />
    </PassengerErrorBoundary>
  );
};

export default PassengerInterface;
