
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { TicketSale, Trip, BusRoute, Company, Vehicle } from '../types';
import { db, supabase } from '../services/database';

export const downloadTicket = async (saleId: string, originName?: string, destinationName?: string) => {
  try {
    // 1. Buscar dados da venda
    let sale: TicketSale | undefined;
    try {
      const sales = await db.getSales();
      sale = sales.find(s => s.id === saleId);
    } catch (e) {
      console.warn("Failed fetching all sales, falling back to direct query:", e);
    }

    if (!sale) {
      // Direct lookup from Supabase using saleId bypass to support Passenger Interface lookup when system_id is not set
      const { data, error } = await supabase
        .from('ticket_sales')
        .select('*')
        .eq('id', saleId)
        .single();
        
      if (data) {
        sale = data as TicketSale;
      }
    }

    if (!sale) throw new Error("Venda não encontrada");

    // 2. Buscar dados relacionados
    const trips = await db.getTrips();
    const trip = trips.find(t => t.id === sale.trip_id);
    
    const routes = await db.getRoutes();
    const route = routes.find(r => r.id === (trip?.route_id));

    const companies = await db.getCompanies();
    const company = (sale.booth_data || sale.company_data || companies.find(c => c.id === route?.company_id)) as any;

    // 3. Gerar QR Code
    const qrCodeData = `BPE|${sale.id}|${sale.passenger_cpf}|${sale.total_price}`;
    const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

    // 4. Criar PDF com jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const drawTicket = (yOffset: number, title: string) => {
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('D A B P E', 105, yOffset + 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Documento Auxiliar do Bilhete de Passagem Eletrônico', 105, yOffset + 14, { align: 'center' });
      
      // Company Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text((company?.name || 'VIALIVRE GESTÃO').toUpperCase(), 105, yOffset + 22, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`CNPJ: ${company?.cnpj || '00.000.000/0001-99'} - IE: ${(!company?.ie || company.ie.trim() === '') ? 'ISENTO' : company.ie}`, 105, yOffset + 26, { align: 'center' });
      
      const compData = company as any;
      const street = compData?.address_street || 'ENDEREÇO NÃO CADASTRADO';
      const city = compData?.address_city || '';
      const state = compData?.address_state || '';
      const number = compData?.address_number || '';
      
      doc.text(`${street.toUpperCase()}${number ? `, ${number}` : ''} - ${city.toUpperCase()}/${state.toUpperCase()}`, 105, yOffset + 30, { align: 'center' });

      // QR Code
      doc.addImage(qrCodeUrl, 'PNG', 170, yOffset + 5, 25, 25);

      // Main Info Table
      doc.setDrawColor(0);
      doc.rect(10, yOffset + 35, 190, 15); // Box for ID and Agency
      doc.line(60, yOffset + 35, 60, yOffset + 50);
      doc.setFontSize(7);
      doc.text('ID PASSAGEM', 12, yOffset + 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(sale.id.slice(-8).toUpperCase(), 12, yOffset + 46);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('AGÊNCIA VENDA', 62, yOffset + 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text((sale.booth_data?.name || 'TERMINAL CENTRAL').toUpperCase(), 62, yOffset + 46);

      // Route Info
      doc.rect(10, yOffset + 50, 190, 12);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('ORIGEM / LOCAL DE EMBARQUE', 12, yOffset + 54);
      doc.text('DESTINO', 105, yOffset + 54);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      // Use provided origin/destination or fallback to route defaults
      const finalOrigin = originName ? originName.toUpperCase() : (route?.origin || '').toUpperCase();
      const finalDestination = destinationName ? destinationName.toUpperCase() : (route?.destination || '').toUpperCase();

      doc.text(finalOrigin, 12, yOffset + 59);
      doc.text(finalDestination, 105, yOffset + 59);

      // Trip Details
      doc.rect(10, yOffset + 66, 190, 15);
      const colWidth = 190 / 5;
      for(let i=1; i<5; i++) doc.line(10 + (colWidth * i), yOffset + 66, 10 + (colWidth * i), yOffset + 81);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('DATA EMBARQUE', 12, yOffset + 70);
      doc.text('HORA', 12 + colWidth, yOffset + 70);
      doc.text('POLTRONA', 12 + colWidth*2, yOffset + 70);
      doc.text('PLATAFORMA', 12 + colWidth*3, yOffset + 70);
      doc.text('PREFIXO', 12 + colWidth*4, yOffset + 70);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(sale.created_at.split('T')[0].split('-').reverse().join('/'), 12, yOffset + 77);
      doc.text(sale.departure_time || trip?.departure_time || '---', 12 + colWidth, yOffset + 77);
      doc.text(sale.seat_number.toString().padStart(2, '0'), 12 + colWidth*2, yOffset + 77);
      const finalPlatform = (route?.origin_station_platform || '---').toUpperCase();
      doc.text(finalPlatform, 12 + colWidth*3, yOffset + 77);
      doc.text((route?.prefixo_linha || '---').toUpperCase(), 12 + colWidth*4, yOffset + 77);

      // Passenger and Price
      doc.rect(10, yOffset + 83, 110, 22);
      doc.rect(125, yOffset + 83, 75, 28); // Increased height to prevent total price overlapping
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('DADOS PASSAGEIRO', 12, yOffset + 87);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`NOME: ${(sale.passenger_name || 'PASSAGEIRO INDEFINIDO').toUpperCase()}`, 12, yOffset + 93);
      doc.text(`DOC: ${sale.passenger_cpf || '---'}`, 12, yOffset + 98);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`RESPONSÁVEL: ${(sale.responsible_name || 'PRÓPRIO').toUpperCase()}`, 12, yOffset + 103);

      // Vehicle Info at the end
      doc.setDrawColor(0);
      doc.rect(10, yOffset + 105, 110, 6);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`VEÍCULO: ${(sale.vehicle_model || '---').toUpperCase()} | PREFIXO: ${(sale.vehicle_prefix || '---').toUpperCase()}`, 12, yOffset + 109);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPOSIÇÃO DE PREÇO', 127, yOffset + 87);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      let currentY = yOffset + 91;
      const lineHeight = 3.5;

      doc.text('Tarifa Base:', 127, currentY);
      doc.text((sale.price_base || 0).toFixed(2), 198, currentY, { align: 'right' });
      currentY += lineHeight;

      doc.text('Pedágio:', 127, currentY);
      doc.text((sale.price_toll || 0).toFixed(2), 198, currentY, { align: 'right' });
      currentY += lineHeight;

      doc.text('Taxas/Enc.:', 127, currentY);
      doc.text(((sale.price_boarding_fee || 0) + (sale.price_fees || 0)).toFixed(2), 198, currentY, { align: 'right' });
      currentY += lineHeight;

      if ((sale.discount_value || 0) > 0) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setTextColor(200, 0, 0);
        doc.text('Desconto:', 127, currentY);
        doc.text(`- ${(sale.discount_value || 0).toFixed(2)}`, 198, currentY, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        currentY += lineHeight;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('PAGAMENTO:', 127, currentY);
      doc.text((sale.payment_method || '').toUpperCase().replace(/_/g, ' '), 198, currentY, { align: 'right' });
      currentY += lineHeight;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL R$:', 127, currentY + 1.5);
      doc.text((sale.total_price || 0).toFixed(2), 198, currentY + 1.5, { align: 'right' });

      // doc.setFontSize(7); // Removed from here as requested
      // doc.setFont('helvetica', 'normal');
      // doc.text(`PAGTO: ${(sale.payment_method || '').toUpperCase()}`, 12, yOffset + 110);

      // Footer / Access Key
      doc.rect(10, yOffset + 112, 190, 15);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('CHAVE DE ACESSO (Consulte em http://bpe.fazenda.mg.gov.br/portalbpe)', 105, yOffset + 116, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('courier', 'bold');
      
      // Random Access Key
      const accessKey = Array.from({length: 11}, () => Math.floor(Math.random() * 9000 + 1000)).join(' ');
      doc.text(accessKey, 105, yOffset + 123, { align: 'center' });

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`BPe Nr. ${sale.id.slice(0,8).toUpperCase()} Serie: 001 Emissão: ${new Date(sale.created_at).toLocaleString()}`, 105, yOffset + 130, { align: 'center' });
      doc.text('Protocolo: 131220132331492 - Autorizado em: ' + new Date(sale.created_at).toLocaleString(), 105, yOffset + 133, { align: 'center' });
    
      // Boarding Coupon (Cupom de Embarque)
      doc.setDrawColor(200);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(10, yOffset + 135, 200, yOffset + 135);
      doc.setLineDashPattern([], 0);
      doc.setDrawColor(0);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('CUPOM DE EMBARQUE', 105, yOffset + 139, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Passageiro: ${(sale.passenger_name || '').toUpperCase()}`, 12, yOffset + 143);
      doc.text(`Poltrona: ${sale.seat_number}`, 150, yOffset + 143);
      doc.text(`Origem: ${finalOrigin}`, 12, yOffset + 147);
      doc.text(`Destino: ${finalDestination}`, 105, yOffset + 147);
    };

    // Draw Passenger Copy
    drawTicket(10, 'VIA DO PASSAGEIRO');

    // Cutting Line
    doc.setLineDashPattern([2, 1], 0);
    doc.line(10, 155, 200, 155);
    doc.setFontSize(7);
    doc.text('CORTE AQUI - VIA DO MOTORISTA', 105, 154, { align: 'center' });
    doc.setLineDashPattern([], 0);

    // Draw Driver Copy
    drawTicket(160, 'VIA DO MOTORISTA');

    // Save
    doc.save(`DABPE_${sale.id.slice(-8).toUpperCase()}.pdf`);

  } catch (error) {
    console.error("Erro ao gerar DABPE:", error);
    alert("Falha ao gerar o PDF do Bilhete.");
  }
};
