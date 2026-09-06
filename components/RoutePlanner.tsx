
import React, { useState } from 'react';
import { MapPin, ArrowRight, Sparkles, Loader2, Save } from 'lucide-react';
import { generateRoutePlan } from '../services/geminiService';
import { BusRoute, RouteStatus } from '../types';
import { generateUUID } from '../services/database';

interface RoutePlannerProps {
  onAddRoute: (route: BusRoute) => void;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ onAddRoute }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<Partial<BusRoute> | null>(null);

  const handleGenerate = async () => {
    if (!origin || !destination) return;
    setIsLoading(true);
    const result = await generateRoutePlan(origin, destination);
    setGeneratedRoute(result);
    setIsLoading(false);
  };

  const handleSave = () => {
    if (generatedRoute && generatedRoute.origin && generatedRoute.destination) {
      const estimatedPrice = (generatedRoute.distance_km || 0) * 0.45;

      // Fix: Added missing properties (letreiro_principal_modo, via1_modo, etc.) required by BusRoute interface
      const newRoute: BusRoute = {
        id: generateUUID(),
        company_id: '',
        prefixo_linha: 'NOVA-IA',
        origin: generatedRoute.origin,
        destination: generatedRoute.destination,
        sections: [],
        stops: [],
        schedule: {
          weekdays: [],
          saturday: [],
          sunday: []
        },
        status: RouteStatus.ACTIVE,
        distance_km: generatedRoute.distance_km || 0,
        price: parseFloat(estimatedPrice.toFixed(2)),
        // Use generated duration or estimate based on distance
        duration_minutes: generatedRoute.duration_minutes || Math.round((generatedRoute.distance_km || 0) * 1.2) || 60,
        letreiro_principal: (generatedRoute.destination || '').toUpperCase(),
        letreiro_principal_modo: 'FIXO',
        // Added missing properties 'letreiro_principal_cor' and 'letreiro_principal_velocidade'
        letreiro_principal_cor: 'AMBAR',
        letreiro_principal_velocidade: 5,
        via1_modo: 'FIXO',
        via2_modo: 'FIXO',
        via3_modo: 'FIXO',
        lightdot_code: '0000'
      };
      onAddRoute(newRoute);
      setGeneratedRoute(null);
      setOrigin('');
      setDestination('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="text-yellow-300" />
          Planejador Inteligente de Rotas
        </h2>
        <p className="text-blue-100 mb-6">
          Utilize nossa IA para calcular a distância e sugerir a tarifação ideal entre duas cidades.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-blue-100 mb-1">Origem</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white text-slate-900 border-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>
          
          <div className="md:col-span-1 flex justify-center pb-2">
            <ArrowRight className="text-blue-200 hidden md:block" />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-blue-100 mb-1">Destino</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ex: Curitiba, PR"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white text-slate-900 border-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isLoading || !origin || !destination}
          className="mt-6 w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-blue-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
          {isLoading ? 'Calculando...' : 'Calcular Rota'}
        </button>
      </div>

      {generatedRoute && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {generatedRoute.origin} <ArrowRight size={20} className="text-blue-500"/> {generatedRoute.destination}
              </h3>
              <p className="text-slate-500 mt-1 flex items-center gap-2">
                Distância estimada:
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold ml-2">
                  {generatedRoute.distance_km} km
                </span>
              </p>
            </div>
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Save size={18} />
              Salvar Rota
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutePlanner;
