import React, { useState, useEffect, useMemo } from 'react';
import { Bus, Wifi, Phone, Globe, Shield, QrCode as QrCodeIcon, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import QRCode from 'qrcode';
import { ImpCard, Company, SystemSettings, VtCardCompanySettings } from '../types';

export interface TransportCardProps {
  card?: Partial<ImpCard> | null;
  company?: Partial<Company> | null;
  settings?: Partial<SystemSettings> | null;
  // Overrides diretos para retrocompatibilidade
  name?: string;
  abbreviation?: string;
  cardNumber?: string;
  internalCode?: string;
  photoUrl?: string;
  category?: string;
  city?: string;
  state?: string;
  viewMode?: 'front' | 'back' | 'both';
  interactiveFlip?: boolean;
  scale?: number;
  className?: string;
}

export const generateCardInternalCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 8; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

export const generateCardNumber10Digits = (type: string = 'Vale Transporte'): string => {
  const prefix = type.toLowerCase().includes('vale') ? '10' :
                 type.toLowerCase().includes('idoso') ? '20' :
                 type.toLowerCase().includes('escolar') ? '30' : '40';
  const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${random8}`.substring(0, 10);
};

export const TransportCard: React.FC<TransportCardProps> = ({
  card,
  company,
  settings,
  name: propName,
  abbreviation: propAbbreviation,
  cardNumber: propCardNumber,
  internalCode: propInternalCode,
  photoUrl: propPhotoUrl,
  category: propCategory,
  city: propCity,
  state: propState,
  viewMode = 'front',
  interactiveFlip = true,
  scale = 1,
  className = ''
}) => {
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>(viewMode === 'back' ? 'back' : 'front');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Identificar empresa vinculada (pelo card ou passada diretamente)
  const resolvedCompanyId = card?.company_id || company?.id;

  // Obter configurações customizadas da empresa (multi-tenant) a partir de system_settings
  const companyVtSettings: VtCardCompanySettings | undefined = useMemo(() => {
    if (resolvedCompanyId && settings?.vt_card_settings && settings.vt_card_settings[resolvedCompanyId]) {
      return settings.vt_card_settings[resolvedCompanyId];
    }
    return undefined;
  }, [resolvedCompanyId, settings]);

  // Resolução dos dados institucionais
  const companyName = company?.name || company?.nome_fantasia || card?.company_name || 'Vialivre';
  const systemName = companyVtSettings?.system_name || settings?.vt_system_name || `S.B.U. ${companyName}`;
  const systemNameSize = companyVtSettings?.system_name_size || settings?.vt_system_name_size || 'medium';
  const systemNameFontSize = companyVtSettings?.system_name_font_size || (settings as any)?.vt_system_name_font_size;
  const slogan = companyVtSettings?.slogan || settings?.vt_slogan || 'Movendo pessoas, conectando cidades!';
  const displayWebsite = companyVtSettings?.display_website || settings?.vt_display_website || 'vialivregestao.netlify.app';
  const sacName = companyVtSettings?.sac_name || settings?.vt_sac_name || 'SAC Central do Usuário';
  const sacPhone = companyVtSettings?.sac_phone || settings?.vt_sac_phone || '(11) 4004-0000 / 0800 700 8090';
  const sacHours = companyVtSettings?.sac_hours || settings?.vt_sac_hours || 'Segunda a Sexta, das 06:00 às 22:00';
  const frontBgUrl = companyVtSettings?.front_background_url || settings?.vt_front_bg_url || '';
  const backBgUrl = companyVtSettings?.back_background_url || settings?.vt_back_bg_url || '';
  const qrCodeDestination = companyVtSettings?.qr_code_destination || settings?.vt_qr_code_url || (displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`);

  // Resolução das cores personalizadas do cartão
  const colorCategory = companyVtSettings?.color_category || (settings as any)?.vt_color_category;
  const colorSystemName = companyVtSettings?.color_system_name || (settings as any)?.vt_color_system_name;
  const colorSlogan = companyVtSettings?.color_slogan || (settings as any)?.vt_color_slogan;
  const colorCityState = companyVtSettings?.color_city_state || (settings as any)?.vt_color_city_state;
  const colorUserName = companyVtSettings?.color_user_name || (settings as any)?.vt_color_user_name;
  const colorUserLabel = companyVtSettings?.color_user_label || (settings as any)?.vt_color_user_label;
  const colorNfc = companyVtSettings?.color_nfc || (settings as any)?.vt_color_nfc;

  const colorOperatorLabel = companyVtSettings?.color_operator_label || (settings as any)?.vt_color_operator_label;
  const colorInternalCode = companyVtSettings?.color_internal_code || (settings as any)?.vt_color_internal_code;
  const colorCardNumber = companyVtSettings?.color_card_number || (settings as any)?.vt_color_card_number;
  const colorUserNameBack = companyVtSettings?.color_user_name_back || (settings as any)?.vt_color_user_name_back;
  const colorLegalNotice = companyVtSettings?.color_legal_notice || (settings as any)?.vt_color_legal_notice;
  const colorInfoService = companyVtSettings?.color_info_service || (settings as any)?.vt_color_info_service;
  const colorDisplayWebsite = companyVtSettings?.color_display_website || (settings as any)?.vt_color_display_website;
  const colorSacName = companyVtSettings?.color_sac_name || (settings as any)?.vt_color_sac_name;
  const colorSacPhone = companyVtSettings?.color_sac_phone || (settings as any)?.vt_color_sac_phone;
  const colorSacHours = companyVtSettings?.color_sac_hours || (settings as any)?.vt_color_sac_hours;

  // Resolução do tamanho de fonte exato em pixels para o Nome do Sistema (ex: 12px, 20px, 30px)
  const resolvedFontSize = useMemo(() => {
    if (systemNameFontSize !== undefined && systemNameFontSize !== null && systemNameFontSize !== '') {
      const parsed = typeof systemNameFontSize === 'string' 
        ? parseInt(systemNameFontSize.replace(/\D/g, ''), 10) 
        : Number(systemNameFontSize);
      if (!isNaN(parsed) && parsed >= 8 && parsed <= 72) {
        return parsed;
      }
    }
    // Fallback retrocompatível para legacy small/medium/large
    switch (systemNameSize) {
      case 'small':
        return 18;
      case 'large':
        return 30;
      case 'medium':
      default:
        return 24;
    }
  }, [systemNameFontSize, systemNameSize]);
  const fullName = useMemo(() => {
    if (propName) return propName.toUpperCase();
    if (card?.name) {
      return `${card.name} ${card.surname || ''}`.trim().toUpperCase();
    }
    return 'MARIA EDUARDA SILVA';
  }, [propName, card]);

  const abbreviation = useMemo(() => {
    if (propAbbreviation && propAbbreviation.trim()) return propAbbreviation.trim().toUpperCase();
    if (card?.abbreviation && card.abbreviation.trim()) return card.abbreviation.trim().toUpperCase();
    if ((card as any)?.user_abbreviation && (card as any).user_abbreviation.trim()) return (card as any).user_abbreviation.trim().toUpperCase();
    if (companyVtSettings?.user_abbreviation && companyVtSettings.user_abbreviation.trim()) return companyVtSettings.user_abbreviation.trim().toUpperCase();
    if ((settings as any)?.vt_user_abbreviation && (settings as any).vt_user_abbreviation.trim()) return (settings as any).vt_user_abbreviation.trim().toUpperCase();
    return '';
  }, [propAbbreviation, card, companyVtSettings, settings]);

  const frontDisplayName = abbreviation || fullName;

  const rawCardNumber = propCardNumber || card?.card_number || '1084920158';
  // Formatar número de 10 algarismos (ex: 1084920158 -> 10.84920158 ou apenas dígitos)
  const cleanCardNumber = rawCardNumber.replace(/\D/g, '').padEnd(10, '0').substring(0, 10);

  const internalCode = propInternalCode || card?.internal_code || 'VT89K2A1';
  const userCategory = (propCategory || card?.type || 'VALE TRANSPORTE').toUpperCase();
  const userCity = propCity || card?.address_city || 'Campinas';
  const userState = propState || card?.address_state || 'SP';
  const photoUrl = propPhotoUrl || card?.photo_url || '';
  const companyLogo = company?.logo_url || card?.company_logo || '';

  // Gerar QR Code
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(qrCodeDestination, {
      margin: 1,
      width: 140,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(url => {
      if (isMounted) setQrCodeDataUrl(url);
    }).catch(err => {
      console.warn('Erro ao gerar QRCode do Cartão:', err);
    });
    return () => { isMounted = false; };
  }, [qrCodeDestination]);

  // Se o viewMode for estritamente 'front' ou 'back', sincroniza
  useEffect(() => {
    if (viewMode === 'front' || viewMode === 'back') {
      setCurrentSide(viewMode);
    }
  }, [viewMode]);

  // Dimensões padrão oficiais: 1011px x 638px (proporção ~1.585)
  // Base visual em container de 505.5px x 319px (escala 0.5 da resolução de impressão)
  const cardWidth = 506;
  const cardHeight = 320;

  // RENDERIZAÇÃO DA FRENTE DO CARTÃO
  const renderFront = () => (
    <div
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        backgroundImage: frontBgUrl ? `url("${frontBgUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      className={`relative rounded-[24px] overflow-hidden shadow-2xl border-2 border-slate-900/10 dark:border-white/10 select-none flex flex-col justify-between p-6 ${
        !frontBgUrl ? 'bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 text-slate-950' : 'text-white'
      }`}
    >

      {/* PARTE SUPERIOR: Tipo de cadastro correspondente */}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[11px] uppercase tracking-[0.2em] bg-transparent"
            style={{ 
              color: colorCategory || (frontBgUrl ? '#ffffff' : '#0f172a'),
              border: `1.5px solid ${colorCategory ? `${colorCategory}55` : frontBgUrl ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.3)'}`
            }}
          >
            <Sparkles size={12} style={{ color: colorCategory || undefined }} />
            <span>{userCategory}</span>
          </div>
          <div className="flex items-center gap-2 bg-transparent" style={{ color: colorNfc || (frontBgUrl ? '#ffffff' : '#0f172a') }}>
            <Wifi size={22} className="rotate-90 opacity-90 drop-shadow" style={{ color: colorNfc || undefined }} />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">NFC / CONTACTLESS</span>
          </div>
        </div>

        {/* NOME DA EMPRESA SELECIONADA EM DESTAQUE (com dimensionamento configurável) */}
        <div className="mt-2" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
          <h1 
            style={{ 
              fontSize: `${resolvedFontSize}px`, 
              lineHeight: 1.15,
              color: colorSystemName || (frontBgUrl ? '#ffffff' : '#0f172a'),
              background: 'transparent',
              backgroundColor: 'transparent',
              boxShadow: 'none'
            }}
            className="font-black uppercase tracking-tight italic drop-shadow-sm break-words whitespace-normal max-w-[460px] !bg-transparent !bg-none"
          >
            {companyName}
          </h1>
          {systemName && systemName.toUpperCase() !== companyName.toUpperCase() && (
            <p 
              style={{ 
                color: colorSystemName ? `${colorSystemName}cc` : undefined, 
                background: 'transparent', 
                backgroundColor: 'transparent', 
                boxShadow: 'none' 
              }}
              className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-0.5 !bg-transparent !bg-none"
            >
              {systemName}
            </p>
          )}
        </div>

        {/* LINHA DIVISÓRIA */}
        <div className="w-full h-1 bg-slate-950/20 dark:bg-white/30 my-2 rounded-full" />

        {/* LOGO ABAIXO DA LINHA: Município e Estado + Lema sem fundos brancos */}
        <div className="flex items-start justify-between gap-3" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
          <p 
            style={{ 
              color: colorCityState || (frontBgUrl ? '#ffffff' : '#0f172a'), 
              background: 'transparent', 
              backgroundColor: 'transparent', 
              boxShadow: 'none' 
            }}
            className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0 pt-0.5 !bg-transparent !bg-none"
          >
            <span 
              className="w-2 h-2 rounded-full inline-block" 
              style={{ backgroundColor: colorCityState || (frontBgUrl ? '#ffffff' : '#0f172a') }}
            />
            {userCity} - {userState}
          </p>

          {/* LADO DIREITO: Lema personalizado */}
          <div className="flex-1 flex justify-end text-right" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
            <p 
              style={{ 
                color: colorSlogan || (frontBgUrl ? 'rgba(255,255,255,0.9)' : '#1e293b'), 
                background: 'transparent', 
                backgroundColor: 'transparent', 
                boxShadow: 'none' 
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-right italic max-w-[260px] break-words whitespace-pre-line leading-tight !bg-transparent !bg-none" 
              title={slogan}
            >
              "{slogan}"
            </p>
          </div>
        </div>
      </div>

      {/* PARTE INFERIOR DA FRENTE: Titular do Benefício e Foto (SEM CHIP) */}
      <div className="relative z-10 flex items-end justify-between mt-auto pt-4" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
        {/* Identificação de Segurança / Autenticidade (Substituindo o chip físico) */}
        <div className="space-y-1" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-1.5 opacity-80" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
            <Shield size={14} style={{ color: colorCategory || (frontBgUrl ? '#ffffff' : '#0f172a') }} />
            <span 
              style={{ color: colorCategory || (frontBgUrl ? '#ffffff' : '#0f172a'), background: 'transparent', backgroundColor: 'transparent' }}
              className="text-[9px] font-black uppercase tracking-widest !bg-transparent !bg-none"
            >
              CARTÃO BILHETAGEM
            </span>
          </div>
          <span 
            style={{ color: colorCityState || (frontBgUrl ? 'rgba(255,255,255,0.7)' : '#334155'), background: 'transparent', backgroundColor: 'transparent' }}
            className="text-[8px] font-mono font-bold uppercase tracking-wider block !bg-transparent !bg-none"
          >
            AUTENTICAÇÃO DIGITAL
          </span>
        </div>

        {/* Foto do Usuário / Avatar */}
        <div className="flex items-center gap-3" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
          <div className="text-right" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
            <p 
              style={{ 
                color: colorUserLabel || (frontBgUrl ? 'rgba(255,255,255,0.8)' : '#334155'), 
                background: 'transparent', 
                backgroundColor: 'transparent', 
                boxShadow: 'none' 
              }}
              className="text-[9px] font-bold uppercase !bg-transparent !bg-none"
            >
              Titular do Benefício
            </p>
            <p 
              style={{ 
                color: colorUserName || (frontBgUrl ? '#ffffff' : '#0f172a'), 
                background: 'transparent', 
                backgroundColor: 'transparent', 
                boxShadow: 'none' 
              }}
              className="text-xs font-black uppercase tracking-tight max-w-[220px] truncate !bg-transparent !bg-none"
            >
              {frontDisplayName}
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl border-2 border-slate-950/30 dark:border-white/40 bg-transparent p-0.5 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={fullName}
                className="w-full h-full rounded-xl object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-slate-900 text-yellow-400 flex items-center justify-center font-black text-xl uppercase">
                {fullName.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // RENDERIZAÇÃO DO VERSO DO CARTÃO
  const renderBack = () => (
    <div
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        backgroundImage: backBgUrl ? `url("${backBgUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      className={`relative rounded-[24px] overflow-hidden shadow-2xl border-2 border-slate-900/20 dark:border-zinc-800 select-none flex flex-col justify-between p-5 ${
        !backBgUrl ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white' : 'text-white'
      }`}
    >

      {/* 1. NO TOPO: Operadora & Concessionária com o Nome da Empresa Selecionada (SEM BORDAS EM VOLTA DO TEXTO) */}
      <div className="relative z-10 flex items-center justify-between pb-2" style={{ border: 'none' }}>
        <div className="flex items-center gap-3" style={{ border: 'none' }}>
          {companyLogo && (
            <img
              src={companyLogo}
              alt={companyName}
              className="h-9 max-w-[120px] object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex flex-col text-left" style={{ border: 'none', boxShadow: 'none' }}>
            <span 
              style={{ color: colorOperatorLabel || undefined, border: 'none' }}
              className="text-[8px] font-bold uppercase text-yellow-400 tracking-wider"
            >
              Operadora & Concessionária
            </span>
            <span 
              className="text-xs font-black uppercase text-white tracking-wide truncate max-w-[240px]" 
              style={{ border: 'none' }}
            >
              {companyName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[9px] font-mono font-bold tracking-widest text-slate-300">
          <Shield size={12} className="text-yellow-400" />
          <span>AUTÊNTICO</span>
        </div>
      </div>

      {/* 2. CÓDIGO INTERNO + NOME COMPLETO + NÚMERO DE IDENTIFICAÇÃO (10 ALGARISMOS) + AVISO LEGAL */}
      <div className="relative z-10 grid grid-cols-12 gap-3 my-auto items-center">
        {/* Bloco de identificação do usuário */}
        <div className="col-span-7 space-y-1">
          {/* Acima do nome: código interno gerado automaticamente (8 caracteres alfanuméricos) */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-yellow-400 uppercase tracking-widest">CÓDIGO INTERNO:</span>
            <span 
              style={{ color: colorInternalCode || undefined }}
              className="text-xs font-mono font-black text-yellow-300 px-2 py-0.5 rounded bg-yellow-400/15 border border-yellow-400/30"
            >
              {internalCode}
            </span>
          </div>

          {/* Logo após o código interno: Nome Completo do usuário */}
          <p 
            style={{ color: colorUserNameBack || undefined }}
            className="text-sm font-black uppercase text-white tracking-tight leading-tight pt-1 break-words"
          >
            {fullName}
          </p>

          {/* Abaixo do nome: número de identificação composto por 10 algarismos */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Nº DO CARTÃO:</span>
            <span 
              style={{ color: colorCardNumber || undefined }}
              className="text-[13px] font-mono font-black tracking-[0.18em] text-white"
            >
              {cleanCardNumber}
            </span>
          </div>
        </div>

        {/* Alinhado à direita: Aviso legal */}
        <div className="col-span-5 text-right pl-2 border-l border-white/15">
          <p 
            style={{ color: colorLegalNotice || undefined }}
            className="text-[7.5px] leading-tight font-bold text-slate-300 uppercase italic break-words whitespace-normal"
          >
            "ESTE CARTÃO É DE USO PESSOAL E INTRANSFERÍVEL. Em caso de perda, roubo, furto ou extravio, solicite imediatamente o bloqueio do cartão."
          </p>
        </div>
      </div>

      {/* 3. PARTE INFERIOR: QR Code + Informações e Serviços + Canais + Site configurado */}
      <div className="relative z-10 pt-2 border-t border-white/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* QR Code */}
          <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-lg border border-white/20 shrink-0 flex items-center justify-center">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code Bilhetagem" className="w-full h-full object-contain" />
            ) : (
              <QrCodeIcon size={32} className="text-slate-900" />
            )}
          </div>

          {/* Informações e Serviços */}
          <div className="space-y-0.5 text-left">
            <p 
              style={{ color: colorInfoService || undefined }}
              className="text-[9px] font-black text-yellow-400 uppercase tracking-wider"
            >
              INFORMAÇÕES E SERVIÇOS
            </p>
            <p className="text-[8px] font-bold text-slate-300 flex items-center gap-1">
              <Phone size={10} className="text-yellow-400 shrink-0" />
              <span>Escaneie o Qr Code e acesse os canais de bilhetagem</span>
            </p>
            <p className="text-[8px] font-bold text-slate-300 flex items-center gap-1">
              <Globe size={10} className="text-cyan-400 shrink-0" />
              <span 
                style={{ color: colorDisplayWebsite || undefined }}
                className="font-mono text-cyan-300 break-all"
              >
                {displayWebsite}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. RODAPÉ DO VERSO: Dados customizados do SAC (Nome, Telefone, Horários) com quebra de linha automática */}
      <div className="relative z-10 pt-1.5 mt-1 border-t border-white/10 grid grid-cols-12 gap-1.5 text-[7.5px] font-bold text-slate-400 items-start">
        <span 
          style={{ color: colorSacName || undefined }}
          className="col-span-4 text-slate-200 uppercase break-words leading-tight"
        >
          {sacName}
        </span>
        <span 
          style={{ color: colorSacPhone || undefined }}
          className="col-span-3 text-yellow-300 font-mono break-words leading-tight"
        >
          {sacPhone}
        </span>
        <span 
          style={{ color: colorSacHours || undefined }}
          className="col-span-5 text-right text-slate-300 break-words whitespace-normal leading-tight" 
          title={sacHours}
        >
          {sacHours}
        </span>
      </div>
    </div>
  );

  return (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      {/* Botões interativos de alternância Frente / Verso */}
      {interactiveFlip && viewMode !== 'both' && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-2xl shadow-inner border border-slate-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setCurrentSide('front')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              currentSide === 'front'
                ? 'bg-yellow-400 text-slate-950 shadow-md scale-100'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            Frente do Cartão
          </button>
          <button
            type="button"
            onClick={() => setCurrentSide('back')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              currentSide === 'back'
                ? 'bg-slate-900 text-yellow-400 dark:bg-yellow-400 dark:text-slate-950 shadow-md scale-100'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            Verso do Cartão
          </button>
        </div>
      )}

      {/* Container do Cartão com escala configurável */}
      <div
        id="transport-card-container"
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center'
        }}
        className="transition-transform duration-200"
      >
        {viewMode === 'both' ? (
          <div className="flex flex-col gap-6 items-center justify-center w-full">
            <div className="w-full flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest text-center">Frente</p>
              {renderFront()}
            </div>
            <div className="w-full flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest text-center">Verso</p>
              {renderBack()}
            </div>
          </div>
        ) : currentSide === 'front' ? (
          renderFront()
        ) : (
          renderBack()
        )}
      </div>
    </div>
  );
};

export default TransportCard;
