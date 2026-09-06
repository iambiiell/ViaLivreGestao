import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  fileName?: string;
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  unit?: 'mm' | 'pt';
  format?: 'a4' | 'letter';
  companyName?: string;
  scale?: number;
}

/**
 * Exports an HTML element directly to a formatted PDF using html2canvas and jsPDF.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    fileName = `relatorio_${new Date().toISOString().split('T')[0]}.pdf`,
    title = 'ViaLivre • Relatório de Gestão de Frotas',
    orientation,
    scale = 2,
  } = options;

  const isDark = document.documentElement.classList.contains('dark');

  // Capture canvas with high resolution and correct background color
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    windowWidth: element.scrollWidth || window.innerWidth,
    windowHeight: element.scrollHeight || window.innerHeight,
  });

  const imgData = canvas.toDataURL('image/png');

  // Auto determine best orientation if not provided
  const chosenOrientation = orientation || (canvas.width > canvas.height * 1.15 ? 'landscape' : 'portrait');

  const pdf = new jsPDF({
    orientation: chosenOrientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8; // 8mm margin
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = (canvas.height * contentWidth) / canvas.width;

  let heightLeft = contentHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    position = heightLeft - contentHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - margin * 2);
  }

  // Set document title
  pdf.setProperties({
    title,
    creator: 'ViaLivre Gestão de Frotas',
  });

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}
