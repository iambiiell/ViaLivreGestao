import React from 'react';
import { Bus, Users, Activity, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { Trip, BusRoute, Vehicle, User, RouteStatus } from '../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface OperationsSummaryProps {
  trips: Trip[];
  vehicles: Vehicle[];
  users: User[];
  routes: BusRoute[];
}

const sparkData1 = [{v: 10}, {v: 15}, {v: 12}, {v: 18}, {v: 22}];
const sparkData2 = [{v: 5}, {v: 4}, {v: 6}, {v: 3}, {v: 4}];
const sparkData3 = [{v: 20}, {v: 22}, {v: 25}, {v: 24}, {v: 28}];
const sparkData4 = [{v: 8}, {v: 9}, {v: 11}, {v: 12}, {v: 14}];

export const OperationsSummary: React.FC<OperationsSummaryProps> = ({
  trips = [],
  vehicles = [],
  users = [],
  routes = []
}) => {
  const activeTripsCount = trips.filter(t => t.status === 'Em Rota' || t.status === 'Em Andamento' || t.status === 'Atrasada').length;
  const maintenanceVehiclesCount = vehicles.filter(v => v.status === 'MANUTENCAO').length;
  const staffOnTurnCount = users.filter(u => u.role !== 'PASSENGER').length;
  const activeRoutesCount = routes.filter(r => r.status === RouteStatus.ACTIVE || (r.status as any) === 'Ativa' || !r.status).length;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-zinc-900 to-slate-950 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-yellow-400/20 relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">Resumo de Operações em Tempo Real</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight">Indicadores Críticos da Frota</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-yellow-400" />
            <span>Métricas Atualizadas</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {/* Metric 1 */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between transition-all hover:bg-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-yellow-400/20 shrink-0">
              <Activity size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <TrendingUp size={12} />
              <span>+14.2%</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Viagens Ativas</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black tracking-tight text-white">{activeTripsCount}</p>
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData1}>
                    <defs>
                      <linearGradient id="color1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#facc15" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="#facc15" strokeWidth={2} fillOpacity={1} fill="url(#color1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">vs. período anterior</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between transition-all hover:bg-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-black shrink-0">
              <Bus size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <TrendingDown size={12} />
              <span>-4.5%</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ônibus em Manutenção</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black tracking-tight text-white">{maintenanceVehiclesCount} <span className="text-xs font-normal text-slate-400">/ {vehicles.length}</span></p>
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData2}>
                    <defs>
                      <linearGradient id="color2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#color2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">vs. período anterior</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between transition-all hover:bg-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black shrink-0">
              <Users size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <TrendingUp size={12} />
              <span>+8.1%</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colaboradores no Turno</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black tracking-tight text-white">{staffOnTurnCount}</p>
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData3}>
                    <defs>
                      <linearGradient id="color3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#color3)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">vs. período anterior</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between transition-all hover:bg-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <TrendingUp size={12} />
              <span>+3.0%</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rotas Ativas</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black tracking-tight text-white">{activeRoutesCount} <span className="text-xs font-normal text-slate-400">/ {routes.length}</span></p>
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData4}>
                    <defs>
                      <linearGradient id="color4" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#color4)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">vs. período anterior</p>
          </div>
        </div>
      </div>
    </div>
  );
};
