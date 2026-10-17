import { GoogleGenAI, Type } from "@google/genai";
import { BusRoute } from "../types";

const getGeminiApiKey = (): string => {
  const envKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY);

  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return '';
};

export interface MaintenanceEstimateResult {
  cost: number;
  partDetails: string;
}

export interface OperationalContextData {
  timestamp: string;
  database: string;
  fleetSummary: {
    total: number;
    active: number;
    maintenance: number;
    vehicles: any[];
  };
  routesSummary: {
    totalActiveRoutes: number;
    routes: any[];
  };
  tripsSummary: {
    totalTripsLogged: number;
    recentTrips: any[];
  };
  occurrencesSummary: {
    pendingOccurrences: number;
    occurrences: any[];
  };
  companiesSummary: {
    companies: any[];
  };
}

/**
 * Reads real-time operational context (routes, fleet, timetables, and occurrences)
 * directly from the Supabase PostgreSQL database.
 */
export async function getOperationalContext(): Promise<OperationalContextData> {
  try {
    const res = await fetch('/api/ai/operational-context');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[GeminiService] Error querying operational context from server:', err);
  }

  // Fallback if offline
  return {
    timestamp: new Date().toISOString(),
    database: 'Supabase PostgreSQL',
    fleetSummary: { total: 0, active: 0, maintenance: 0, vehicles: [] },
    routesSummary: { totalActiveRoutes: 0, routes: [] },
    tripsSummary: { totalTripsLogged: 0, recentTrips: [] },
    occurrencesSummary: { pendingOccurrences: 0, occurrences: [] },
    companiesSummary: { companies: [] }
  };
}

/**
 * Operational Assistant: Answers operational queries with live context
 * from the Supabase PostgreSQL database.
 */
export async function askOperationalAssistant(
  prompt: string,
  options?: { focus?: string }
): Promise<{ reply: string; contextSummary?: OperationalContextData }> {
  try {
    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, focus: options?.focus })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[GeminiService] Backend AI assistant route unavailable, attempting client generation:', err);
  }

  // Client-side fallback
  const apiKey = getGeminiApiKey();
  const context = await getOperationalContext();

  if (!apiKey) {
    return {
      reply: `Olá, sou o Tico! Contexto operacional Supabase PostgreSQL:\n- Rotas ativas: ${context.routesSummary.totalActiveRoutes}\n- Frota: ${context.fleetSummary.active}/${context.fleetSummary.total} operacionais\n- Ocorrências pendentes: ${context.occurrencesSummary.pendingOccurrences}`,
      contextSummary: context
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é o Tico, o Assistente Operacional Inteligente do ViaLivre Gestão, conectado diretamente ao banco de dados Supabase PostgreSQL.
Contexto Operacional Atual:
- Frota: ${context.fleetSummary.active} operacionais de ${context.fleetSummary.total} cadastrados.
- Rotas ativas: ${context.routesSummary.totalActiveRoutes}.
- Ocorrências pendentes: ${context.occurrencesSummary.pendingOccurrences}.

Apresente-se como Tico sempre que pertinente.
Pergunta do operador: "${prompt}"`
            }
          ]
        }
      ]
    });

    return {
      reply: response.text || 'Operação processada com sucesso pelo Tico.',
      contextSummary: context
    };
  } catch {
    return {
      reply: `Olá, sou o Tico! Informações em tempo real da base Supabase PostgreSQL:\n• Frota Operacional: ${context.fleetSummary.active}/${context.fleetSummary.total} veículos em operação (${context.fleetSummary.maintenance} em manutenção)\n• Rotas ativas: ${context.routesSummary.totalActiveRoutes}\n• Ocorrências pendentes: ${context.occurrencesSummary.pendingOccurrences}`,
      contextSummary: context
    };
  }
}

export async function estimateMaintenanceCost(techReport: string): Promise<MaintenanceEstimateResult> {
  // Server-side first
  try {
    const res = await fetch('/api/ai/maintenance-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ techReport })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // proceed to client fallback
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey || !techReport.trim()) {
    return { cost: 150, partDetails: "Estimativa padrão / Revisão geral de peças" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Você é um engenheiro mecânico de frotas de ônibus e transporte rodoviário.
Analise o relatório técnico abaixo e estime o custo aproximado total (em Reais R$) e liste resumidamente as principais peças e serviços deduzidos.

Relatório Técnico: "${techReport}"

Responda em formato JSON estrito:
{
  "cost": <número em reais>,
  "partDetails": "<resumo das peças e serviços identificados>"
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cost: { type: Type.NUMBER, description: "Custo total estimado em Reais" },
            partDetails: { type: Type.STRING, description: "Lista sucinta de peças ou serviços identificados" }
          },
          required: ["cost", "partDetails"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      cost: typeof parsed.cost === 'number' ? parsed.cost : 250,
      partDetails: parsed.partDetails || 'Manutenção geral realizada'
    };
  } catch (error) {
    console.warn("[GeminiService] Falha ao estimar custo de manutenção:", error);
    return {
      cost: 200,
      partDetails: "Revisão e manutenção de rotina"
    };
  }
}

export async function generateRoutePlan(origin: string, destination: string): Promise<Partial<BusRoute>> {
  // Server-side first
  try {
    const res = await fetch('/api/ai/route-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // proceed to client fallback
  }

  const apiKey = getGeminiApiKey();
  const fallbackDistance = 65;
  const fallbackDuration = 75;

  if (!apiKey || !origin || !destination) {
    return {
      origin,
      destination,
      distance_km: fallbackDistance,
      duration_minutes: fallbackDuration
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Você é um planejador de rotas de transporte intermunicipal e urbano no Brasil.
Calcule a distância rodoviária aproximada em quilômetros (distance_km) e a duração estimada em minutos (duration_minutes) para uma viagem de ônibus entre as cidades:
Origem: "${origin}"
Destino: "${destination}"

Responda em formato JSON estrito:
{
  "distance_km": <número>,
  "duration_minutes": <número>
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            distance_km: { type: Type.NUMBER, description: "Distância rodoviária em KM" },
            duration_minutes: { type: Type.NUMBER, description: "Duração aproximada em minutos" }
          },
          required: ["distance_km", "duration_minutes"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      origin,
      destination,
      distance_km: typeof parsed.distance_km === 'number' ? Math.round(parsed.distance_km) : fallbackDistance,
      duration_minutes: typeof parsed.duration_minutes === 'number' ? Math.round(parsed.duration_minutes) : fallbackDuration
    };
  } catch (error) {
    console.warn("[GeminiService] Falha ao planejar rota com IA:", error);
    return {
      origin,
      destination,
      distance_km: fallbackDistance,
      duration_minutes: fallbackDuration
    };
  }
}
