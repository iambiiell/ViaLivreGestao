
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BusRoute, Trip, User, TicketSale, Vehicle, Company, TicketingConfig, PassengerDetails, City, TicketBooth } from '../types';
import { Bus, MapPin, Calendar, Clock, DollarSign, X, Printer, QrCode, CreditCard, Wallet, Loader2, ArrowRight, Search, UserPlus, History, CheckCircle2, ChevronLeft, ChevronRight, Ticket, Tag, Users, Info, ShieldCheck, Edit3, Download, Disc, Mail, Home, ReceiptText, ShieldAlert, Scissors, ZoomIn, ZoomOut, Bell, Save } from 'lucide-react';
import { cpfMask, phoneMask, cepMask, validateCPF } from '../utils/masks';
import { fetchAddress } from '../services/cep';
import { db, supabase } from '../services/database';
import TicketVoucher from './TicketVoucher';
import { downloadTicket as generateTicketPdf } from './TicketGenerator';
import { motion, AnimatePresence } from 'framer-motion';

interface PassengerForm {
    full_name: string;
    cpf: string;
    birth_date: string;
    phone: string;
    email: string;
    cep: string; 
    street: string; 
    number: string; 
    complement: string; 
    neighborhood: string; 
    city: string; 
    state: string;
    seat_number: number;
    responsible_name?: string;
    responsible_birth_date?: string;
    relationship?: string;
}

interface TicketAgentInterfaceProps {
  routes: BusRoute[];
  trips: Trip[];
  vehicles: Vehicle[];
  companies: Company[];
  cities: City[];
  currentUser: User | null;
  ticketingConfig: TicketingConfig | null;
  onExit: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  isPassengerView?: boolean;
  initialTripId?: string;
  initialRouteId?: string;
  initialPassengerData?: any;
}

