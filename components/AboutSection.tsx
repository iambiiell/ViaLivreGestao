
import React from 'react';

import { BusFront, Download } from 'lucide-react';

const AboutSection: React.FC<{ systemName?: string }> = ({ systemName }) => {
  const whatsappNumber = "5521995421447";
  const whatsappMsg = encodeURIComponent("Olá! Estou entrando em contato através do sistema ViaLivre Gestão.");
  const setupUrl = "https://github.com/vianicolausa/ViaLivre-Gestao/releases/download/v2.0/ViaLivre.Gestao-v2.0.Setup.exe";

  return (
    <div className="mt-12 pt-12 border-t border-slate-100 dark:border-zinc-800 text-center transition-opacity py-8">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center text-xs font-black text-slate-900 border-2 border-slate-900 shadow-lg">
            {systemName?.[0] || 'V'}
          </div>
          <div className="text-left">
            <span className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase italic block leading-none">
              {systemName || 'ViaLivre Gestão'}
            </span>
            <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest bg-yellow-100 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full mt-1 inline-block">
              Versão v2.0
            </span>
            <p className="text-[7px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Windows 10/11</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a 
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
            target="_blank"
            rel="no-referrer"
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md active:scale-95"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Suporte WhatsApp
          </a>

          <a 
            href={setupUrl}
            download="ViaLivre Gestão.exe"
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-zinc-700 transition-all shadow-md active:scale-95 border border-white/10"
          >
            <Download size={14} />
            Baixar Desktop
          </a>
        </div>

        <div className="space-y-1">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Desenvolvido por ViaLivre Gestão • Suporte: <a href="mailto:via.nicolau.sa@gmail.com" className="text-yellow-600 hover:underline">via.nicolau.sa@gmail.com</a>
          </p>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Central de Atendimento: <a href={`tel:${whatsappNumber}`} className="text-yellow-600 hover:underline">(21) 9 9542-1447</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutSection;
