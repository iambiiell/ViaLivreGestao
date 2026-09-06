import { GoogleGenAI, Type } from "@google/genai";
import { BusRoute } from "../types";

const DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6KZavLBRPGoBRLXk8ZgjLlH21WsF93dEynVeoqIQjzGEw";

const getGeminiApiKey = (): string => {
  const envKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY);

  return envKey || DEFAULT_GEMINI_API_KEY;
};

export interface MaintenanceEstimateResult {
  cost: number;
  partDetails: string;
}

export async function estimateMaintenanceCost(techReport: string): Promise<MaintenanceEstimateResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !techReport.trim()) {
    return { cost: 150, partDetails: "Estimativa padrão / Revisão geral de peças" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
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