const TicketAgentInterface: React.FC<TicketAgentInterfaceProps> = ({ 
  routes = [], 
  trips = [], 
  vehicles = [],
  companies = [], 
  cities = [], 
  currentUser, 
  onExit, 
  addToast,
  isPassengerView = false,
  ticketingConfig,
  initialTripId,
  initialRouteId,
  initialPassengerData
}) => {
  const [localTrips, setLocalTrips] = useState<Trip[]>(trips || []);

  useEffect(() => {
    if (trips && trips.length > 0) {
      setLocalTrips(trips);
    }
  }, [trips]);

  useEffect(() => {
    let isMounted = true;
    const syncTrips = async () => {
      try {
        const latest = await db.getTrips();
        if (latest && isMounted) {
          setLocalTrips(latest);
        }
      } catch (e) {
        console.warn('Erro ao atualizar viagens no guichê/autoatendimento:', e);
      }
    };

    syncTrips();
    const interval = setInterval(syncTrips, 5000);

    const channel = supabase
      ? supabase
          .channel('ticket-agent-trips-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload: any) => {
            if (!isMounted) return;
            if (payload.eventType === 'INSERT') {
              const newTrip = payload.new as Trip;
              setLocalTrips(prev => {
                const exists = prev.some(t => t.id === newTrip.id);
                return exists ? prev.map(t => t.id === newTrip.id ? newTrip : t) : [newTrip, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedTrip = payload.new as Trip;
              setLocalTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setLocalTrips(prev => prev.filter(t => t.id !== deletedId));
              }
            }
          })
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const effectiveTrips = localTrips.length > 0 ? localTrips : trips;

  const [activeView, setActiveView] = useState<'venda' | 'historico' | 'bilhete'>('venda');
  const [step, setStep] = useState(initialTripId ? 3 : initialRouteId ? 2 : 1);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [originSearchTerm, setOriginSearchTerm] = useState('');
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [lineSearchTerm, setLineSearchTerm] = useState('');
  
  const [selectedRouteId, setSelectedRouteId] = useState<string>(initialRouteId || '');
  const [selectedTripId, setSelectedTripId] = useState<string>(initialTripId || '');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [originSearch, setOriginSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (originRef.current && !originRef.current.contains(target)) {
        setShowOriginDropdown(false);
      }
      if (destinationRef.current && !destinationRef.current.contains(target)) {
        setShowDestinationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [showNoRoutesMessage, setShowNoRoutesMessage] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number>(-1);
  const [passengerForms, setPassengerForms] = useState<Record<number, PassengerForm>>({});
  const [paymentMethod, setPaymentMethod] = useState<string>(isPassengerView ? 'PIX' : 'DINHEIRO');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [changeAmount, setChangeAmount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState('');
  const [discountValue, setDiscountValue] = useState(0);

  const [isFinishing, setIsFinishing] = useState(false);
  const [isVerifyingVt, setIsVerifyingVt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [vtIdentifier, setVtIdentifier] = useState('');
  const [impCardIdentifier, setImpCardIdentifier] = useState('');
  const [isVerifyingImpCard, setIsVerifyingImpCard] = useState(false);
  const [isPresale, setIsPresale] = useState(false);
  const [presaleTime, setPresaleTime] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<'IDA' | 'VOLTA'>('IDA');
  const [lastTicket, setLastTicket] = useState<TicketSale | null>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<Set<number>>(new Set());
  const [allSales, setAllSales] = useState<TicketSale[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [editingSale, setEditingSale] = useState<TicketSale | null>(null);
  const [isUpdatingSale, setIsUpdatingSale] = useState(false);
  const [saleIdBeingEdited, setSaleIdBeingEdited] = useState<string | null>(null);
  const [ticketBooths, setTicketBooths] = useState<TicketBooth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState<string>('');
  const [showBoothSelector, setShowBoothSelector] = useState(false);

  useEffect(() => {
    db.getTicketBooths().then(booths => {
        setTicketBooths(booths);
        const activeBooths = booths.filter(b => b.active);
        if (activeBooths.length > 0) {
            // Try to find a booth assigned to this user in localStorage or fallback
            const savedId = localStorage.getItem(`vialivre_booth_${currentUser?.id || 'default'}`);
            if (savedId && activeBooths.some(b => b.id === savedId)) {
                setSelectedBoothId(savedId);
            } else {
                setSelectedBoothId(activeBooths[0].id);
                if (!isPassengerView) {
                    setShowBoothSelector(true);
                }
            }
        }
    });
  }, [currentUser, isPassengerView]);

  // Pre-fill passenger info from initial data if coming from Passenger Interface
  useEffect(() => {
    if (initialPassengerData && selectedSeats.length > 0) {
      const firstSeat = selectedSeats[0];
      if (!passengerForms[firstSeat]?.full_name) {
        setPassengerForms(prev => ({
          ...prev,
          [firstSeat]: {
            ...prev[firstSeat],
            full_name: `${initialPassengerData.name || ''} ${initialPassengerData.surname || ''}`.trim().toUpperCase(),
            cpf: initialPassengerData.cpf || '',
            phone: initialPassengerData.phone || '',
            email: (initialPassengerData.email || '').toLowerCase(),
            birth_date: initialPassengerData.birth_date || '',
            cep: initialPassengerData.cep || '',
            street: (initialPassengerData.address_street || '').toUpperCase(),
            number: (initialPassengerData.address_number || '').toUpperCase(),
            neighborhood: (initialPassengerData.address_neighborhood || '').toUpperCase(),
            city: (initialPassengerData.address_city || '').toUpperCase(),
            state: (initialPassengerData.address_state || '').toUpperCase(),
            complement: (initialPassengerData.address_complement || '').toUpperCase(),
            seat_number: firstSeat,
            responsible_name: initialPassengerData.responsible_name || '',
            responsible_birth_date: initialPassengerData.responsible_birth_date || '',
            relationship: initialPassengerData.relationship || ''
          } as any
        }));
      }
    }
  }, [initialPassengerData, selectedSeats]);

  // Helper calculation for grand total
  const getGrandTotal = (withDiscount: boolean = true) => {
    if (!selectedRoute) return 0;
    
    let base = 0;
    let toll = 0;
    let boarding = 0;
    let extra = 0;

    if (selectedSection) {
        // User request: For sections, toll and fees must follow the integral route (selectedRoute)
        toll = selectedRoute.toll || 0;
        boarding = selectedRoute.boarding_fee || 0;
        extra = selectedRoute.fees || 0;
        
        // Base fare is generated by subtracting these from the section price
        const sectionTotal = selectedSection.price || 0;
        base = Math.max(0, sectionTotal - toll - boarding - extra);
    } else {
        base = selectedRoute.price || 0;
        toll = selectedRoute.toll || 0;
        boarding = selectedRoute.boarding_fee || 0;
        extra = selectedRoute.fees || 0;
    }

    const perSeat = base + toll + boarding + extra;
    const total = perSeat * selectedSeats.length;
    return withDiscount ? Math.max(0, total - discountValue) : total;
  };

  useEffect(() => {
    const total = getGrandTotal();
    if (amountReceived > 0) {
      setChangeAmount(Math.max(0, amountReceived - total));
    } else {
      setChangeAmount(0);
    }
  }, [amountReceived, discountValue, selectedSeats]);

  useEffect(() => {
    if (activeView === 'historico') {
        const loadHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const sales = await db.getSales();
                // Filter by today or user? Let's show all for now, sorted by newest
                setAllSales(sales.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        loadHistory();
    }
  }, [activeView]);

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    setIsUpdatingSale(true);
    try {
        await db.update('ticket_sales', { ...editingSale });
        addToast("Passagem atualizada com sucesso!", "success");
        setAllSales(prev => prev.map(s => s.id === editingSale.id ? editingSale : s));
        setEditingSale(null);
    } catch (err) {
        addToast("Erro ao atualizar passagem", "error");
    } finally {
        setIsUpdatingSale(false);
    }
  };

  const handleEditSaleHistory = (sale: TicketSale) => {
    // Populate state for the sale process
    setOriginSearch(sale.section_origin || '');
    setDestinationSearch(sale.section_destination || '');
    setSelectedRouteId(sale.route_id || '');
    setSelectedTripId(sale.trip_id || '');
    setSaleDate(sale.trip_date || '');
    setSelectedDirection(sale.direction as any);
    setSelectedSeats([sale.seat_number]);
    setPresaleTime(sale.departure_time || '');
    setIsPresale(sale.is_presale || false);
    
    // Determine section if applicable
    if (sale.section_origin && sale.section_destination && routes.find(r => r.id === sale.route_id)?.sections) {
        const route = routes.find(r => r.id === sale.route_id);
        const sIndex = route?.sections?.findIndex(s => s.origin === sale.section_origin && s.destination === sale.section_destination);
        if (sIndex !== undefined && sIndex !== -1) {
            setSelectedSectionIndex(sIndex);
        }
    }

    // Populate passenger form
    setPassengerForms({
        [sale.seat_number]: {
            full_name: sale.passenger_name,
            cpf: sale.passenger_cpf,
            birth_date: sale.passenger_birth,
            phone: sale.passenger_phone,
            email: sale.passenger_email,
            cep: sale.address_cep,
            street: sale.address_street,
            number: sale.address_number,
            complement: sale.address_complement,
            neighborhood: sale.address_neighborhood,
            city: sale.address_city,
            state: sale.address_state,
            seat_number: sale.seat_number,
            responsible_name: sale.responsible_name,
            responsible_birth_date: sale.responsible_birth,
            relationship: sale.relationship
        }
    });
    
    setSaleIdBeingEdited(sale.id);
    setActiveView('venda');
    setStep(1); // As per user request: "será necessário abrir o menu de horários, poltronas e identificação novamente"
    addToast("Editando passagem. Prossiga com o fluxo de venda.", "success");
  };

  const selectedRoute = useMemo(() => routes.find(r => r.id === selectedRouteId), [routes, selectedRouteId]);
  const selectedBooth = useMemo(() => ticketBooths.find(b => b.id === selectedBoothId), [ticketBooths, selectedBoothId]);
  const selectedSection = useMemo(() => {
    if (selectedRoute && selectedSectionIndex !== -1 && selectedRoute.sections) {
      return selectedRoute.sections[selectedSectionIndex];
    }
    return null;
  }, [selectedRoute, selectedSectionIndex]);
  const selectedTrip = useMemo(() => effectiveTrips.find(t => t.id === selectedTripId), [effectiveTrips, selectedTripId]);
  const selectedVehicle = useMemo(() => vehicles.find(v => v.prefix === selectedTrip?.bus_number), [vehicles, selectedTrip]);
  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedRoute?.company_id), [companies, selectedRoute]);

  // Reset discount if payment method changes violating the coupon's rules
  useEffect(() => {
    const normalizedMethod = (paymentMethod || '').toUpperCase().replace(/[\s_]/g, '');
    
    // Check if current applied coupon has a payment condition that is now violated.
    // If it has NO payment condition, we do NOT clear it!
    if (couponCode) {
      const currentActiveCoupon = ticketingConfig?.active_coupons?.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
      if (currentActiveCoupon && currentActiveCoupon.conditions && currentActiveCoupon.conditions.includes('[PGTO:')) {
          const reqMethod = currentActiveCoupon.conditions.match(/\[PGTO:\s*(.+?)\]/)?.[1]?.toUpperCase().replace(/[\s_]/g, '');
          if (reqMethod !== normalizedMethod) {
              setDiscountValue(0);
              setCouponCode('');
              addToast(`Cupom removido devido à alteração na forma de pagamento.`, "success");
          }
      }
    }
    
    if (paymentMethod.toUpperCase() !== 'DINHEIRO') {
      setAmountReceived(0);
      setChangeAmount(0);
    }
  }, [paymentMethod, ticketingConfig, selectedRoute, selectedSection, couponCode]);

  // Pre-fill card identifiers for active logged in user
  useEffect(() => {
    if (initialPassengerData) {
      const idVal = initialPassengerData.cpf || initialPassengerData.card_number || '';
      if (idVal) {
        setVtIdentifier(idVal);
        setImpCardIdentifier(idVal);
      }
    }
  }, [initialPassengerData]);

  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  const availableOrigins = useMemo(() => {
    const points = new Set<string>();
    
    // Add all registered cities
    cities.forEach(c => points.add(c.name.toUpperCase()));

    // Keep routes points too just in case some are not in cities (fallback)
    routes.filter(r => r.route_type === 'RODOVIARIA' || r.route_type === 'INTERMUNICIPAL').forEach(r => {
      if (r.origin) points.add((r.origin || '').toUpperCase());
      if (r.destination) points.add((r.destination || '').toUpperCase());
      if (r.sections) r.sections.forEach(s => {
        if (s.origin) points.add((s.origin || '').toUpperCase());
        if (s.destination) points.add((s.destination || '').toUpperCase());
      });
    });

    const list = Array.from(points).filter(Boolean).sort();
    if (!originSearch) return list;
    const nSearch = normalize(originSearch);
    return list.filter(o => normalize(o).startsWith(nSearch));
  }, [cities, routes, originSearch]);

  const availableDestinations = useMemo(() => {
    const points = new Set<string>();
    
    // Add all registered cities
    cities.forEach(c => points.add(c.name.toUpperCase()));

    // Keep routes points too just in case some are not in cities (fallback)
    routes.filter(r => r.route_type === 'RODOVIARIA' || r.route_type === 'INTERMUNICIPAL').forEach(r => {
      if (r.origin) points.add((r.origin || '').toUpperCase());
      if (r.destination) points.add((r.destination || '').toUpperCase());
      if (r.sections) r.sections.forEach(s => {
        if (s.origin) points.add((s.origin || '').toUpperCase());
        if (s.destination) points.add((s.destination || '').toUpperCase());
      });
    });

    const list = Array.from(points).filter(Boolean).sort();
    if (!destinationSearch) return list;
    const nSearch = normalize(destinationSearch);
    return list.filter(d => normalize(d).startsWith(nSearch));
  }, [cities, routes, destinationSearch]);

  const filteredRoutes = useMemo(() => {
    const oSearch = normalize(originSearch || '');
    const dSearch = normalize(destinationSearch || '');
    const lSearch = normalize(lineSearchTerm || '');
    
    return routes
      .filter(r => r.route_type === 'RODOVIARIA' || r.route_type === 'INTERMUNICIPAL')
      .filter(r => {
        const rOrigin = normalize(r.origin || '');
        const rDest = normalize(r.destination || '');
        const rPrefix = normalize(r.prefixo_linha || '');
        const rName = normalize(r.name || '');

        // If line search is provided, filter by it first
        if (lSearch) {
          const matchesLine = rPrefix.includes(lSearch) || rName.includes(lSearch);
          if (!matchesLine) return false;
        }

        // If origin/dest search provided, they must match
        if (oSearch || dSearch) {
          const idaMatch = (oSearch ? rOrigin.includes(oSearch) : true) && 
                           (dSearch ? rDest.includes(dSearch) : true) || 
                           r.sections?.some(s => (oSearch ? normalize(s.origin || '').includes(oSearch) : true) && (dSearch ? normalize(s.destination || '').includes(dSearch) : true));
          
          const voltaMatch = (oSearch ? rDest.includes(oSearch) : true) && 
                             (dSearch ? rOrigin.includes(dSearch) : true) || 
                             r.sections?.some(s => (oSearch ? normalize(s.destination || '').includes(oSearch) : true) && (dSearch ? normalize(s.origin || '').includes(dSearch) : true));

          return idaMatch || voltaMatch;
        }

        // If only line search is provided and it matched, we are good
        return !!lSearch;
      })
      .sort((a, b) => (a.prefixo_linha || '').localeCompare(b.prefixo_linha || '', undefined, { numeric: true }));
  }, [routes, originSearch, destinationSearch, lineSearchTerm]);

  useEffect(() => {
    if (originSearch && destinationSearch && filteredRoutes.length === 0) {
      setShowNoRoutesMessage(true);
    } else {
      setShowNoRoutesMessage(false);
    }
  }, [originSearch, destinationSearch, filteredRoutes]);

  useEffect(() => {
    if (selectedTripId || (isPresale && selectedRouteId)) {
      db.getSales().then(sales => {
        // Force refresh all sales from DB to ensure it's not stale
        let tripSales = (sales || []).filter(s => s.status !== 'canceled');

        // Determine route ID, date, time, and direction for the active seat map
        let currentRouteId = selectedRouteId;
        let currentTime = isPresale ? presaleTime : '';
        let currentDirection = selectedDirection;

        const isPresaleId = selectedTripId && selectedTripId.startsWith('PRESALE_');
        if (isPresaleId) {
          const parts = selectedTripId.split('_');
          if (parts.length >= 4) {
            currentRouteId = parts[1];
            currentTime = parts[2];
            currentDirection = parts[3] as 'IDA' | 'VOLTA';
          }
        } else if (selectedTripId) {
          const trip = trips.find(t => t.id === selectedTripId);
          if (trip) {
            currentRouteId = trip.route_id || selectedRouteId;
            currentTime = trip.departure_time;
            currentDirection = trip.direction || selectedDirection;
          }
        }

        const activeRoute = routes.find(r => r.id === currentRouteId);
        const buySection = activeRoute && selectedSectionIndex !== -1 && activeRoute.sections ? activeRoute.sections[selectedSectionIndex] : null;

        const buyOrigin = buySection ? buySection.origin : (activeRoute?.origin || '');
        const buyDestination = buySection ? buySection.destination : (activeRoute?.destination || '');

        tripSales = tripSales.filter(s => {
          // Match dynamically by route, date, departure time, and direction!
          // This guarantees that even if there is no registered scale/trip, or if it is a pre-sale, or if they are synced, the seat is disabled.
          const matchesRoute = s.route_id === currentRouteId;
          const matchesDate = s.trip_date && s.trip_date.startsWith(saleDate);
          const matchesTime = s.departure_time === currentTime;
          const matchesDirection = s.direction === currentDirection;

          if (!(matchesRoute && matchesDate && matchesTime && matchesDirection)) {
            return false;
          }

          // Dynamic Sectional Overlap Check
          if (!activeRoute) return true; // Fail safe if route details aren't loaded

          const norm = (str: string) => (str || '').trim().toUpperCase();
          const bOrig = norm(buyOrigin);
          const bDest = norm(buyDestination);
          const sOrig = norm(s.section_origin) || norm(activeRoute.origin);
          const sDest = norm(s.section_destination) || norm(activeRoute.destination);

          // If the route has no sections, any sale is a full conflict and blocks the seat
          if (!activeRoute.sections || activeRoute.sections.length === 0) {
            return true;
          }

          // Build ordered list of stops for the route starting at activeRoute.origin
          const stops: string[] = [norm(activeRoute.origin)];
          const sections = activeRoute.sections || [];
          let currentCity = norm(activeRoute.origin);
          const visited = new Set<string>([currentCity]);

          while (currentCity !== norm(activeRoute.destination)) {
            const nextSection = sections.find(sec => norm(sec.origin) === currentCity && !visited.has(norm(sec.destination)));
            if (nextSection) {
              currentCity = norm(nextSection.destination);
              stops.push(currentCity);
              visited.add(currentCity);
            } else {
              if (!stops.includes(norm(activeRoute.destination))) {
                stops.push(norm(activeRoute.destination));
              }
              break;
            }
          }

          // Find indices
          let bStart = stops.indexOf(bOrig);
          let bEnd = stops.indexOf(bDest);
          let sStart = stops.indexOf(sOrig);
          let sEnd = stops.indexOf(sDest);

          // Fallbacks
          if (bStart === -1) bStart = 0;
          if (bEnd === -1) bEnd = stops.length - 1;
          if (sStart === -1) sStart = 0;
          if (sEnd === -1) sEnd = stops.length - 1;

          // Swap if start > end (e.g. reverse order in 'VOLTA' or custom ordering)
          if (bStart > bEnd) {
            const temp = bStart;
            bStart = bEnd;
            bEnd = temp;
          }
          if (sStart > sEnd) {
            const temp = sStart;
            sStart = sEnd;
            sEnd = temp;
          }

          // Overlap condition: (buyStart < soldEnd) && (soldStart < buyEnd)
          return (bStart < sEnd) && (sStart < bEnd);
        });

        setOccupiedSeats(new Set(tripSales.map(s => Number(s.seat_number))));
      });
    }
  }, [selectedTripId, isPresale, selectedRouteId, saleDate, presaleTime, originSearch, destinationSearch, selectedRoute, salesRefreshKey, selectedTrip, step, activeView, trips, selectedDirection, selectedSectionIndex, routes]);

  const handleCepChange = async (seat: number, cep: string) => {
    const maskedCep = cepMask(cep);
    const cleanCep = maskedCep.replace(/\D/g, '');
    
    setPassengerForms(prev => ({
      ...prev,
      [seat]: { ...prev[seat], cep: maskedCep, seat_number: seat }
    }));

    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const data = await fetchAddress(cleanCep);
        if (data) {
          setPassengerForms(prev => ({
            ...prev,
            [seat]: { 
              ...prev[seat], 
              street: (data.addressStreet || '').toUpperCase(),
              neighborhood: (data.addressNeighborhood || '').toUpperCase(),
              city: (data.addressCity || '').toUpperCase(),
              state: (data.addressState || '').toUpperCase()
            }
          }));
        }
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleCpfSearch = async (seat: number, cpf: string) => {
    const maskedCpf = cpfMask(cpf);
    const cleanCpf = cpf.replace(/\D/g, '');
    
    setPassengerForms(prev => ({
      ...prev,
      [seat]: { ...prev[seat], cpf: maskedCpf, seat_number: seat }
    }));

    if (cleanCpf.length === 11) {
      try {
        const [sales, cards, users] = await Promise.all([
          db.getSales().catch(() => []),
          db.getImpCards().catch(() => []),
          db.getUsers().catch(() => [])
        ]);

        // 1. Search in previous ticket sales (most recent first)
        const sortedSales = [...(sales || [])].sort((a, b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        const previousSale = sortedSales.find(s => (s.passenger_cpf || '').replace(/\D/g, '') === cleanCpf);

        if (previousSale) {
          setPassengerForms(prev => ({
            ...prev,
            [seat]: {
              ...prev[seat],
              full_name: previousSale.passenger_name || prev[seat]?.full_name || '',
              birth_date: previousSale.passenger_birth || prev[seat]?.birth_date || '',
              phone: previousSale.passenger_phone ? phoneMask(previousSale.passenger_phone) : prev[seat]?.phone || '',
              email: previousSale.passenger_email || prev[seat]?.email || '',
              cep: previousSale.address_cep ? cepMask(previousSale.address_cep) : prev[seat]?.cep || '',
              street: previousSale.address_street || prev[seat]?.street || '',
              number: previousSale.address_number || prev[seat]?.number || '',
              complement: previousSale.address_complement || prev[seat]?.complement || '',
              neighborhood: previousSale.address_neighborhood || prev[seat]?.neighborhood || '',
              city: previousSale.address_city || prev[seat]?.city || '',
              state: previousSale.address_state || prev[seat]?.state || '',
              responsible_name: previousSale.responsible_name || prev[seat]?.responsible_name || '',
              responsible_birth_date: previousSale.responsible_birth || prev[seat]?.responsible_birth_date || '',
              relationship: previousSale.relationship || prev[seat]?.relationship || ''
            }
          }));
          addToast("Dados do passageiro recuperados pelo CPF das passagens anteriores!", "success");
          return;
        }

        // 2. Search in Transport Cards (imp_cards)
        const foundCard = (cards || []).find(c => (c.cpf || '').replace(/\D/g, '') === cleanCpf);
        if (foundCard) {
          const fullName = `${foundCard.name || ''} ${foundCard.surname || ''}`.trim() || foundCard.name || '';
          setPassengerForms(prev => ({
            ...prev,
            [seat]: {
              ...prev[seat],
              full_name: fullName || prev[seat]?.full_name || '',
              birth_date: foundCard.birth_date || prev[seat]?.birth_date || '',
              phone: foundCard.phone ? phoneMask(foundCard.phone) : prev[seat]?.phone || '',
              email: foundCard.email || prev[seat]?.email || '',
              cep: foundCard.cep ? cepMask(foundCard.cep) : prev[seat]?.cep || '',
              street: foundCard.address_street || prev[seat]?.street || '',
              number: foundCard.address_number || prev[seat]?.number || '',
              complement: foundCard.address_complement || prev[seat]?.complement || '',
              neighborhood: foundCard.address_neighborhood || prev[seat]?.neighborhood || '',
              city: foundCard.address_city || prev[seat]?.city || '',
              state: foundCard.address_state || prev[seat]?.state || '',
              responsible_name: foundCard.responsible_name || foundCard.guardian_name || prev[seat]?.responsible_name || '',
              responsible_birth_date: foundCard.responsible_birth_date || prev[seat]?.responsible_birth_date || '',
              relationship: foundCard.relationship || prev[seat]?.relationship || ''
            }
          }));
          addToast("Dados recuperados a partir do cadastro do Vale Transporte!", "success");
          return;
        }

        // 3. Search in system users
        const foundUser = (users || []).find(u => (u.cpf || '').replace(/\D/g, '') === cleanCpf);
        if (foundUser) {
          setPassengerForms(prev => ({
            ...prev,
            [seat]: {
              ...prev[seat],
              full_name: foundUser.full_name || prev[seat]?.full_name || '',
              phone: foundUser.phone ? phoneMask(foundUser.phone) : prev[seat]?.phone || '',
              email: foundUser.email || prev[seat]?.email || ''
            }
          }));
          addToast("Dados básicos recuperados do cadastro de usuário!", "success");
        }
      } catch (error) {
        console.error("Erro ao buscar histórico por CPF:", error);
      }
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode || !ticketingConfig) return;
    setIsApplyingCoupon(true);
    try {
        // Simulate backend validation delay
        await new Promise(r => setTimeout(r, 1000));
        
        const coupon = ticketingConfig.active_coupons.find(c => 
            c.code.toUpperCase() === couponCode.toUpperCase() || 
            (c.numeric_code && c.numeric_code === couponCode)
        );
        if (coupon) {
            // Validation: Payment Method Restriction
            if (coupon.conditions && coupon.conditions.includes('[PGTO:')) {
                const requiredMethod = coupon.conditions.match(/\[PGTO:\s*(.+?)\]/)?.[1];
                if (requiredMethod && paymentMethod !== requiredMethod.toUpperCase()) {
                    setPaymentMethod(requiredMethod.toUpperCase());
                    addToast(`Forma de pagamento vinculada automaticamente para ${requiredMethod.toUpperCase()}.`, "success");
                }
            }

            const basePrice = selectedSection ? (selectedSection.price || 0) : (selectedRoute?.price || 0);
            const boardingFee = selectedSection ? (selectedSection.boarding_fee || 0) : (selectedRoute?.boarding_fee || 0);
            const fullBase = basePrice + boardingFee;
            const discount = coupon.type === 'PERCENT' ? (fullBase * (coupon.discount / 100)) : coupon.discount;
            setDiscountValue(discount);
            addToast(`Cupom ${coupon.code} validado via servidor! Desconto de R$ ${discount.toFixed(2)}`, "success");
        } else {
            setDiscountValue(0);
            addToast("Cupom inválido ou expirado no servidor.", "error");
        }
    } finally {
        setIsApplyingCoupon(false);
    }
  };



  const handleFinishSale = async () => {
    setIsFinishing(true);
    try {
        const salesToCreate: any[] = [];
        
        for (const seat of selectedSeats) {
            const formData = passengerForms[seat];
            if (!formData) continue;

            let basePrice = 0;
            let toll = 0;
            let boardingFee = 0;
            let fees = 0;

            if (selectedSection) {
                toll = selectedRoute.toll || 0;
                boardingFee = selectedRoute.boarding_fee || 0;
                fees = selectedRoute.fees || 0;
                const sectionTotal = selectedSection.price || 0;
                basePrice = Math.max(0, sectionTotal - toll - boardingFee - fees);
            } else {
                basePrice = selectedRoute.price || 0;
                toll = selectedRoute.toll || 0;
                boardingFee = selectedRoute.boarding_fee || 0;
                fees = selectedRoute.fees || 0;
            }
            
            // Total price per seat (proportionally dividing the discount)
            // If Vale Transporte, ignore visual discounts on the ticket as requested ("valor da tarifa saíra normal")
            const effectiveDiscount = (selectedSeats.length > 0 ? (discountValue / selectedSeats.length) : 0);
            
            // Per user request: "O TOTAL ... deve ser o valor da tarifa menos o valor de desconto do cupom"
            // We interpret "Tarifa" as the base price of the ticket in this context, but we still keep taxes for internal records.
            // However, the final `total_price` field is what is printed.
            const totalPrice = Math.max(0, (basePrice + toll + boardingFee + fees) - effectiveDiscount);

            const payload: any = {
                trip_id: isPresale ? null : selectedTripId,
                route_id: selectedRouteId,
                trip_date: saleDate, 
                departure_time: isPresale ? presaleTime : selectedTrip?.departure_time,
                direction: selectedDirection,
                section_origin: selectedSection ? selectedSection.origin : (selectedRoute?.origin || ''),
                section_destination: selectedSection ? selectedSection.destination : (selectedRoute?.destination || ''),
                is_presale: isPresale,
                seat_number: seat,
                passenger_name: formData.full_name,
                passenger_cpf: formData.cpf,
                passenger_birth: formData.birth_date,
                passenger_phone: formData.phone,
                passenger_email: formData.email,
                address_cep: formData.cep,
                address_street: formData.street,
                address_number: formData.number,
                address_complement: formData.complement,
                address_neighborhood: formData.neighborhood,
                address_city: formData.city,
                address_state: formData.state,
                payment_method: paymentMethod as any,
                total_price: totalPrice,
                price_base: basePrice,
                price_toll: toll,
                price_boarding_fee: boardingFee,
                price_fees: fees,
                discount_value: discountValue / selectedSeats.length,
                coupon_applied: couponCode || undefined,
                created_at: new Date().toISOString(),
                responsible_name: formData.responsible_name,
                responsible_birth: formData.responsible_birth_date,
                relationship: formData.relationship,
                booth_id: selectedBoothId || undefined,
                booth_data: selectedBooth ? {
                    name: selectedBooth.name,
                    cnpj: selectedBooth.cnpj,
                    ie: selectedBooth.ie || 'ISENTO',
                    phone: selectedBooth.phone,
                    address_street: selectedBooth.address_street,
                    address_number: selectedBooth.address_number,
                    address_city: selectedBooth.address_city,
                    address_state: selectedBooth.address_state,
                    address: `${selectedBooth.address_street}, ${selectedBooth.address_number} - ${selectedBooth.address_city}/${selectedBooth.address_state}`
                } : undefined,
                company_data: selectedCompany ? {
                    name: selectedCompany.name,
                    cnpj: selectedCompany.cnpj,
                    ie: selectedCompany.ie,
                    address: `${selectedCompany.address_street}, ${selectedCompany.address_number} - ${selectedCompany.address_city}/${selectedCompany.address_state}`,
                    address_street: selectedCompany.address_street,
                    address_number: selectedCompany.address_number,
                    address_city: selectedCompany.address_city,
                    address_state: selectedCompany.address_state
                } : undefined,
                vehicle_model: selectedVehicle?.model || '',
                vehicle_prefix: selectedVehicle?.prefix || ''
            };
            salesToCreate.push(payload);
        }

        // Vale Transporte Logic
        const isVt = (paymentMethod || '').toUpperCase().replace(/[_]/g, ' ') === 'VALE TRANSPORTE';
        if (isVt) {
            const grandTotal = salesToCreate.reduce((acc, s) => acc + s.total_price, 0);
            if (!vtIdentifier) {
                addToast("Informe o CPF ou Cartão do Vale Transporte", "warning");
                setIsFinishing(false);
                return;
            }
            setIsVerifyingVt(true);
            const cards = await db.getImpCards();
            const cleanVtInput = vtIdentifier.replace(/\D/g, '');
            const card = cards.find(c => {
                const cleanCpf = (c.cpf || '').replace(/\D/g, '');
                const cleanNum = (c.card_number || '').replace(/\D/g, '');
                return (cleanVtInput && (cleanCpf === cleanVtInput || cleanNum === cleanVtInput)) ||
                       c.cpf === vtIdentifier || c.card_number === vtIdentifier;
            });
            
            if (!card) {
                addToast("Cartão Vale Transporte não encontrado para este documento/número.", "error");
                setIsVerifyingVt(false);
                setIsFinishing(false);
                return;
            }

            if ((Number(card.balance) || 0) < grandTotal) {
                addToast(`Saldo Insuficiente. Saldo atual: R$ ${(Number(card.balance) || 0).toFixed(2)}`, "error");
                setIsVerifyingVt(false);
                setIsFinishing(false);
                return;
            }

            // Deduct balance
            const newBal = (Number(card.balance) || 0) - grandTotal;
            await db.update('imp_cards', { ...card, balance: newBal });
            window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
            window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
            addToast("Pagamento via Vale Transporte aprovado!", "success");
            setIsVerifyingVt(false);
        }

        // ImpCard Logic
        if ((paymentMethod || '').toUpperCase() === 'IMPCARD') {
            const grandTotal = salesToCreate.reduce((acc, s) => acc + s.total_price, 0);
            if (!impCardIdentifier) {
                addToast("Informe o CPF ou Matrícula do ImpCard", "warning");
                setIsFinishing(false);
                return;
            }
            setIsVerifyingImpCard(true);
            const cards = await db.getImpCards();
            const cleanImpInput = impCardIdentifier.replace(/\D/g, '');
            const card = cards.find(c => {
                const cleanCpf = (c.cpf || '').replace(/\D/g, '');
                const cleanNum = (c.card_number || '').replace(/\D/g, '');
                return (cleanImpInput && (cleanCpf === cleanImpInput || cleanNum === cleanImpInput)) ||
                       c.cpf === impCardIdentifier || c.card_number === impCardIdentifier;
            });
            
            if (!card) {
                addToast("ImpCard não encontrado para este documento/matrícula.", "error");
                setIsVerifyingImpCard(false);
                setIsFinishing(false);
                return;
            }

            if ((Number(card.balance) || 0) < grandTotal) {
                addToast(`Saldo insuficiente. Saldo atual: R$ ${(Number(card.balance) || 0).toFixed(2)}`, "error");
                setIsVerifyingImpCard(false);
                setIsFinishing(false);
                return;
            }

            // Deduct balance
            const newBal = (Number(card.balance) || 0) - grandTotal;
            await db.update('imp_cards', { ...card, balance: newBal });
            window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
            window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
            addToast("Pagamento via ImpCard aprovado!", "success");
            setIsVerifyingImpCard(false);
        }
        
        let lastCreated: TicketSale | null = null;
        for (const payload of salesToCreate) {
          if (saleIdBeingEdited) {
            // Update existing if editing
            lastCreated = await db.update<TicketSale>('ticket_sales', { ...payload, id: saleIdBeingEdited });
          } else {
            lastCreated = await db.create<TicketSale>('ticket_sales', payload);
          }
        }
        
        if (lastCreated) {
            setLastTicket(lastCreated);
            setActiveView('bilhete');
            setSaleIdBeingEdited(null); // Reset after finish
            setDiscountValue(0);
            setCouponCode('');
            setSalesRefreshKey(prev => prev + 1);
            addToast(saleIdBeingEdited ? "Passagem atualizada com sucesso!" : "Venda(s) emitted(s) com sucesso!", "success");
        }
    } catch (e) {
        addToast("Falha técnica no faturamento.", "error");
    } finally {
        setIsFinishing(false);
    }
  };

  const SeatMap = () => {
    const [zoom, setZoom] = useState(1);
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

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const capacity = selectedVehicle?.capacity || 44;
    
    const columns = useMemo(() => {
      const cols = [];
      for (let i = 1; i <= capacity; i += 4) {
        const colSeats = [];
        for (let j = 0; j < 4; j++) {
          if (i + j <= capacity) colSeats.push(i + j);
        }
        cols.push(colSeats);
      }
      return cols;
    }, [capacity]);

    const renderSeat = (num: number) => {
        const isOccupied = occupiedSeats.has(num);
        const isSelected = selectedSeats.includes(num);
        return (
          <div key={`seat-${num}`} className="flex items-center justify-center p-1 shrink-0 relative">
            <motion.button
              whileHover={!isOccupied ? { scale: 1.15, rotate: 2 } : {}}
              whileTap={!isOccupied ? { scale: 0.9 } : {}}
              initial={false}
              animate={{ 
                scale: isSelected ? 1.15 : 1,
                rotate: isSelected ? [0, -2, 2, 0] : 0,
                backgroundColor: isOccupied ? 'rgba(212, 212, 216, 1)' : isSelected ? 'rgba(30, 58, 138, 1)' : 'rgba(255, 255, 255, 1)',
                borderColor: isOccupied ? 'rgba(161, 161, 170, 1)' : isSelected ? 'rgba(15, 23, 42, 1)' : 'rgba(226, 232, 240, 1)'
              }}
              transition={{ 
                default: { type: "spring", stiffness: 400, damping: 10 },
                rotate: { duration: 0.4, ease: "easeInOut" }
              }}
              disabled={isOccupied}
              onClick={() => {
                if (isSelected) {
                  setSelectedSeats(selectedSeats.filter(s => s !== num));
                } else {
                  setSelectedSeats([...selectedSeats, num]);
                }
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border-2 transition-all shadow-sm
                ${isOccupied ? 'text-zinc-500 cursor-not-allowed opacity-50' :
                  isSelected ? 'text-white shadow-xl z-20 ring-4 ring-blue-500/20' : 
                  'dark:bg-zinc-800 text-blue-600 border-blue-100 dark:border-zinc-700 hover:border-blue-500 hover:shadow-md'}`}
            >
              {num}
              {/* Seat Headrest Detail */}
              <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 rounded-t-full ${isSelected ? 'bg-blue-400' : isOccupied ? 'bg-zinc-400' : 'bg-slate-200'}`} />
            </motion.button>
          </div>
        );
    };

    return (
      <div className="w-full bg-slate-50 dark:bg-zinc-950 p-6 md:p-12 rounded-[4rem] border-8 border-slate-100 dark:border-zinc-900 shadow-2xl flex flex-col items-center overflow-hidden relative min-h-[500px]">
        {/* Bus Shape Details */}
        <div className="absolute inset-0 border-[24px] border-slate-200/20 dark:border-zinc-800/20 rounded-[4rem] pointer-events-none" />
        
        {/* Controles de Zoom */}
        <div className="absolute top-8 right-8 flex gap-3 z-30 no-print scale-90 md:scale-100">
            <button 
                onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.4))}
                className="p-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-3xl text-slate-500 hover:text-blue-600 hover:border-blue-500 hover:shadow-lg transition-all"
                title="Diminuir Zoom"
            >
                <ZoomOut size={20} />
            </button>
            <button 
                onClick={() => setZoom(1)}
                className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-3xl text-xs font-black text-slate-500 hover:text-blue-600 hover:border-blue-500 hover:shadow-lg transition-all"
            >
                RESET
            </button>
            <button 
                onClick={() => setZoom(prev => Math.min(prev + 0.1, 2.5))}
                className="p-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-3xl text-slate-500 hover:text-blue-600 hover:border-blue-500 hover:shadow-lg transition-all"
                title="Aumentar Zoom"
            >
                <ZoomIn size={20} />
            </button>
        </div>

        {/* Legend */}
        <div className="mb-10 w-full max-w-sm grid grid-cols-3 gap-6 p-4 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 shadow-md z-30">
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-white border-2 border-blue-100 rounded-lg" />
                <span className="text-[9px] font-black uppercase text-slate-400">Livre</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-900 rounded-lg" />
                <span className="text-[9px] font-black uppercase text-slate-400">Suas</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-zinc-300 rounded-lg" />
                <span className="text-[9px] font-black uppercase text-slate-400">Ocupada</span>
            </div>
        </div>

        <div 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`w-full overflow-x-auto no-scrollbar py-16 flex justify-center items-center ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        >
            <div 
                style={{ 
                    transform: `scale(${zoom})`, 
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
                className="flex flex-row items-center gap-10 min-w-max p-12 bg-white dark:bg-zinc-900 rounded-[5rem] shadow-inner border-4 border-slate-100 dark:border-zinc-800"
            >
                {/* Cabine Motorista */}
                <div className="shrink-0 w-32 h-[320px] bg-slate-100 dark:bg-zinc-800 rounded-l-[4.5rem] flex flex-col items-center justify-center border-r-8 border-slate-200 dark:border-zinc-700 relative shadow-md">
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-300 dark:bg-zinc-600 rounded-full" />
                    <div className="w-20 h-20 bg-slate-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-slate-500 mb-4 border-4 border-slate-300 dark:border-zinc-600 shadow-lg">
                        <Bus size={40} className="opacity-40" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full border-8 border-slate-300 dark:border-zinc-600 flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity">
                            <div className="w-2 h-6 bg-slate-400 dark:bg-zinc-500 rounded-full rotate-45" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] vertical-text mt-4">CABINE</span>
                    </div>
                    {/* Gear stick/dashboard detail */}
                    <div className="absolute bottom-12 right-4 w-3 h-10 bg-slate-300 dark:bg-zinc-600 rounded-full opacity-30" />
                </div>

                {/* Salão de Passageiros */}
                <div className="flex flex-row gap-4 p-8 bg-slate-50/50 dark:bg-zinc-950/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800">
                    {columns.map((col, idx) => (
                      <div key={idx} className="flex flex-col gap-4">
                          {/* Lado A (Top) */}
                          <div className="flex flex-col gap-3">
                              {col[0] ? renderSeat(col[0]) : <div className="w-12 h-12" />}
                              {col[1] ? renderSeat(col[1]) : <div className="w-12 h-12" />}
                          </div>
                          
                          {/* Corredor */}
                          <div className="h-14 flex items-center justify-center">
                              <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full opacity-20 shadow-inner"></div>
                          </div>
     
                          {/* Lado B (Bottom) */}
                          <div className="flex flex-col gap-3">
                              {col[2] ? renderSeat(col[2]) : <div className="w-12 h-12" />}
                              {col[3] ? renderSeat(col[3]) : <div className="w-12 h-12" />}
                          </div>
                      </div>
                    ))}
                </div>

                {/* Traseira do Ônibus */}
                <div className="shrink-0 w-20 h-[320px] bg-slate-100 dark:bg-zinc-800 rounded-r-[3rem] border-l-4 border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-4 shadow-md">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-zinc-700 rounded-xl opacity-30" />
                    <div className="flex flex-col gap-2">
                        <div className="w-8 h-2 bg-red-400 rounded-full opacity-40 shadow-sm" />
                        <div className="w-8 h-2 bg-red-400 rounded-full opacity-40 shadow-sm" />
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-4">RETAGUARDA</span>
                </div>
            </div>
        </div>

        {/* Visual Cues */}
        <div className="mt-8 flex gap-10 items-center justify-center p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm z-30">
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacidade</p>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1">{capacity} <span className="text-[10px] text-slate-400 font-bold uppercase">Lugares</span></p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-zinc-800" />
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionados</p>
                <p className="text-xl font-black text-blue-600 leading-none mt-1">{selectedSeats.length} <span className="text-[10px] text-slate-400 font-bold uppercase">Poltronas</span></p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-zinc-800" />
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponíveis</p>
                <p className="text-xl font-black text-emerald-600 leading-none mt-1">{capacity - occupiedSeats.size} <span className="text-[10px] text-slate-400 font-bold uppercase">Assentos</span></p>
            </div>
        </div>
      </div>
    );
  };


  const PaymentModal = () => (
    <AnimatePresence>
      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPaymentModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden"
          >
            <div className="p-8 border-b-2 border-slate-100 dark:border-zinc-800 flex justify-between items-center text-left">
              <div>
                <h3 className="text-2xl font-black uppercase italic dark:text-white leading-none">Formas de Pagamento</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Selecione o método desejado</p>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl hover:text-red-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {[...(ticketingConfig?.payment_methods || ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'IMPCARD', 'VALE_TRANSPORTE'])].filter(m => !isPassengerView || m.toUpperCase().replace(/[ ]/g, '_') !== 'DINHEIRO')
                .filter(method => {
                    const normM = method.toUpperCase().replace(/[ ]/g, '_');
                    if (currentUser?.role === 'CONDUCTOR' || selectedRoute?.route_type === 'URBANO') {
                        const conf = ticketingConfig?.payment_methods_config?.find(c => c.label.toUpperCase().replace(/[ ]/g, '_') === normM);
                        return !conf?.is_road_only;
                    }
                    return true;
                })
                .sort((a, b) => a.localeCompare(b)).map(method => {
                  const normMethod = method.toUpperCase().replace(/[ ]/g, '_');
                  const isSelected = (paymentMethod || '').toUpperCase().replace(/[ ]/g, '_') === normMethod;
                  
                  return (
                  <button 
                    key={method} 
                    onClick={() => {
                      setPaymentMethod(normMethod);
                      setShowPaymentModal(false);
                    }} 
                    className={`py-6 rounded-3xl border-4 font-black transition-all flex flex-col items-center gap-2
                      ${isSelected 
                        ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-xl scale-[1.02]' 
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-yellow-400 hover:text-slate-600'}`}
                  >
                      {normMethod.includes('CREDITO') ? <CreditCard size={24}/> : 
                       normMethod.includes('PIX') ? <Disc size={24}/> : 
                       normMethod.includes('IMPCARD') ? <CreditCard size={24}/> : 
                       normMethod.includes('VALE_TRANSPORTE') ? <Bus size={24}/> : 
                       <Wallet size={24}/>}
                      <span className="text-[10px] uppercase font-black">{method.replace(/_/g, ' ')}</span>
                  </button>
                  );
                })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );


  const BoothSelectorModal = () => (
    <AnimatePresence>
      {showBoothSelector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={selectedBoothId ? () => setShowBoothSelector(false) : undefined}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden"
          >
            <div className="p-8 border-b-2 border-slate-100 dark:border-zinc-800 flex justify-between items-center text-left">
              <div>
                <h3 className="text-2xl font-black uppercase italic dark:text-white leading-none">Guichê de Vendas</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Escolha seu guichê de trabalho atual</p>
              </div>
              {selectedBoothId && (
                <button 
                  onClick={() => setShowBoothSelector(false)}
                  className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Guichê Ativo *</label>
                <select 
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none h-14"
                  value={selectedBoothId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedBoothId(id);
                    localStorage.setItem(`vialivre_booth_${currentUser?.id || 'default'}`, id);
                  }}
                >
                  <option value="" disabled>Selecione um guichê...</option>
                  {ticketBooths.filter(b => b.active).map(booth => (
                    <option key={booth.id} value={booth.id}>
                      {booth.name.toUpperCase()} ({booth.address_city})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBooth && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2 text-xs">
                  <p className="text-[9px] font-black uppercase text-slate-400">Dados do Guichê Selecionado</p>
                  <p className="dark:text-white"><strong>CNPJ:</strong> {selectedBooth.cnpj}</p>
                  {selectedBooth.ie && <p className="dark:text-white"><strong>Inscrição Estadual:</strong> {selectedBooth.ie}</p>}
                  <p className="dark:text-white"><strong>Endereço:</strong> {selectedBooth.address_street}, {selectedBooth.address_number} - {selectedBooth.address_city}/{selectedBooth.address_state}</p>
                  {selectedBooth.phone && <p className="dark:text-white"><strong>Telefone:</strong> {selectedBooth.phone}</p>}
                </div>
              )}

              <button
                type="button"
                disabled={!selectedBoothId}
                onClick={() => {
                  if (selectedBoothId) {
                    setShowBoothSelector(false);
                    addToast(`Guichê ${selectedBooth?.name || ''} selecionado com sucesso!`, "success");
                  }
                }}
                className="w-full py-4 bg-yellow-400 text-slate-900 font-black uppercase rounded-2xl shadow-xl hover:bg-yellow-500 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-xs tracking-wider"
              >
                Confirmar Trabalho neste Guichê
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );


  return (
    <div className="bg-white dark:bg-zinc-950 flex flex-col w-full h-full overflow-hidden transition-all no-print">
      <PaymentModal />
      <BoothSelectorModal />
      <div id="tour-tickets-header" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-8 py-6 border-b-2 border-slate-100 dark:border-zinc-800 flex justify-between items-center z-10 no-print transition-colors">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-yellow-400 rounded-2xl shadow-lg"><Ticket size={28} className="text-slate-900" /></div>
           <div>
               <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">{isPassengerView ? 'Guichê de Vendas - Autoatendimento' : 'Guichê de Vendas'}</h1>
               <div className="flex flex-col mt-1">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{isPassengerView ? 'Autoatendimento - Passageiro' : (currentUser?.full_name || 'Agente')}</p>
                   {!isPassengerView && selectedBooth && (
                     <button 
                       type="button"
                       onClick={() => setShowBoothSelector(true)} 
                       className="text-[9px] font-black text-slate-500 hover:text-yellow-500 uppercase tracking-widest mt-1 flex items-center gap-1.5 transition-colors self-start border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-800/30 px-2 py-0.5 rounded"
                     >
                       <span>Guichê: <span className="text-slate-850 dark:text-yellow-400 font-bold">{selectedBooth.name}</span></span>
                       <span className="text-[8px] opacity-70 font-bold ml-1 flex items-center gap-0.5 text-blue-500 hover:text-yellow-500 font-sans tracking-normal">(ALTERAR)</span>
                     </button>
                   )}
               </div>
           </div>
        </div>
        <div className="flex gap-3">
            {!isPassengerView && (
              <button onClick={() => { setActiveView(activeView === 'venda' ? 'historico' : 'venda'); setStep(1); setSelectedSeats([]); setSaleIdBeingEdited(null); }} className="px-6 py-3 bg-white/10 border-2 border-white/20 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-yellow-400 hover:text-slate-900 transition-all">
                  {activeView === 'venda' ? <History size={18}/> : <UserPlus size={18}/>}
                  {activeView === 'venda' ? 'Histórico' : 'Nova Venda'}
              </button>
            )}
            {isPassengerView ? (
              <button onClick={onExit} className="px-6 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/20 text-red-600 dark:text-red-450 border border-red-200 dark:border-red-900/40 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-sm">
                Voltar ao Início
              </button>
            ) : (
              <button onClick={onExit} className="p-3 text-slate-400 hover:text-red-500 dark:text-zinc-500 transition-colors"><X size={28}/></button>
            )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-10 overflow-y-auto no-print bg-white dark:bg-zinc-950 transition-colors">
          {activeView === 'bilhete' && lastTicket ? (
              <div className="animate-in slide-in-from-bottom-8">
                  <div className="flex justify-between items-center mb-10 bg-slate-50 dark:bg-zinc-900 p-8 rounded-[2rem] border-2 border-yellow-400 no-print transition-colors">
                      <div className="text-left">
                          <h3 className="text-2xl font-black uppercase italic leading-none flex items-center gap-3 dark:text-white"><CheckCircle2 className="text-emerald-500"/> Venda Confirmada</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Clique em imprimir para gerar o documento A4 completo</p>
                      </div>
                      <div className="flex gap-4">
                          <button onClick={() => generateTicketPdf(lastTicket.id, originSearch, destinationSearch)} className="px-10 py-5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl flex items-center gap-3 border-2 border-yellow-400 hover:scale-105 transition-all"><Download size={20}/> Baixar DABPE (PDF)</button>
                          <button onClick={() => { 
                              setActiveView('venda'); 
                              setStep(1); 
                              setSelectedSeats([]); 
                              setSelectedTripId(''); 
                              setSelectedRouteId('');
                              setDiscountValue(0); 
                              setCouponCode(''); 
                              setSaleIdBeingEdited(null);
                              setSalesRefreshKey(prev => prev + 1);
                          }} className="px-10 py-5 bg-white dark:bg-zinc-800 border-2 border-slate-900 dark:border-zinc-700 rounded-3xl font-black uppercase text-xs hover:bg-slate-50 dark:text-white transition-colors">Nova Passagem</button>
                      </div>
                  </div>
                  {/* Pré-visualização A4 */}
                  <div className="max-w-[210mm] mx-auto bg-white p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-0">
                      <TicketVoucher type="passageiro" lastTicket={lastTicket} selectedRoute={lastTicket.route_data || selectedRoute} selectedTrip={lastTicket.trip_data || selectedTrip} />
                      <div className="border-t-4 border-dashed border-slate-300 my-12 flex items-center justify-center relative">
                          <div className="absolute -top-4 bg-white px-4 flex items-center gap-2 text-slate-300 font-black text-[10px] uppercase">
                              <Scissors size={16}/> Recortar Via do Motorista
                          </div>
                      </div>
                      <TicketVoucher type="motorista" lastTicket={lastTicket} selectedRoute={lastTicket.route_data || selectedRoute} selectedTrip={lastTicket.trip_data || selectedTrip} />
                  </div>
              </div>
          ) : activeView === 'historico' ? (
              <div className="animate-in fade-in space-y-6">
                   <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 shadow-sm">
                       <div>
                           <h3 className="text-xl font-black uppercase italic dark:text-white">Histórico de Vendas</h3>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerencie e re-emita passagens vendidas</p>
                       </div>
                       <div className="relative w-72">
                           <input 
                               placeholder="BUSCAR NOME OU CPF..." 
                               className="w-full pl-12 pr-6 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent focus:border-yellow-400 rounded-2xl font-black text-[10px] uppercase outline-none dark:text-white transition-all"
                               value={historySearchTerm}
                               onChange={e => setHistorySearchTerm(e.target.value)}
                           />
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       </div>
                   </div>

                   <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xl">
                       <div className="overflow-x-auto">
                           <table className="w-full text-left">
                               <thead className="bg-slate-50 dark:bg-zinc-800 border-b-2 border-slate-100 dark:border-zinc-700">
                                   <tr>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data/Hora</th>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID</th>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Passageiro</th>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Poltrona</th>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Valor</th>
                                       <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y border-slate-50 dark:border-zinc-800">
                                   {isLoadingHistory ? (
                                       <tr>
                                           <td colSpan={6} className="px-6 py-20 text-center">
                                               <Loader2 className="animate-spin inline-block text-yellow-500 mb-2" size={32} />
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Carregando histórico...</p>
                                           </td>
                                       </tr>
                                   ) : allSales.filter(s => 
                                       normalize(s.passenger_name || '').includes(normalize(historySearchTerm)) ||
                                       (s.passenger_cpf || '').includes(historySearchTerm) ||
                                       s.id.includes(historySearchTerm)
                                   ).length === 0 ? (
                                       <tr>
                                           <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-black uppercase text-[10px] italic tracking-widest opacity-40">Nenhuma venda encontrada para os filtros aplicados.</td>
                                       </tr>
                                   ) : (
                                       allSales.filter(s => 
                                           normalize(s.passenger_name || '').includes(normalize(historySearchTerm)) ||
                                           (s.passenger_cpf || '').includes(historySearchTerm) ||
                                           s.id.includes(historySearchTerm)
                                       ).map(sale => (
                                           <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                               <td className="px-6 py-4">
                                                   <span className="text-[10px] font-black dark:text-white block">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</span>
                                                   <span className="text-[9px] font-bold text-slate-400">{new Date(sale.created_at).toLocaleTimeString('pt-BR')}</span>
                                               </td>
                                               <td className="px-6 py-4">
                                                   <span className="text-[10px] font-black text-yellow-600">#{sale.id.slice(-8).toUpperCase()}</span>
                                               </td>
                                               <td className="px-6 py-4">
                                                   <span className="text-[10px] font-black dark:text-zinc-100 uppercase block">{sale.passenger_name || 'N/D'}</span>
                                                   <span className="text-[9px] font-bold text-slate-400">{sale.passenger_cpf || '---'}</span>
                                               </td>
                                               <td className="px-6 py-4">
                                                   <div className="w-8 h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-black text-slate-900 dark:text-white text-[10px]">
                                                       {sale.seat_number.toString().padStart(2, '0')}
                                                   </div>
                                               </td>
                                               <td className="px-6 py-4">
                                                   <span className="text-[10px] font-black text-emerald-600">R$ {sale.total_price.toFixed(2)}</span>
                                                   <span className="text-[8px] font-bold text-slate-400 uppercase italic block">{sale.payment_method}</span>
                                               </td>
                                               <td className="px-6 py-4 text-right">
                                                   <div className="flex justify-end gap-2">
                                                       <button 
                                                           onClick={() => handleEditSaleHistory(sale)}
                                                           className="p-3 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl text-indigo-600 hover:border-indigo-400 transition-all shadow-sm"
                                                           title="Editar Passagem"
                                                       >
                                                           <Edit3 size={16} />
                                                       </button>
                                                       <button 
                                                           onClick={() => {
                                                               setLastTicket(sale);
                                                               setActiveView('bilhete');
                                                           }}
                                                           className="p-3 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white hover:border-yellow-400 transition-all shadow-sm"
                                                           title="Visualizar Bilhete"
                                                       >
                                                           <Printer size={16} />
                                                       </button>
                                                       <button 
                                                           onClick={() => generateTicketPdf(sale.id, sale.origin_name || '', sale.destination_name || '')}
                                                           className="p-3 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-xl hover:scale-110 transition-all shadow-md"
                                                           title="Download PDF"
                                                       >
                                                           <Download size={16} />
                                                       </button>
                                                   </div>
                                               </td>
                                           </tr>
                                       ))
                                   )}
                               </tbody>
                           </table>
                       </div>
                   </div>

                   {/* Old edit modal removed */}
              </div>
          ) : (
              <div className="space-y-8">
                  {/* Resumo da Viagem Selecionada */}
                  {selectedRoute && (
                      <div className="animate-in fade-in slide-in-from-top-4 bg-slate-900 text-white p-6 rounded-3xl border-2 border-yellow-400 flex flex-wrap items-center justify-between gap-6 shadow-xl">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-yellow-400 rounded-2xl text-slate-900">
                                  <Bus size={24} />
                              </div>
                              <div>
                                  <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest leading-none mb-1">Origem / Destino</p>
                                  <h4 className="text-xl font-black uppercase italic leading-none">
                                       {(selectedSection ? selectedSection.origin : selectedRoute.origin || '').toUpperCase()} 
                                       <ArrowRight size={16} className="inline mx-1" /> 
                                       {(selectedSection ? selectedSection.destination : selectedRoute.destination || '').toUpperCase()}
                                       {selectedSection && <span className="ml-2 text-[10px] not-italic bg-blue-600 text-white px-2 py-0.5 rounded-md">SEÇÃO</span>}
                                   </h4>
                              </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-8">
                              <div className="text-center md:text-left">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa</p>
                                  <div className="flex items-center gap-2">
                                      <Home size={16} className="text-yellow-400" />
                                      <span className="text-sm font-black uppercase italic">{selectedCompany?.name || '---'}</span>
                                  </div>
                              </div>
                              {selectedTrip && (
                                <>
                                  <div className="text-center md:text-left">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Partida</p>
                                      <div className="flex items-center gap-2">
                                          <Clock size={16} className="text-yellow-400" />
                                          <span className="text-lg font-black font-mono">{selectedTrip.departure_time}</span>
                                      </div>
                                  </div>
                                  <div className="text-center md:text-left">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Veículo</p>
                                      <div className="flex items-center gap-2">
                                          <Tag size={16} className="text-yellow-400" />
                                          <span className="text-lg font-black uppercase italic">#{selectedTrip.bus_number}</span>
                                      </div>
                                  </div>
                                </>
                              )}
                              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 min-w-[200px]">
                                  <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-3">Composição de Preço</p>
                                  <div className="space-y-2">
                                      <div className="flex justify-between items-center gap-4">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase">Tarifa Base:</span>
                                          <span className="text-sm font-black">R$ {
                                              (() => {
                                                  const toll = selectedRoute.toll || 0;
                                                  const boarding = selectedRoute.boarding_fee || 0;
                                                  const fees = selectedRoute.fees || 0;
                                                  if (selectedSection) {
                                                      return Math.max(0, (selectedSection.price || 0) - toll - boarding - fees).toFixed(2);
                                                  }
                                                  return (selectedRoute.price || 0).toFixed(2);
                                              })()
                                          }</span>
                                      </div>
                                      <div className="flex justify-between items-center gap-4">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pedágio:</span>
                                          <span className="text-sm font-black">R$ {(selectedRoute.toll || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center gap-4">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase">Embarque:</span>
                                          <span className="text-sm font-black">R$ {(selectedRoute.boarding_fee || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="border-t border-slate-700 pt-2 flex justify-between items-center gap-4">
                                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">Total Unit:</span>
                                          <span className="text-lg font-black text-emerald-400">R$ {
                                              (selectedSection 
                                                  ? (selectedSection.price || 0) 
                                                  : ((selectedRoute.price || 0) + (selectedRoute.toll || 0) + (selectedRoute.boarding_fee || 0) + (selectedRoute.fees || 0))
                                              ).toFixed(2)
                                          }</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {step === 1 && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div id="tour-tickets-search-box" className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-yellow-400 md:col-span-3">
                                  <h3 className="text-xl font-black uppercase italic mb-8 text-left dark:text-white flex items-center gap-3">
                                    <Search size={24} className="text-yellow-500"/> Consulta de Itinerário
                                  </h3>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                      <div ref={originRef} className="relative">
                                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Origem</label>
                                          <input 
                                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xs outline-none focus:border-yellow-400 dark:text-white transition-all"
                                            value={originSearch || ''}
                                            onChange={e => { 
                                               setOriginSearch((e.target.value || '').toUpperCase()); 
                                               setShowOriginDropdown(true);
                                             }}
                                             onFocus={() => setShowOriginDropdown(true)}
                                            placeholder="DIGITE A ORIGEM"
                                          />
                                          {showOriginDropdown && originSearch && (
                                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                                  {availableOrigins.map(o => (
                                                      <button key={o} onClick={() => { setOriginSearch(o); setShowOriginDropdown(false); }} className="w-full px-6 py-3 text-left text-[10px] font-black uppercase hover:bg-yellow-400 hover:text-slate-900 transition-colors dark:text-white dark:hover:text-slate-900">
                                                          {o}
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <div ref={destinationRef} className="relative">
                                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Destino</label>
                                          <input 
                                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xs outline-none focus:border-yellow-400 dark:text-white transition-all disabled:opacity-50"
                                            value={destinationSearch || ''}
                                            onChange={e => {
                                               setDestinationSearch((e.target.value || '').toUpperCase());
                                               setShowDestinationDropdown(true);
                                             }}
                                             onFocus={() => setShowDestinationDropdown(true)}
                                            disabled={!originSearch}
                                            placeholder="DIGITE O DESTINO"
                                          />
                                          {showDestinationDropdown && destinationSearch && (
                                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                                  {availableDestinations.map(d => (
                                                      <button key={d} onClick={() => { setDestinationSearch(d); setShowDestinationDropdown(false); }} className="w-full px-6 py-3 text-left text-[10px] font-black uppercase hover:bg-yellow-400 hover:text-slate-900 transition-colors dark:text-white dark:hover:text-slate-900">
                                                          {d}
                                                      </button>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <div>
                                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data da Viagem</label>
                                          <input 
                                            type="date" 
                                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xs outline-none focus:border-yellow-400 dark:text-white transition-all"
                                            value={saleDate || ''}
                                            onChange={e => setSaleDate(e.target.value)}
                                          />
                                      </div>
                                  </div>

                                  <div className="space-y-3">
                                      {showNoRoutesMessage ? (
                                          <div className="py-12 text-center bg-red-50 dark:bg-red-900/10 border-2 border-dashed border-red-200 dark:border-red-800 rounded-3xl flex flex-col items-center gap-4">
                                              <p className="text-[10px] font-black text-red-600 uppercase italic tracking-widest">Nenhuma viagem para a rota selecionada.</p>
                                              <button onClick={() => { setOriginSearch(''); setDestinationSearch(''); setShowNoRoutesMessage(false); }} className="px-6 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase">Retornar à tela principal</button>
                                          </div>
                                      ) : filteredRoutes.length === 0 ? (
                                          <div className="py-12 text-center text-slate-400 font-black uppercase text-[10px] italic tracking-widest opacity-40 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                                              {originSearch && destinationSearch ? "Nenhuma rota direta ou seção encontrada para este trecho." : "Digite origem e destino para consultar horários."}
                                          </div>
                                      ) : (
                                          filteredRoutes.map((r, idx) => {
                                              const company = companies.find(c => c.id === r.company_id);
                                              // Determine if it's a direct route or a section
                                              const oSearch = (originSearch || '').toUpperCase();
                                              const dSearch = (destinationSearch || '').toUpperCase();
                                              
                                              const isDirectIda = (r.origin || '').toUpperCase() === oSearch && (r.destination || '').toUpperCase() === dSearch;
                                              const isDirectVolta = (r.destination || '').toUpperCase() === oSearch && (r.origin || '').toUpperCase() === dSearch;
                                              const isDirect = isDirectIda || isDirectVolta;
                                              
                                              const sectionIda = r.sections?.find(s => (s.origin || '').toUpperCase() === oSearch && (s.destination || '').toUpperCase() === dSearch);
                                              const sectionVolta = r.sections?.find(s => (s.destination || '').toUpperCase() === oSearch && (s.origin || '').toUpperCase() === dSearch);
                                              
                                              const finalSection = sectionIda || sectionVolta;
                                              const isMainRoute = isDirect;
                                              
                                              return (
                                                  <button key={r.id || idx} onClick={() => { 
                                                      const nOSearch = normalize(originSearch || '');
                                                      const nDSearch = normalize(destinationSearch || '');
                                                      const rOrig = normalize(r.origin || '');
                                                      const rDest = normalize(r.destination || '');
                                                      
                                                      setSelectedRouteId(r.id);
                                                      
                                                      // Detect direction and section
                                                      const isMatchIda = rOrig === nOSearch && rDest === nDSearch;
                                                      const isMatchVolta = rDest === nOSearch && rOrig === nDSearch;
                                                      
                                                      if (isMatchIda) {
                                                          setSelectedDirection('IDA');
                                                          setSelectedSectionIndex(-1);
                                                      } else if (isMatchVolta) {
                                                          setSelectedDirection('VOLTA');
                                                          setSelectedSectionIndex(-1);
                                                      } else {
                                                          // Check sections
                                                          const sIdxIda = r.sections?.findIndex(s => normalize(s.origin || '') === nOSearch && normalize(s.destination || '') === nDSearch);
                                                          if (sIdxIda !== undefined && sIdxIda !== -1) {
                                                              setSelectedDirection('IDA');
                                                              setSelectedSectionIndex(sIdxIda);
                                                          } else {
                                                              const sIdxVolta = r.sections?.findIndex(s => normalize(s.destination || '') === nOSearch && normalize(s.origin || '') === nDSearch);
                                                              if (sIdxVolta !== undefined && sIdxVolta !== -1) {
                                                                  setSelectedDirection('VOLTA');
                                                                  setSelectedSectionIndex(sIdxVolta);
                                                              }
                                                          }
                                                      }
                                                      setStep(2);
                                                  }} className={`w-full flex items-center justify-between p-6 bg-white dark:bg-zinc-900 rounded-3xl border-2 transition-all group ${selectedRouteId === r.id ? 'border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10' : 'border-transparent hover:border-yellow-400 shadow-sm'}`}>
                                                      <div className="text-left">
                                                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Linha {r.prefixo_linha} • {company?.name}</p>
                                                          <p className="font-black text-lg uppercase italic dark:text-white">
                                                            {originSearch} <ArrowRight size={14} className="inline mx-1 opacity-40" /> {destinationSearch}
                                                            {!isMainRoute && <span className="ml-3 text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded-md not-italic">SEÇÃO</span>}
                                                          </p>
                                                      </div>
                                                      <div className="flex items-center gap-6">
                                                          <div className="text-right">
                                                              <p className="text-[8px] font-black text-slate-400 uppercase">Tarifa Integral</p>
                                                              <p className="text-lg font-black text-emerald-600">R$ {isMainRoute ? ((r.price || 0) + (r.boarding_fee || 0) + (r.toll || 0) + (r.fees || 0)).toFixed(2) : ((finalSection?.price || 0) + (finalSection?.boarding_fee || 0) + (finalSection?.toll || 0)).toFixed(2)}</p>
                                                          </div>
                                                          <ChevronRight size={24} className="text-slate-300 group-hover:text-yellow-500 transition-colors"/>
                                                      </div>
                                                  </button>
                                              );
                                          })
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {step === 1.5 && selectedRoute && selectedRoute.sections && selectedRoute.sections.length > 0 && (
                      <div className="animate-in fade-in space-y-6">
                          <button onClick={() => { setStep(1); setSelectedRouteId(''); }} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para linhas</button>
                          <div className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-yellow-400">
                              <h3 className="text-xl font-black uppercase italic mb-8 dark:text-white">Selecione a Seção</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {selectedRoute.sections.map((section, idx) => (
                                      <button 
                                          key={idx} 
                                          onClick={() => { setSelectedSectionIndex(idx); setStep(2); }}
                                          className={`p-8 bg-white dark:bg-zinc-800 rounded-3xl border-4 border-transparent hover:border-yellow-400 shadow-sm transition-all text-center ${selectedSectionIndex === idx ? 'border-indigo-500' : ''}`}
                                      >
                                          <span className="text-xl font-black font-mono dark:text-white leading-none">{section.name}</span>
                                          <p className="text-[9px] font-black text-slate-400 uppercase mt-2">R$ {((section.price || 0) + (section.boarding_fee || 0)).toFixed(2)}</p>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}


                  {step === 2 && (
                      <div className="animate-in fade-in space-y-6">
                          <button onClick={() => setStep(1)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para linhas</button>
                          
                          {selectedRoute?.sections && selectedRoute.sections.length > 0 && (
                            <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-[2rem] border-2 border-yellow-400 mb-6 shadow-sm">
                                <label className="block text-[10px] font-black text-indigo-500 uppercase mb-2 ml-2 tracking-widest">Trecho / Seção Selecionada</label>
                                <select 
                                    className="w-full px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xs outline-none focus:border-yellow-400 dark:text-white uppercase transition-all"
                                    value={selectedSectionIndex}
                                    onChange={(e) => {
                                        const newIndex = Number(e.target.value);
                                        setSelectedSectionIndex(newIndex);
                                        if (newIndex !== -1 && selectedRoute.sections) {
                                            const s = selectedRoute.sections[newIndex];
                                            setOriginSearch(s.origin.toUpperCase());
                                            setDestinationSearch(s.destination.toUpperCase());
                                        } else {
                                            setOriginSearch(selectedRoute.origin.toUpperCase());
                                            setDestinationSearch(selectedRoute.destination.toUpperCase());
                                        }
                                    }}
                                >
                                    <option value={-1}>{selectedRoute.origin} - {selectedRoute.destination} (Rota Completa)</option>
                                    {selectedRoute.sections.map((s, idx) => (
                                        <option key={idx} value={idx}>{s.origin} - {s.destination} (R$ {((s.price || 0) + (s.toll || 0) + (s.boarding_fee || 0)).toFixed(2)})</option>
                                    ))}
                                </select>
                            </div>
                          )}

                          <div className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-yellow-400">
                              <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                                  <h3 className="text-xl font-black uppercase italic dark:text-white">Horários Disponíveis</h3>
                                  <input type="date" className="bg-white dark:bg-zinc-800 border-2 border-yellow-400 px-6 py-3 rounded-2xl font-black text-xs outline-none dark:text-white" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                              </div>
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {(() => {
                                      const filteredTrips = effectiveTrips.filter(t => {
                                          const matchesRoute = t.route_id === selectedRouteId;
                                          const tripDatePart = t.trip_date ? t.trip_date.split('T')[0] : '';
                                          const matchesDate = tripDatePart === saleDate || (t.trip_date && t.trip_date.startsWith(saleDate));
                                          const tripDir = (t.direction || 'IDA').toUpperCase();
                                          const matchesDirection = tripDir === selectedDirection.toUpperCase();
                                          return matchesRoute && matchesDate && matchesDirection && t.status !== 'Cancelada';
                                      });

                                      const getDayOfWeek = (dateStr: string) => {
                                        const date = new Date(dateStr + 'T00:00:00');
                                        return date.getDay();
                                      };
                                      
                                      const dow = getDayOfWeek(saleDate);
                                      let scheduledTimes: {time: string, direction: 'IDA' | 'VOLTA'}[] = [];
                                      if (selectedRoute && selectedRoute.schedule) {
                                        if (dow === 0) scheduledTimes = selectedRoute.schedule.sunday || [];
                                        else if (dow === 6) scheduledTimes = selectedRoute.schedule.saturday || [];
                                        else scheduledTimes = selectedRoute.schedule.weekdays || [];
                                      }
                                      
                                      const timesFromTrips = new Set(filteredTrips.map(t => t.departure_time));
                                      const missingScheduledTimes = scheduledTimes.filter(st => !timesFromTrips.has(st.time) && (st.direction || 'IDA').toUpperCase() === selectedDirection.toUpperCase());

                                      if (filteredTrips.length === 0 && missingScheduledTimes.length === 0) {
                                          return <div className="col-span-full py-20 text-center text-slate-400 font-black uppercase text-xs italic tracking-widest opacity-40">Sem escalas registradas ou programadas para esta data e direção ({selectedDirection}).</div>;
                                      }

                                      return (
                                         <>
                                           {filteredTrips.map((t, idx) => {
                                               const isCompleted = t.finished || t.status === 'Concluída';
                                               const isInProgress = (t.status === 'Em Andamento' || t.status === 'Em Rota') && !t.finished;
                                               return (
                                                   <button 
                                                     key={`${t.id || 'trip'}-${idx}`} 
                                                     onClick={() => { 
                                                       if (isCompleted) return;
                                                       setSelectedTripId(t.id); 
                                                       setIsPresale(false); 
                                                       setStep(3); 
                                                     }} 
                                                     disabled={isCompleted}
                                                     className={`p-6 rounded-3xl border-4 transition-all text-center relative ${
                                                       isCompleted 
                                                         ? 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 opacity-50 cursor-not-allowed' 
                                                         : isInProgress
                                                           ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 hover:border-emerald-500 shadow-md'
                                                           : 'bg-white dark:bg-zinc-800 border-transparent hover:border-yellow-400 shadow-sm'
                                                     }`}
                                                   >
                                                       <span className="text-2xl font-black font-mono dark:text-white leading-none block">{t.departure_time}</span>
                                                       <div className="mt-2 space-y-1">
                                                         <p className="text-[9px] font-black text-slate-600 dark:text-zinc-300 uppercase">Carro {t.bus_number} • {t.direction || 'IDA'}</p>
                                                         {t.driver_name && (
                                                           <p className="text-[8px] font-bold text-slate-700 dark:text-zinc-200 truncate">
                                                             Mot: {t.driver_name}
                                                           </p>
                                                         )}
                                                         {t.conductor_name && t.conductor_name !== 'Não atribuído' && t.conductor_name !== 'Nenhum' && (
                                                           <p className="text-[8px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                                                             Cob: {t.conductor_name}
                                                           </p>
                                                         )}
                                                         {isInProgress ? (
                                                           <span className="inline-block px-2 py-0.5 bg-emerald-500 text-white font-extrabold rounded-md text-[8px] uppercase animate-pulse">
                                                             Em Rota
                                                           </span>
                                                         ) : isCompleted ? (
                                                           <span className="inline-block px-2 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-extrabold rounded-md text-[8px] uppercase">
                                                             Encerrada
                                                           </span>
                                                         ) : (
                                                           <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold rounded-md text-[8px] uppercase">
                                                             Escala Ativa
                                                           </span>
                                                         )}
                                                       </div>
                                                   </button>
                                               );
                                           })}
                                           {missingScheduledTimes.map((st, idx) => (
                                               <button key={`sched-${idx}`} onClick={() => { 
                                                   setSelectedTripId(`PRESALE_${selectedRouteId}_${st.time}_${st.direction}_${saleDate}`); 
                                                   setPresaleTime(st.time);
                                                   setIsPresale(true); 
                                                   setStep(3); 
                                               }} className="p-8 bg-white dark:bg-zinc-800 rounded-3xl border-4 border-dashed border-slate-200 dark:border-zinc-700 hover:border-yellow-400 shadow-sm transition-all text-center group">
                                                   <span className="text-3xl font-black font-mono text-slate-400 group-hover:text-yellow-600 leading-none">{st.time}</span>
                                                   <p className="text-[9px] font-black text-yellow-400 uppercase mt-2">Pré-venda ({selectedDirection})</p>
                                               </button>
                                           ))}
                                        </>
                                      );
                                  })()}
                              </div>
                          </div>
                       </div>
                   )}

                   {step === 3 && (
                      <div className="animate-in fade-in space-y-6">
                           <button onClick={() => setStep(2)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para horários</button>
                           <div className="bg-slate-50 dark:bg-zinc-900 p-4 md:p-8 rounded-[4rem] border-2 border-yellow-400">
                               <h3 className="text-xl font-black uppercase italic mb-8 dark:text-white text-left ml-4">Mapa de Ocupação</h3>
                               <div className="flex flex-col items-center w-full"><SeatMap /></div>
                               <div className="flex justify-end mt-12 px-4">
                                    <button disabled={selectedSeats.length === 0} onClick={() => setStep(4)} className="px-16 py-5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-yellow-400 disabled:opacity-30">Confirmar Poltrona</button>
                               </div>
                           </div>
                      </div>
                  )}

                  {step === 4 && (
                      <div className="animate-in slide-in-from-right duration-500 space-y-6">
                           <button onClick={() => setStep(3)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para assento</button>
                           <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-[3rem] border-4 border-yellow-400 shadow-2xl">
                               <h3 className="text-3xl font-black uppercase italic mb-10 text-left dark:text-white">Identificação Civil</h3>
                               
                               <div className="space-y-12">
                                  {selectedSeats.map((seat, idx) => (
                                    <div key={seat} className={`space-y-8 ${idx > 0 ? 'mt-12 pt-12 border-t-4 border-dashed border-slate-100 dark:border-zinc-800' : ''}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center font-black text-slate-900 text-lg shadow-lg">
                                                {seat.toString().padStart(2, '0')}
                                            </div>
                                            <h4 className="text-xl font-black uppercase italic dark:text-white">Passageiro da Poltrona {seat}</h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">CPF ou Registro *</label>
                                                <input placeholder="000.000.000-00" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.cpf || ''} onChange={e => handleCpfSearch(seat, e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Nome do Passageiro *</label>
                                                <input placeholder="NOME COMPLETO" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none focus:border-indigo-500 text-lg dark:text-white" value={passengerForms[seat]?.full_name || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], full_name: e.target.value, seat_number: seat } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Nascimento *</label>
                                                <input type="date" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.birth_date || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], birth_date: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Telefone *</label>
                                                <input placeholder="(00) 0 0000-0000" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.phone || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], phone: phoneMask(e.target.value) } as any })} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">E-mail</label>
                                                <input placeholder="email@exemplo.com" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.email || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], email: e.target.value.toLowerCase() } as any })} />
                                            </div>

                                            {passengerForms[seat]?.birth_date && (
                                                <div className="md:col-span-2 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl">
                                                    <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase flex items-center gap-2">
                                                        <Info size={16}/> 
                                                        {calculateAge(passengerForms[seat].birth_date) >= 18 ? 
                                                            "Maior de 18: solicite identidade e cpf ou algum documento com foto" :
                                                            calculateAge(passengerForms[seat].birth_date) >= 16 ?
                                                            "Entre 16 e 17: solicite identidade e cpf ou algum documento com foto e uma declaração para viagem do menor com xerox do responsável que preencheu a ficha" :
                                                            "Menor ou igual a 15 anos: solicite identidade e cpf ou algum documento com foto do menor e do responsável e uma declaração para viagem do menor com xerox do responsável que preencheu a ficha"
                                                        }
                                                    </p>
                                                </div>
                                            )}

                                            {passengerForms[seat]?.birth_date && calculateAge(passengerForms[seat].birth_date) < 17 && (
                                                <>
                                                    <div className="md:col-span-2 border-t-2 border-slate-100 dark:border-zinc-800 pt-8 mt-4">
                                                        <h4 className="text-sm font-black uppercase italic mb-6 text-left dark:text-white">Dados do Responsável</h4>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Nome do Responsável *</label>
                                                        <input placeholder="NOME COMPLETO DO RESPONSÁVEL" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.responsible_name || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], responsible_name: e.target.value } as any })} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Nascimento do Responsável *</label>
                                                        <input type="date" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.responsible_birth_date || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], responsible_birth_date: e.target.value } as any })} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Grau de Parentesco *</label>
                                                        <input placeholder="EX: PAI, MÃE, AVÔ" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.relationship || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], relationship: e.target.value } as any })} />
                                                    </div>
                                                </>
                                            )}
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">CEP *</label>
                                                <div className="relative">
                                                    <input placeholder="00.000-000" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.cep || ''} onChange={e => handleCepChange(seat, e.target.value)} />
                                                    {isLoadingCep && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" size={24} />}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Rua *</label>
                                                <input placeholder="LOGRADOURO" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.street || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], street: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Número *</label>
                                                <input placeholder="Nº" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.number || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], number: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Complemento</label>
                                                <input placeholder="APTO / BLOCO" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.complement || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], complement: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Bairro *</label>
                                                <input placeholder="BAIRRO" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.neighborhood || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], neighborhood: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Cidade *</label>
                                                <input placeholder="CIDADE" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.city || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], city: e.target.value } as any })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Estado *</label>
                                                <input placeholder="UF" className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-3xl font-black outline-none text-lg dark:text-white" value={passengerForms[seat]?.state || ''} onChange={e => setPassengerForms({ ...passengerForms, [seat]: { ...passengerForms[seat], state: e.target.value } as any })} />
                                            </div>
                                        </div>
                                    </div>
                                  ))}
                               </div>

                               <div className="mt-12 flex justify-end">
                                    <button 
                                        disabled={selectedSeats.some(s => !passengerForms[s]?.full_name || !passengerForms[s]?.cpf)} 
                                        onClick={() => setStep(5)} 
                                        className="px-16 py-5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-yellow-400"
                                    >
                                        Ir para Pagamento
                                    </button>
                               </div>
                           </div>
                      </div>
                  )}

                  {step === 5 && (
                      <div className="animate-in slide-in-from-right duration-500 space-y-6">
                           <button onClick={() => setStep(4)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para identificação</button>
                           <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-[3rem] border-4 border-yellow-400 shadow-2xl">
                                  <h3 className="text-3xl font-black uppercase italic mb-10 text-left dark:text-white">Pagamento & Vantagens</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                       <div className="space-y-6">
                                           <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block text-left">Forma de Pagamento</label>
                                           <div className="space-y-4">
                                               <button 
                                                 onClick={() => setShowPaymentModal(true)}
                                                 className="w-full py-6 px-10 bg-slate-50 dark:bg-zinc-800 border-4 border-yellow-400 rounded-3xl flex items-center justify-between group hover:bg-yellow-400 transition-all"
                                               >
                                                   <div className="flex items-center gap-4">
                                                       <div className="p-3 bg-yellow-400 dark:bg-zinc-700 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                                           {paymentMethod.toUpperCase().includes('CREDITO') ? <CreditCard size={24}/> : 
                                                            paymentMethod.toUpperCase().includes('PIX') ? <Disc size={24}/> : 
                                                            paymentMethod.toUpperCase().includes('IMPCARD') ? <CreditCard size={24}/> : 
                                                            (paymentMethod.toUpperCase().includes('VALE_TRANSPORTE') || paymentMethod.toUpperCase().includes('VALE TRANSPORTE')) ? <Bus size={24}/> : <Wallet size={24}/>}
                                                       </div>
                                                       <div className="text-left">
                                                           <p className="text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-900">Selecionar</p>
                                                           <p className="text-lg font-black uppercase italic dark:text-white group-hover:text-slate-900">{paymentMethod.replace(/_/g, ' ')}</p>
                                                       </div>
                                                   </div>
                                                   <ChevronRight size={24} className="text-yellow-400 group-hover:text-slate-900 transition-colors" />
                                               </button>

                                               {paymentMethod.toUpperCase().replace(/[ ]/g, '_') === 'DINHEIRO' && (
                                                   <div className="p-6 bg-emerald-400/10 border-2 border-emerald-400 rounded-[2rem] animate-in zoom-in-95 duration-300">
                                                       <label className="text-[10px] font-black uppercase text-emerald-600 mb-2 block tracking-widest">Calculadora de Troco (Opcional)</label>
                                                       <div className="grid grid-cols-2 gap-4">
                                                           <div>
                                                               <label className="text-[8px] font-black uppercase text-slate-400 mb-1 block ml-2">Valor Recebido</label>
                                                               <div className="relative">
                                                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">R$</span>
                                                                   <input 
                                                                       type="number"
                                                                       placeholder="0,00" 
                                                                       className="w-full pl-10 pr-6 py-4 bg-white dark:bg-zinc-950 border-2 border-emerald-400 rounded-2xl font-black outline-none focus:ring-4 ring-emerald-400/20 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                       value={amountReceived || ''}
                                                                       onChange={e => setAmountReceived(Number(e.target.value))}
                                                                   />
                                                               </div>
                                                           </div>
                                                           <div>
                                                               <label className="text-[8px] font-black uppercase text-slate-400 mb-1 block ml-2">Troco do Passageiro</label>
                                                               <div className="w-full px-5 py-2 bg-emerald-600 text-white rounded-2xl font-black flex flex-col justify-center shadow-md h-12">
                                                                   <span className="text-[8px] uppercase opacity-70">Troco Sugerido</span>
                                                                   <span className="text-base leading-none mt-0.5">R$ {changeAmount.toFixed(2)}</span>
                                                               </div>
                                                           </div>
                                                       </div>
                                                       <p className="mt-3 text-[8px] font-black uppercase text-emerald-600/60 text-center italic">O sistema calcula o troco baseado no valor total líquido</p>
                                                   </div>
                                               )}

                                               {(paymentMethod.toUpperCase().replace(/[ ]/g, '_') === 'VALE_TRANSPORTE' || paymentMethod.toUpperCase().replace(/[ ]/g, '_') === 'VALE TRANSPORTE') && (
                                                   <div className="p-6 bg-blue-400/10 border-2 border-blue-400 rounded-[2rem] animate-in zoom-in-95 duration-300">
                                                       <label className="text-[10px] font-black uppercase text-blue-600 mb-2 block">Identificação Vale Transporte</label>
                                                       <div className="space-y-4">
                                                           <input 
                                                               placeholder="CPF OU NÚMERO DO CARTÃO" 
                                                               className="w-full px-6 py-4 bg-white dark:bg-zinc-950 border-2 border-blue-400 rounded-2xl font-black uppercase outline-none focus:ring-4 ring-blue-400/20 dark:text-white"
                                                               value={vtIdentifier}
                                                               onChange={e => {
                                                                   const val = e.target.value;
                                                                   if (/^\d+$/.test(val.replace(/\D/g, '')) && val.replace(/\D/g, '').length <= 11) {
                                                                       setVtIdentifier(cpfMask(val));
                                                                   } else {
                                                                       setVtIdentifier(val);
                                                                   }
                                                               }}
                                                           />
                                                           <button 
                                                               disabled={isVerifyingVt || !vtIdentifier}
                                                               onClick={async () => {
                                                                   setIsVerifyingVt(true);
                                                                   try {
                                                                       await new Promise(r => setTimeout(r, 1000));
                                                                       const cards = await db.getImpCards();
                                                                       const card = cards.find(c => c.cpf === vtIdentifier || c.card_number === vtIdentifier);
                                                                       
                                                                       if (!card) {
                                                                           addToast("Cartão Vale Transporte não encontrado", "error");
                                                                       } else {
                                                                           const total = getGrandTotal(false);
                                                                           if (card.balance < total) {
                                                                               addToast("Saldo Insuficiente", "error");
                                                                           } else {
                                                                               addToast(`Vale Transporte Validado (Saldo: R$ ${card.balance.toFixed(2)})`, "success");
                                                                           }
                                                                       }
                                                                   } finally {
                                                                       setIsVerifyingVt(false);
                                                                   }
                                                               }}
                                                               className="w-full px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                           >
                                                               {isVerifyingVt ? <Loader2 size={16} className="animate-spin" /> : 'Consultar'}
                                                           </button>
                                                       </div>
                                                       <p className="mt-2 text-[8px] font-black uppercase text-blue-600/60 text-center italic">Consulte o CPF ou Matrícula para validar o benefício. O desconto no cartão será realizado apenas ao finalizar a venda.</p>
                                                   </div>
                                               )}

                                               {paymentMethod === 'IMPCARD' && (
                                                   <div className="p-6 bg-yellow-400/10 border-2 border-yellow-400 rounded-[2rem] animate-in zoom-in-95 duration-300">
                                                       <label className="text-[10px] font-black uppercase text-yellow-600 mb-2 block">Identificação ImpCard</label>
                                                       <div className="flex gap-2">
                                                           <input 
                                                               placeholder="CPF OU MATRÍCULA" 
                                                               className="flex-1 px-6 py-4 bg-white dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-black uppercase outline-none focus:ring-4 ring-yellow-400/20 dark:text-white"
                                                               value={impCardIdentifier}
                                                               onChange={e => setImpCardIdentifier(e.target.value)}
                                                           />
                                                           <button 
                                                               disabled={isVerifyingImpCard || !impCardIdentifier}
                                                               onClick={async () => {
                                                                   setIsVerifyingImpCard(true);
                                                                   try {
                                                                       const cards = await db.getImpCards();
                                                                       const card = cards.find(c => c.cpf === impCardIdentifier || c.card_number === impCardIdentifier);
                                                                       if (card) {
                                                                           addToast(`ImpCard Validado! Saldo: R$ ${card.balance.toFixed(2)}`, "success");
                                                                       } else {
                                                                           addToast("Cartão não encontrado.", "error");
                                                                       }
                                                                   } finally {
                                                                       setIsVerifyingImpCard(false);
                                                                   }
                                                               }}
                                                               className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] disabled:opacity-50"
                                                           >
                                                               {isVerifyingImpCard ? <Loader2 size={20} className="animate-spin" /> : 'Validar'}
                                                           </button>
                                                       </div>
                                                   </div>
                                               )}
                                           </div>
                                       </div>
                                       <div className="bg-slate-50 dark:bg-zinc-800 p-8 rounded-[2rem] border-2 border-dashed border-indigo-400/50 flex flex-col justify-center">
                                           <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block flex items-center gap-2"><Tag size={16}/> Cupom de Desconto</label>
                                           <div className="space-y-4">
                                               <input 
                                                   placeholder="CODIGO10" 
                                                   className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border-2 border-indigo-200 dark:border-indigo-900 rounded-xl font-black uppercase outline-none focus:border-indigo-500 dark:text-white transition-all disabled:opacity-50" 
                                                   disabled={isApplyingCoupon}
                                                   value={couponCode || ''} 
                                                   onChange={e => setCouponCode(e.target.value.toUpperCase())} 
                                               />
                                               <div className="flex gap-2">
                                                   <button 
                                                       onClick={handleApplyCoupon} 
                                                       disabled={!couponCode || isApplyingCoupon}
                                                       className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                   >
                                                       {isApplyingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar Cupom'}
                                                   </button>
                                                   {discountValue > 0 && !isApplyingCoupon && (
                                                       <button 
                                                           onClick={() => { setDiscountValue(0); setCouponCode(''); }} 
                                                           className="px-6 py-4 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase hover:bg-red-600 transition-colors"
                                                       >
                                                           Remover
                                                       </button>
                                                   )}
                                               </div>
                                           </div>
                                           {discountValue > 0 && <p className="mt-2 text-[10px] font-black text-emerald-500 uppercase flex items-center gap-2"><CheckCircle2 size={14}/> - R$ {discountValue.toFixed(2)} Desconto Aplicado</p>}
                                           <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic">A validação do cupom é realizada nos nossos servidores em tempo real.</p>
                                       </div>
                                   </div>

                                    {/* Quadro Composição de Preço (Step 5) - Aumentado conforme solicitado */}
                                   <div className="mt-8 bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[3rem] border-4 border-yellow-400 shadow-xl overflow-hidden relative group transition-all hover:scale-[1.01]">
                                       <div className="absolute top-0 right-0 p-4 opacity-0">
                                           <DollarSign size={120} className="text-yellow-400" />
                                       </div>
                                       <h4 className="text-xl font-black uppercase italic mb-6 dark:text-white flex items-center gap-3">
                                           <div className="w-10 h-10 bg-yellow-400 text-slate-900 rounded-xl flex items-center justify-center shadow-md">
                                               <DollarSign size={24} />
                                           </div>
                                           Composição Detalhada do Preço
                                       </h4>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                           <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-inner">
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarifa Base</p>
                                               <p className="text-2xl font-black dark:text-white tracking-tighter">R$ {
                                                   (() => {
                                                       const toll = selectedRoute.toll || 0;
                                                       const boarding = selectedRoute.boarding_fee || 0;
                                                       const fees = selectedRoute.fees || 0;
                                                       if (selectedSection) {
                                                           return Math.max(0, (selectedSection.price || 0) - toll - boarding - fees).toFixed(2);
                                                       }
                                                       return (selectedRoute.price || 0).toFixed(2);
                                                   })()
                                               }</p>
                                               <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase italic">Valor Líquido</p>
                                           </div>
                                           <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-inner">
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedágio</p>
                                               <p className="text-2xl font-black dark:text-white tracking-tighter">R$ {(selectedRoute.toll || 0).toFixed(2)}</p>
                                               <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase italic">Rateio Fixado</p>
                                           </div>
                                           <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-inner">
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxas</p>
                                               <p className="text-2xl font-black dark:text-white tracking-tighter">R$ {((selectedRoute.boarding_fee || 0) + (selectedRoute.fees || 0)).toFixed(2)}</p>
                                               <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase italic">Embarque e Encargos</p>
                                           </div>
                                           <div className="p-4 bg-yellow-400 rounded-2xl border-2 border-slate-900 flex flex-col justify-center shadow-md">
                                               <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Total Unitário</p>
                                               <p className="text-3xl font-black text-slate-900 leading-none tracking-tighter italic">R$ {
                                                   (selectedSection 
                                                       ? (selectedSection.price || 0) 
                                                       : ((selectedRoute.price || 0) + (selectedRoute.toll || 0) + (selectedRoute.boarding_fee || 0) + (selectedRoute.fees || 0))
                                                   ).toFixed(2)
                                               }</p>
                                           </div>
                                       </div>
                                       {selectedSeats.length > 1 && (
                                           <div className="mt-10 pt-8 border-t-4 border-dashed border-slate-100 dark:border-zinc-800 flex justify-between items-center px-6">
                                               <p className="text-[14px] font-black text-slate-400 uppercase italic">Subtotal Bruto ({selectedSeats.length} passagens)</p>
                                               <p className="text-3xl font-black dark:text-white tracking-tighter">R$ {( (selectedSection ? (selectedSection.price || 0) : ((selectedRoute.price || 0) + (selectedRoute.toll || 0) + (selectedRoute.boarding_fee || 0) + (selectedRoute.fees || 0))) * selectedSeats.length ).toFixed(2)}</p>
                                           </div>
                                       )}
                                   </div>

                               <div className="mt-12 p-10 bg-slate-900 rounded-[3.5rem] border-4 border-yellow-400 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
                                    <div className="text-center md:text-left">
                                        <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Total do Bilhete</p>
                                        <div className="flex items-baseline gap-4 mt-2">
                                            <p className="text-5xl font-black text-white italic tracking-tighter leading-none">
                                                R$ {getGrandTotal(true).toFixed(2)}
                                            </p>
                                            {discountValue > 0 && (
                                                <p className="text-xl font-bold text-slate-500 line-through">
                                                    R$ {getGrandTotal(false).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        disabled={isFinishing} 
                                        onClick={handleFinishSale} 
                                        className="w-full md:w-auto px-16 py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all border-2 border-emerald-400"
                                    >
                                        {isFinishing ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={28}/>} 
                                        {isPassengerView ? 'Finalizar e Pagar' : 'Finalizar e Emitir'}
                                    </button>
                               </div>
                           </div>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default TicketAgentInterface;
