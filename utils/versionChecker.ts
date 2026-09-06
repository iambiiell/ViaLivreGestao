/**
 * Serviço de Verificação de Atualizações do Sistema ViaLivre
 * Conecta-se à API do GitHub para comparar a versão atual com a última release.
 */

import { APP_VERSION, compareVersions, parseVersion } from './versionHelper';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt?: string;
  name?: string;
}

const GITHUB_OWNER = 'vianicolausa';
const GITHUB_REPO = 'ViaLivre-Gestao';

/**
 * Consulta a API do GitHub e compara com a versão atual do sistema.
 * Trata exceções de forma silenciosa para garantir estabilidade offline.
 */
export async function checkForUpdates(
  owner: string = GITHUB_OWNER,
  repo: string = GITHUB_REPO,
  currentVer: string = APP_VERSION
): Promise<UpdateCheckResult> {
  const defaultResult: UpdateCheckResult = {
    hasUpdate: false,
    currentVersion: currentVer,
    latestVersion: currentVer,
    releaseNotes: '',
    releaseUrl: `https://github.com/${owner}/${repo}/releases/latest`
  };

  try {
    // 1. Verificação de simulação local (para testes e depuração)
    if (typeof window !== 'undefined') {
      const simulatedVersion = localStorage.getItem('vialivre_simulated_github_update');
      if (simulatedVersion && simulatedVersion !== 'NONE') {
        const cleanSimulated = simulatedVersion.replace(/^[vV]/, '').trim();
        const hasUpdate = compareVersions(cleanSimulated, currentVer) > 0;
        return {
          hasUpdate,
          currentVersion: currentVer,
          latestVersion: cleanSimulated,
          releaseNotes: 'Atualização simulada de teste do sistema ViaLivre.',
          releaseUrl: `https://github.com/${owner}/${repo}/releases`
        };
      }
    }

    // 2. Requisição à API do GitHub com timeout defensivo
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Se não houver releases ou limite atingido, retorna silenciosamente
      return defaultResult;
    }

    const data = await response.json();
    if (!data || !data.tag_name) {
      return defaultResult;
    }

    // Remover prefixo 'v' ou 'V' da tag de versão
    const rawTag = String(data.tag_name).trim();
    const latestVersion = rawTag.replace(/^[vV]/, '');
    const cleanCurrent = currentVer.replace(/^[vV]/, '');

    // Compara versões semânticas
    const hasUpdate = !data.draft && compareVersions(latestVersion, cleanCurrent) > 0;

    return {
      hasUpdate,
      currentVersion: cleanCurrent,
      latestVersion,
      releaseNotes: data.body || 'Correções de desempenho, otimizações e melhorias gerais de estabilidade.',
      releaseUrl: data.html_url || `https://github.com/${owner}/${repo}/releases/tag/${rawTag}`,
      publishedAt: data.published_at,
      name: data.name || `Versão ${latestVersion}`
    };
  } catch (error) {
    // Falha silenciosa em caso de offline ou erro na rede
    console.error('[VERSION_CHECKER] Verificação de atualização finalizada silenciosamente:', error);
    return defaultResult;
  }
}

export default checkForUpdates;
