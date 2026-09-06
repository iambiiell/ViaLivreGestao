/**
 * Utilitário centralizado de formatação de datas no padrão brasileiro DD/MM/YYYY.
 */

export function formatDate(input: string | number | Date | null | undefined): string {
  if (!input) return '---';

  try {
    if (input instanceof Date) {
      if (isNaN(input.getTime())) return '---';
      const day = String(input.getDate()).padStart(2, '0');
      const month = String(input.getMonth() + 1).padStart(2, '0');
      const year = input.getFullYear();
      return `${day}/${month}/${year}`;
    }

    if (typeof input === 'number') {
      const d = new Date(input);
      if (isNaN(d.getTime())) return '---';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return '---';

      // Tratamento direto de string YYYY-MM-DD sem shift de timezone
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-');
        return `${day}/${month}/${year}`;
      }

      // Tratamento de YYYY-MM-DDTHH:mm...
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const datePart = trimmed.split('T')[0];
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
      }

      // Se já estiver em DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }

      // Fallback para Date parser
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
  } catch {
    return '---';
  }

  return '---';
}

export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (!input) return '---';

  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '---';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '---';
  }
}

export function getTodayDateBR(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
