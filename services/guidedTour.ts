import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';

export interface TourDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  duration: string;
  iconName: string;
  targetView?: string;
  steps: DriveStep[];
}

// Chave do localStorage para armazenar o progresso
const COMPLETED_TOURS_KEY = 'vialivre_completed_tours';

export const getCompletedTours = (): string[] => {
  try {
    const data = localStorage.getItem(COMPLETED_TOURS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const markTourCompleted = (tourId: string) => {
  try {
    const completed = getCompletedTours();
    if (!completed.includes(tourId)) {
      completed.push(tourId);
      localStorage.setItem(COMPLETED_TOURS_KEY, JSON.stringify(completed));
    }
  } catch (e) {
    console.warn('Erro ao salvar tour concluído:', e);
  }
};

export const resetCompletedTours = () => {
  try {
    localStorage.removeItem(COMPLETED_TOURS_KEY);
  } catch (e) {
    console.warn('Erro ao resetar tours:', e);
  }
};

export const isTourCompleted = (tourId: string): boolean => {
  return getCompletedTours().includes(tourId);
};

// Coleção de Tours Disponíveis
export const TOURS: TourDefinition[] = [
  {
    id: 'system_overview',
    title: 'Visão Geral do Sistema',
    subtitle: 'Conheça a interface mestre, navegação, pesquisa global e configurações.',
    category: 'Introdução',
    duration: '2 min',
    iconName: 'Sparkles',
    targetView: 'dashboard',
    steps: [
      {
        element: '#tour-logo',
        popover: {
          title: '🚍 Bem-vindo ao ViaLivre Gestão',
          description: 'Sua plataforma centralizada para controle de frotas rodoviárias, escalas, passagens e monitoramento operacional.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-menu-toggle',
        popover: {
          title: '📑 Menu de Operações & Módulos',
          description: 'Clique aqui para abrir o menu lateral e navegar entre Escalas, Bilheteria, Frota, Funcionários, Relatórios e mais.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-search-bar',
        popover: {
          title: '🔍 Busca Rápida Global',
          description: 'Encontre instantaneamente qualquer motorista, fiscal, veículo por placa/prefixo, itinerário ou aviso com autocompletar.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-sync-status',
        popover: {
          title: '⚡ Sincronização em Tempo Real',
          description: 'Acompanhe o status da conexão em nuvem com o banco de dados Supabase e force sincronizações manuais se necessário.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-notifications',
        popover: {
          title: '🔔 Central de Notificações',
          description: 'Receba alertas críticos de manutenções, vencimentos de CNH, ocorrências e atualizações de escalas ao vivo.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-theme-toggle',
        popover: {
          title: '🎨 Personalização Visual',
          description: 'Alterne entre o Modo Claro/Escuro e ajuste a paleta de cores primárias para o melhor conforto visual.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-user-profile',
        popover: {
          title: '👤 Seu Perfil e Acesso',
          description: 'Visualize suas credenciais, nível de permissão (Admin, Fiscal, RH, etc.) e dados de sessão ativa.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-dashboard-tabs',
        popover: {
          title: '📊 Painéis em Tempo Real & Analytics',
          description: 'Alterne entre o monitoramento ao vivo do dia atual e gráficos aprofundados de faturamento, ocupação e produtividade.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-help-btn',
        popover: {
          title: '✨ Central de Tour & Ajuda',
          description: 'Você pode reabrir este menu de tours a qualquer momento clicando neste botão.',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  },
  {
    id: 'trip_schedule',
    title: 'Gestão de Escalas & Viagens',
    subtitle: 'Aprenda a cadastrar viagens, atribuir veículos/motoristas e gerenciar status.',
    category: 'Operacional',
    duration: '3 min',
    iconName: 'Calendar',
    targetView: 'schedule',
    steps: [
      {
        element: '#tour-trips-header',
        popover: {
          title: '🗓️ Escala Diária de Viagens',
          description: 'Painel central onde os fiscais e despachantes controlam todas as partidas, chegadas e status operacionais.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-trips-date-picker',
        popover: {
          title: '📅 Filtro de Data',
          description: 'Navegue entre datas passadas para conferência de relatórios ou programe as saídas dos próximos dias.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-trips-add-btn',
        popover: {
          title: '➕ Cadastrar Nova Viagem',
          description: 'Crie uma nova partida definindo Linha, Horário, Veículo, Motorista e Fiscal responsável.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-trips-filters',
        popover: {
          title: '🔎 Filtros Operacionais',
          description: 'Filtre viagens por Empresa, Status (Programada, Em Trânsito, Concluída) e busque por prefixo do ônibus.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-trips-list',
        popover: {
          title: '📋 Lista de Viagens & Ações Rápidas',
          description: 'Acompanhe a ocupação de poltronas, catraca inicial/final, imprima mapa de bordo e realize o fechamento de caixa.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    id: 'ticket_agent',
    title: 'Bilheteria & Venda de Passagens',
    subtitle: 'Passo a passo para selecionar trecho, assentos, emitir passagens e vouchers.',
    category: 'Vendas',
    duration: '2 min',
    iconName: 'Ticket',
    targetView: 'ticketing',
    steps: [
      {
        element: '#tour-tickets-header',
        popover: {
          title: '🎟️ PDV de Venda de Passagens',
          description: 'Interface rápida e otimizada para guichês físicos e agentes de venda emitirem bilhetes rodoviários.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-tickets-search-box',
        popover: {
          title: '🗺️ Seleção de Origem e Destino',
          description: 'Escolha a cidade de embarque e desembarque para carregar as viagens e horários disponíveis na data.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-tickets-passenger-box',
        popover: {
          title: '👤 Dados do Passageiro & Documentação',
          description: 'Preencha Nome Completo, CPF e telefone. O sistema valida os dados para seguro e emissão de voucher oficial.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-tickets-payment-box',
        popover: {
          title: '💳 Formas de Pagamento & Emissão',
          description: 'Aceite PIX, Dinheiro, Cartão de Crédito/Débito ou Vouchers. Imprima diretamente ou gere o PDF com QR Code.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    id: 'vehicle_fleet',
    title: 'Gestão da Frota & Veículos',
    subtitle: 'Controle de prefixos, tacógrafo, manutenções preventivas e vistorias.',
    category: 'Frota',
    duration: '2 min',
    iconName: 'Bus',
    targetView: 'vehicles',
    steps: [
      {
        element: '#tour-vehicles-header',
        popover: {
          title: '🚍 Frota de Veículos',
          description: 'Visão completa dos ônibus cadastrados, suas capacidades de passageiros, placas, modelos e status operacional.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-vehicles-add-btn',
        popover: {
          title: '➕ Cadastrar Ônibus',
          description: 'Adicione novos veículos à frota definindo prefixo, empresa proprietária, tipo de chassi e configuração de assentos.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-vehicles-grid',
        popover: {
          title: '🛡️ Monitoramento de Manutenção & Vistoria',
          description: 'Verifique quais veículos estão ativos, em manutenção ou com inspeções pendentes antes de liberar para a escala.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    id: 'time_tracking',
    title: 'Ponto Eletrônico & Jornada',
    subtitle: 'Registro de ponto, escalas de trabalho e relatórios de horas para RH.',
    category: 'RH & Ponto',
    duration: '2 min',
    iconName: 'Clock',
    targetView: 'time-tracking',
    steps: [
      {
        element: '#tour-timetracking-header',
        popover: {
          title: '⏱️ Ponto Eletrônico & Jornada de Trabalho',
          description: 'Controle em tempo real de entradas, saídas, intervalos e horas extras de motoristas, cobradores e fiscais.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-timetracking-register-box',
        popover: {
          title: '📍 Registro com Validação de Local e Foto',
          description: 'Registro seguro com autenticação de matrícula/CPF e carimbo de data e hora inviolável.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-timetracking-history',
        popover: {
          title: '📜 Espelho de Ponto & Exportação',
          description: 'Consulte registros por colaborador, justifique ausências e exporte o fechamento para a folha de pagamento.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
];

/**
 * Inicia um tour guiado específico utilizando driver.js
 */
export const startGuidedTour = (
  tourId: string,
  options?: {
    onChangeView?: (view: any) => void;
    onFinish?: () => void;
  }
) => {
  const tour = TOURS.find(t => t.id === tourId) || TOURS[0];

  // Se o tour precisar de uma tela específica, mudamos a tela primeiro
  if (tour.targetView && options?.onChangeView) {
    options.onChangeView(tour.targetView);
  }

  // Pequeno timeout para garantir que o DOM renderizou
  setTimeout(() => {
    // Filtrar passos cujos elementos existem no DOM no momento
    const validSteps = tour.steps.filter(step => {
      if (typeof step.element === 'string') {
        const el = document.querySelector(step.element);
        return !!el;
      }
      return !!step.element;
    });

    if (validSteps.length === 0) {
      console.warn(`Nenhum elemento encontrado para o tour: ${tour.id}`);
      return;
    }

    const driverConfig: Config = {
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(9, 9, 11, 0.75)',
      stagePadding: 8,
      stageRadius: 16,
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Concluir Tour ✨',
      progressText: '{{current}} de {{total}}',
      steps: validSteps,
      onDestroyed: () => {
        markTourCompleted(tour.id);
        if (options?.onFinish) {
          options.onFinish();
        }
      },
      onPopoverRender: (popover, { config, state }) => {
        // Customização adicional do elemento popover injetado
        popover.wrapper.classList.add('vialivre-tour-popover');
      },
    };

    const driverInstance = driver(driverConfig);
    driverInstance.drive();
  }, 300);
};
