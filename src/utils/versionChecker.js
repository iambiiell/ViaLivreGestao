/**
 * Serviço de Verificação de Atualizações do Sistema ViaLivre (src/utils/versionChecker.js)
 * Conecta-se à API do GitHub e compara a versão do sistema com a última release.
 */

// Versão atual base do package.json
export const CURRENT_SYSTEM_VERSION = '1.5.0';

/**
 * Normaliza e decompõe uma string de versão em [major, minor, patch]
 * @param {string} versionStr
 * @returns {number[]}
 */
function parseVersion(versionStr) {
  if (!versionStr) return [0, 0, 0];
  const cleaned = String(versionStr).trim().replace(/^[vV]/, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map(p => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3);
}

/**
 * Compara duas versões semânticas.
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 se v1 > v2, -1 se v1 < v2, 0 se iguais
 */
function compareVersions(v1, v2) {
  const [maj1, min1, pat1] = parseVersion(v1);
  const [maj2, min2, pat2] = parseVersion(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

/**
 * Consulta a API do GitHub para verificar se há novas atualizações.
 * @param {string} [owner='vianicolausa']
 * @param {string} [repo='ViaLivre-Gestao']
 * @returns {Promise<{ hasUpdate: boolean, currentVersion: string, latestVersion: string, releaseNotes: string, releaseUrl: string }>}
 */
export async function checkForUpdates(owner = 'vianicolausa', repo = 'ViaLivre-Gestao') {
  const currentVersion = CURRENT_SYSTEM_VERSION;
  const defaultResult = {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseNotes: '',
    releaseUrl: `https://github.com/${owner}/${repo}/releases/latest`
  };

  try {
    // Verificação de simulação para depuração e testes locais
    if (typeof window !== 'undefined') {
      const simulatedVersion = localStorage.getItem('vialivre_simulated_github_update');
      if (simulatedVersion && simulatedVersion !== 'NONE') {
        const cleanSimulated = String(simulatedVersion).replace(/^[vV]/, '').trim();
        const hasUpdate = compareVersions(cleanSimulated, currentVersion) > 0;
        return {
          hasUpdate,
          currentVersion,
          latestVersion: cleanSimulated,
          releaseNotes: 'Atualização simulada de teste do sistema ViaLivre.',
          releaseUrl: `https://github.com/${owner}/${repo}/releases`
        };
      }
    }

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
      return defaultResult;
    }

    const data = await response.json();
    if (!data || !data.tag_name) {
      return defaultResult;
    }

    // Remove o prefixo 'v' ou 'V' da tag da release do GitHub
    const latestVersion = String(data.tag_name).trim().replace(/^[vV]/, '');
    const cleanCurrent = currentVersion.replace(/^[vV]/, '');

    const hasUpdate = !data.draft && compareVersions(latestVersion, cleanCurrent) > 0;

    return {
      hasUpdate,
      currentVersion: cleanCurrent,
      latestVersion,
      releaseNotes: data.body || 'Melhorias gerais de estabilidade, desempenho e correções de interface.',
      releaseUrl: data.html_url || `https://github.com/${owner}/${repo}/releases/tag/${data.tag_name}`
    };
  } catch (error) {
    // Falha silenciosa para não quebrar a aplicação caso o usuário esteja offline
    console.error('[VERSION_CHECKER_SILENT_ERROR]', error);
    return defaultResult;
  }
}

export default checkForUpdates;
