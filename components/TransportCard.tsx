
import React from 'react';
import { Bus, CreditCard, QrCode, Ticket, Wifi } from 'lucide-react';

interface TransportCardProps {
  name?: string;
  cardNumber?: string;
  photoUrl?: string;
  validity?: string;
  category?: string;
}

const TransportCard: React.FC<TransportCardProps> = ({
  name = "MARIA EDUARDA SILVA",
  cardNumber = "1234 5678 9012 3456",
  photoUrl = "https://picsum.photos/seed/maria/200",
  validity = "12/2026",
  category = "COMUM"
}) => {
  return (
    <div id="transport-card" className="w-[450px] h-[280px] rounded-[24px] overflow-hidden shadow-2xl font-sans flex flex-col relative bg-white border border-slate-200 select-none">
      {/* Top Section (Yellow) */}
      <div className="h-[35%] bg-[#FFD700] flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl font-black tracking-[0.2em] leading-none mb-1 drop-shadow-sm">VALE TRANSPORTE</h1>
        <p className="text-[9px] font-bold tracking-[0.1em] uppercase opacity-90">Sistema Integrado de Mobilidade</p>
      </div>

      {/* Bottom Section (Navy) */}
      <div className="h-[65%] bg-[#000080] p-5 relative flex flex-col justify-between">
        <div className="flex justify-between items-start">
          {/* Left Side: Chip and VT Logo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-12 h-9 bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 rounded-md border border-yellow-900/20 relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px opacity-30">
                  <div className="border-r border-b border-black/20"></div>
                  <div className="border-r border-b border-black/20"></div>
                  <div className="border-b border-black/20"></div>
                  <div className="border-r border-black/20"></div>
                  <div className="border-r border-black/20"></div>
                  <div></div>
                </div>
              </div>
              <Wifi size={20} className="text-yellow-400 rotate-90" />
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-yellow-400 p-1.5 rounded-lg">
                <Bus size={20} className="text-[#000080]" />
              </div>
              <div className="text-white leading-none">
                <p className="text-[10px] font-black italic">VT</p>
                <p className="text-[8px] font-bold uppercase tracking-tighter">Vale Transporte</p>
              </div>
            </div>
          </div>

          {/* Right Side: Photo and Info */}
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white text-[11px] font-black uppercase tracking-tight">{name}</p>
                <p className="text-white/60 text-[7px] font-bold uppercase mt-1">Nº do Cartão:</p>
                <p className="text-white text-[10px] font-mono font-bold tracking-wider">{cardNumber}</p>
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-yellow-400 bg-white p-0.5 shadow-lg overflow-hidden">
                <img src={photoUrl} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>

            <div className="bg-yellow-400 px-3 py-1.5 rounded-md flex gap-4 shadow-md">
              <div>
                <p className="text-[6px] font-black text-[#000080]/60 uppercase">Validade</p>
                <p className="text-[9px] font-black text-[#000080]">{validity}</p>
              </div>
              <div className="w-px h-full bg-[#000080]/20"></div>
              <div>
                <p className="text-[6px] font-black text-[#000080]/60 uppercase">Categoria</p>
                <p className="text-[9px] font-black text-[#000080]">{category}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransportCard;
