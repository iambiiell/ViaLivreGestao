
import React, { useMemo } from 'react';
import { Trip, BusRoute } from '../types';
import { Landmark, Printer } from 'lucide-react';

interface SchedulePosterProps {
  route: BusRoute;
  trips: Trip[];
}

const SchedulePoster: React.FC<SchedulePosterProps> = ({ route, trips }) => {
  const groupedTrips = useMemo(() => {
    const days = {
      weekdays: { ida: [] as string[], volta: [] as string[] },
      saturday: { ida: [] as string[], volta: [] as string[] },
      sunday: { ida: [] as string[], volta: [] as string[] },
    };

    trips.forEach(trip => {
      const time = trip.departure_time;
      const direction = trip.direction || 'IDA';
      const date = new Date(trip.trip_date);
      const day = date.getDay(); // 0=Sunday, 6=Saturday

      if (day === 0) {
        if (direction === 'IDA') { if (!days.sunday.ida.includes(time)) days.sunday.ida.push(time); }
        else { if (!days.sunday.volta.includes(time)) days.sunday.volta.push(time); }
      } else if (day === 6) {
        if (direction === 'IDA') { if (!days.saturday.ida.includes(time)) days.saturday.ida.push(time); }
        else { if (!days.saturday.volta.includes(time)) days.saturday.volta.push(time); }
      } else {
        if (direction === 'IDA') { if (!days.weekdays.ida.includes(time)) days.weekdays.ida.push(time); }
        else { if (!days.weekdays.volta.includes(time)) days.weekdays.volta.push(time); }
      }
    });

    // Sort times
    const sortTimes = (a: string, b: string) => a.localeCompare(b);
    days.weekdays.ida.sort(sortTimes);
    days.weekdays.volta.sort(sortTimes);
    days.saturday.ida.sort(sortTimes);
    days.saturday.volta.sort(sortTimes);
    days.sunday.ida.sort(sortTimes);
    days.sunday.volta.sort(sortTimes);

    return days;
  }, [trips]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-2xl print:shadow-none print:p-0 my-8">
      <div className="flex justify-end mb-4 print:hidden gap-2">
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest">
          <Printer size={16} /> Imprimir Poster (A4)
        </button>
      </div>

      <div className="border-4 border-slate-900 p-8 min-h-[297mm] flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center gap-6 pb-6 border-b-4 border-slate-900">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center border-4 border-slate-900">
             <Landmark size={48} className="text-slate-900" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">HORÁRIOS DE ÔNIBUS</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">Transporte Coletivo Municipal</p>
          </div>
        </div>

        {/* Route Info */}
        <div className="bg-slate-100 py-4 px-8 my-6 flex justify-center items-center">
          <h2 className="text-2xl font-black text-slate-900 uppercase italic">
            {route.prefixo_linha} - {route.origin} / {route.destination}
          </h2>
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-3 gap-0 border-4 border-slate-900 flex-1">
          {/* Column headers */}
          <div className="border-r-4 border-slate-900 bg-slate-900 text-white p-4 text-center">
            <h3 className="text-lg font-black uppercase tracking-widest">DIAS ÚTEIS</h3>
          </div>
          <div className="border-r-4 border-slate-900 bg-slate-900 text-white p-4 text-center">
            <h3 className="text-lg font-black uppercase tracking-widest">SÁBADOS</h3>
          </div>
          <div className="bg-slate-900 text-white p-4 text-center">
            <h3 className="text-lg font-black uppercase tracking-widest">DOMINGOS / FERIADOS</h3>
          </div>

          {/* Sub-headers: IDA / VOLTA */}
          <div className="contents">
              {[groupedTrips.weekdays, groupedTrips.saturday, groupedTrips.sunday].map((dayData, idx) => (
                <div key={idx} className={`grid grid-cols-2 ${idx < 2 ? 'border-r-4' : ''} border-slate-900 h-full`}>
                   <div className="border-r-2 border-slate-400 bg-slate-50 text-center py-2 text-[10px] font-black uppercase tracking-tighter">IDA</div>
                   <div className="bg-slate-50 text-center py-2 text-[10px] font-black uppercase tracking-tighter">VOLTA</div>
                   
                   <div className="p-4 border-r-2 border-slate-400 space-y-2">
                      {dayData.ida.map(time => (
                        <div key={time} className="text-xl font-black text-slate-800 text-center font-mono leading-none border-b border-slate-100 pb-1">{time}</div>
                      ))}
                   </div>
                   <div className="p-4 space-y-2">
                      {dayData.volta.map(time => (
                        <div key={time} className="text-xl font-black text-slate-800 text-center font-mono leading-none border-b border-slate-100 pb-1">{time}</div>
                      ))}
                   </div>
                </div>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-4 border-slate-900 flex justify-between items-end">
           <div className="text-[10px] font-black text-slate-400 uppercase leading-tight">
             <p>Sujeito a alterações sem aviso prévio.</p>
             <p>Consulte o site oficial para atualizações em tempo real.</p>
           </div>
           <div className="text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gerado por</p>
              <p className="text-sm font-black text-slate-900 uppercase italic">CONSIMP Gestão de Frotas</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePoster;
