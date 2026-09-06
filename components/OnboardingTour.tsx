
import React, { useState } from 'react';
import { X, ArrowRight, Check, LayoutDashboard, Bus, Users } from 'lucide-react';

interface OnboardingTourProps {
  onComplete: () => void;
}

const TOUR_STEPS = [
  {
    title: "Bem-vindo ao ConsImp",
    description: "Seu sistema completo de gestão de frotas. Vamos fazer um tour rápido pelas funcionalidades?",
    icon: <Bus size={32} className="text-blue-500" />
  },
  {
    title: "Dashboard Inteligente",
    description: "Aqui você tem uma visão geral da operação em tempo real: passageiros, receita e status da frota.",
    icon: <LayoutDashboard size={32} className="text-purple-500" />
  },
  {
    title: "Gestão Completa",
    description: "Utilize o menu lateral para cadastrar Motoristas, Veículos, Rotas e definir as Escalas de viagem.",
    icon: <Users size={32} className="text-green-500" />
  },
  {
    title: "Perfil Administrativo",
    description: "Mantenha os dados da sua empresa e pessoais sempre atualizados no menu superior direito para liberar todas as funções.",
    icon: <Check size={32} className="text-amber-500" />
  }
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden text-center border border-slate-200 dark:border-slate-700">
        <button 
          onClick={onComplete} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center shadow-inner">
            {TOUR_STEPS[currentStep].icon}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3 transition-all duration-300">
          {TOUR_STEPS[currentStep].title}
        </h2>
        
        <p className="text-slate-600 dark:text-slate-300 mb-8 text-lg leading-relaxed min-h-[80px]">
          {TOUR_STEPS[currentStep].description}
        </p>

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            {TOUR_STEPS.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${idx === currentStep ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              />
            ))}
          </div>
          
          <button 
            onClick={handleNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
          >
            {currentStep === TOUR_STEPS.length - 1 ? 'Começar' : 'Próximo'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
