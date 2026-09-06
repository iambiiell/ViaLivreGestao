
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BusRoute, Trip, User, Vehicle, TicketSale } from '../types';
import { 
  X, 
  ArrowRight, 
  Navigation, 
  BusFront, 
  User as UserIcon, 
  Ticket, 
  Play, 
  CheckCircle2, 
  Clock,
  Layout
} from 'lucide-react';

interface TripSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  currentUser: User | null;
  activeTripId: string | null;
  tickets: TicketSale[];
  onStartTrip: (trip: Trip) => void;
  onFinalizeSection: (trip: Trip) => void;
}

const TripSelectionModal: React.FC<TripSelectionModalProps> = ({
  isOpen,
  onClose,
  trips,
  routes,
  vehicles,
  currentUser,
  activeTripId,
  tickets,
  onStartTrip,
  onFinalizeSection
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(activeTripId || (trips.length > 0 ? trips[0].id : null));
  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedTripId), [selectedTripId, trips]);

  const SeatMap = ({ trip, onSeatClick }: { trip: Trip; onSeatClick: (ticket: TicketSale | undefined) => void }) => {
    const vehicle = vehicles.find(v => v.prefix === trip.bus_number);
    const capacity = vehicle?.capacity || 42; // Fixed 42 seats as requested? The user said "Gere um layout visual de 42 poltronas".
    const tripTickets = tickets.filter(t => t.trip_id === trip.id && t.status !== 'canceled');
    
    return (
        <div className="grid grid-cols-4 gap-3 p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border-2 border-slate-100 dark:border-zinc-700">
            {Array.from({ length: 42 }).map((_, i) => {
                const seatNum = i + 1;
                const ticket = tripTickets.find(t => t.seat_number === seatNum);
                const isOccupied = ticket && ticket.status !== 'disembarked';
                const isDisembarked = ticket && ticket.status === 'disembarked';
                
                return (
                    <button 
                        key={seatNum}
                        onClick={() => onSeatClick(ticket)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all border-2 ${
                            isOccupied 
                                ? 'bg-blue-600 border-blue-400 text-white font-black' 
                                : isDisembarked || !ticket
                                    ? 'bg-emerald-500 border-emerald-400 text-white'
                                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-300'
                        }`}
                    >
                        <span className="text-[10px] font-black">{seatNum}</span>
                        {isOccupied && <UserIcon size={12} className="opacity-50" />}
                        {ticket?.status === 'boarded' && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white shadow-sm" />
                        )}
                    </button>
                );
            })}
        </div>
    );
  };

  const [focusedTicket, setFocusedTicket] = useState<TicketSale | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 transition-all overflow-hidden" 
         onClick={(e) => {
             if (e.target === e.currentTarget) onClose();
         }}
    >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-6xl rounded-[3rem] shadow-2xl border-4 border-emerald-500 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
            {/* Trip Selection Sidebar */}
            <div className="w-full md:w-80 bg-slate-50 dark:bg-zinc-950 border-r border-slate-100 dark:border-zinc-800 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <Layout className="text-emerald-500" size={18} />
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Suas Viagens</h4>
                    </div>
                    <button onClick={onClose} className="md:hidden p-2 text-slate-400"><X size={20}/></button>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-6 custom-scrollbar">
                    {trips.map(trip => {
                        const route = routes.find(r => r.id === trip.route_id);
                        const isActive = selectedTripId === trip.id;
                        
                        return (
                            <button 
                                key={trip.id}
                                onClick={() => setSelectedTripId(trip.id)}
                                className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                                    isActive 
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' 
                                        : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-emerald-300'
                                }`}
                            >
                                <p className={`text-[10px] font-black uppercase mb-1 ${isActive ? 'text-white' : 'text-emerald-500'}`}>{trip.departure_time}</p>
                                <p className="text-xs font-black uppercase tracking-tight truncate">
                                    {route?.origin || 'ORIGEM'} <ArrowRight className="inline mx-1" size={12}/> {route?.destination || 'DESTINO'}
                                </p>
                                <div className={`mt-2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest inline-block ${
                                    trip.status === 'Em Andamento' || trip.status === 'Em Rota' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {trip.status}
                                </div>
                            </button>
                        );
                    })}
                    {trips.length === 0 && <p className="text-[10px] font-black text-slate-400 uppercase text-center py-10 italic">Nenhuma viagem...</p>}
                </div>
                
                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-zinc-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase text-center truncate">Motorista: {currentUser?.full_name}</p>
                </div>
            </div>

            {/* Map Content */}
            <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 min-h-0">
                <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">Centro de Operações - Rodoviário</h3>
                        <p className="text-[10px] font-black text-emerald-200 uppercase mt-1">
                            {selectedTrip ? `Viatura ${selectedTrip.bus_number} | Escala: ${selectedTrip.departure_time}` : 'Selecione uma viagem'}
                        </p>
                    </div>
                    <button onClick={onClose} className="hidden md:block p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24} /></button>
                </div>

                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    {selectedTrip ? (
                        <div className="grid lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                  <div className="bg-slate-100 dark:bg-zinc-800 p-8 rounded-[2.5rem] relative">
                                      <div className="absolute left-1/2 -top-4 w-20 h-8 bg-emerald-500 rounded-t-full flex items-center justify-center border-4 border-white dark:border-zinc-900 -translate-x-1/2 shadow-lg">
                                          <Navigation className="text-white" size={14} />
                                      </div>
                                      <SeatMap 
                                        trip={selectedTrip} 
                                        onSeatClick={(t) => setFocusedTicket(t || null)} 
                                      />
                                  </div>
                                  <div className="flex justify-around bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800">
                                      <div className="text-center">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Poltronas</p>
                                          <p className="text-xl font-black text-slate-900 dark:text-white uppercase">42</p>
                                      </div>
                                      <div className="text-center">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Disponíveis</p>
                                          <p className="text-xl font-black text-emerald-500 uppercase">{42 - tickets.filter(t => t.trip_id === selectedTrip.id && t.status !== 'canceled' && t.status !== 'disembarked').length}</p>
                                      </div>
                                      <div className="text-center">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Ocupadas</p>
                                          <p className="text-xl font-black text-blue-500 uppercase">{tickets.filter(t => t.trip_id === selectedTrip.id && t.status !== 'canceled' && t.status !== 'disembarked').length}</p>
                                      </div>
                                  </div>
                            </div>

                            <div className="space-y-8">
                                  {focusedTicket ? (
                                      <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-blue-600 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden"
                                      >
                                          <div className="relative z-10">
                                              <div className="flex justify-between items-start mb-6">
                                                  <div>
                                                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Passageiro</p>
                                                      <h4 className="text-2xl font-black uppercase italic tracking-tight">{focusedTicket.passenger_name}</h4>
                                                  </div>
                                                  <button onClick={() => setFocusedTicket(null)} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"><X size={16}/></button>
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-black">
                                                  <div className="bg-white/10 p-4 rounded-2xl">
                                                      <p className="opacity-60 mb-1">Origem</p>
                                                      <p>{focusedTicket.section_origin}</p>
                                                  </div>
                                                  <div className="bg-white/10 p-4 rounded-2xl">
                                                      <p className="opacity-60 mb-1">Destino</p>
                                                      <p>{focusedTicket.section_destination}</p>
                                                  </div>
                                                  <div className="bg-white/10 p-4 rounded-2xl">
                                                      <p className="opacity-60 mb-1">Poltrona</p>
                                                      <p className="text-lg">{focusedTicket.seat_number}</p>
                                                  </div>
                                                  <div className="bg-white/10 p-4 rounded-2xl">
                                                      <p className="opacity-60 mb-1">Documento</p>
                                                      <p>{focusedTicket.passenger_document || 'N/A'}</p>
                                                  </div>
                                              </div>
                                          </div>
                                      </motion.div>
                                  ) : (
                                      <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                                          <BusFront className="absolute -right-8 -bottom-8 text-white/5 rotate-12" size={140} />
                                          <div className="relative z-10">
                                              <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-4">Informação de Seção Ativa</p>
                                              <div className="space-y-2">
                                                  <h4 className="text-2xl font-black uppercase italic tracking-tight">
                                                      {routes.find(r => r.id === selectedTrip.route_id)?.sections?.[selectedTrip.current_section_index || 0]?.name || 'Trecho Inicial'}
                                                  </h4>
                                                  <p className="text-sm font-bold text-slate-400">Clique em uma poltrona azul para ver detalhes do passageiro.</p>
                                              </div>
                                              
                                              {selectedTrip.status === 'Em Andamento' || selectedTrip.status === 'Em Rota' ? (
                                                <button 
                                                    onClick={() => onFinalizeSection(selectedTrip)}
                                                    className="w-full mt-8 py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all group"
                                                >
                                                    <CheckCircle2 size={16} className="group-hover:scale-125 transition-transform" /> Check-out de Seção
                                                </button>
                                              ) : selectedTrip.status === 'Agendada' ? (
                                                <button 
                                                    onClick={() => onStartTrip(selectedTrip)}
                                                    className="w-full mt-8 py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all"
                                                >
                                                    <Play size={16} fill="black" /> Iniciar Viagem
                                                </button>
                                              ) : (
                                                <div className="w-full mt-8 py-5 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-slate-700 italic">
                                                    <X size={16} /> Operação Encerrada
                                                </div>
                                              )}
                                          </div>
                                      </div>
                                  )}

                                  <div className="space-y-4">
                                      <p className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Painel de Legendas</p>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                              <div className="w-5 h-5 bg-blue-600 border border-blue-400 rounded-md" /> <span>Poltrona Ocupada</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                              <div className="w-5 h-5 bg-emerald-500 border border-emerald-400 rounded-md" /> <span>Poltrona Livre</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                              <div className="w-5 h-5 bg-yellow-400 rounded-full shadow-sm" /> <span>Embarcado</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                              <Ticket size={16} className="text-blue-400" /> <span>Venda Real Time</span>
                                          </div>
                                      </div>
                                  </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12">
                            <BusFront size={64} className="text-slate-200 mb-6" />
                            <h3 className="text-xl font-black text-slate-400 uppercase italic">Selecione uma viagem à esquerda</h3>
                            <p className="text-xs font-bold text-slate-300 uppercase mt-2">Para visualizar o mapa de assentos e gerenciar o embarque</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    </div>
  );
};

export default TripSelectionModal;
