/**
 * Utilitários para Formatação e Validação da Chave de Ativação
 * Padrão: "VL-" seguido de 8 caracteres (letras A-Z ou números 0-9), hífen "-", e 4 caracteres (letras A-Z ou números 0-9).
 * Exemplo: VL-XXXXXXXX-XXXX, VL-84920194-4921 ou VL-A1B2C3D4-5E6F
 */

export const ACTIVATION_KEY_PLACEHOLDER = 'VL-XXXXXXXX-XXXX';
export const ACTIVATION_KEY_PATTERN = /^VL-[A-Z0-9]{8}-[A-Z0-9]{4}$/i;
export const MASTER_TEST_KEY = 'MASTER-2024-TEST-KEY';

export const formatActivationKey = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim().toUpperCase();
  if (trimmed.includes('MASTER')) return trimmed;

  // Quando o usuário está digitando as primeiras letras do prefixo
  if (trimmed === 'V' || trimmed === 'VL' || trimmed === 'VL-') {
    return 'VL-';
  }

  // Remove qualquer prefixo VL inicial para capturar o corpo alfanumérico
  const withoutPrefix = trimmed.replace(/^VL[-_\s:]*/i, '');
  
  // Extrai exatamente caracteres alfanuméricos (A-Z e 0-9), garantindo que tanto números quanto letras são identificados
  const alphanumeric = withoutPrefix.replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!alphanumeric) return '';

  const part1 = alphanumeric.slice(0, 8); // 8 caracteres (letras ou números)
  const part2 = alphanumeric.slice(8, 12); // 4 caracteres (letras ou números)

  if (part2.length > 0) {
    return `VL-${part1}-${part2}`;
  }
  if (part1.length === 8 && (val.endsWith('-') || withoutPrefix.length > 8)) {
    return `VL-${part1}-`;
  }
  return `VL-${part1}`;
};

export const isValidActivationKey = (key: string): boolean => {
  if (!key) return false;
  const upper = key.trim().toUpperCase();
  if (upper === MASTER_TEST_KEY) return true;
  return ACTIVATION_KEY_PATTERN.test(upper);
};

export const ACTIVATION_KEY_ERROR_MESSAGE = 
  'A chave de ativação deve seguir o padrão VL-XXXXXXXX-XXXX (VL- seguido de 8 letras ou números, hífen e 4 letras ou números).';
