// config/permissions.ts

export const ROLES = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  SUPERVISOR: 'Supervisor',
  FISCAL: 'Fiscal',
  MOTORISTA_URBANO: 'Motorista Urbano',
  MOTORISTA_RODOVIARIO: 'Motorista Rodoviário',
  COBRADOR: 'Cobrador',
  AGENTE_GUICHE: 'Agente de Guichê',
  MECANICO: 'Mecânico',
  RH: 'Recursos Humanos',
  COLABORADOR: 'Colaborador'
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES] | string;

export const TAB_PERMISSIONS: Record<string, { canView: string[]; canEdit?: string[] } | string[]> = {
  centro_operacional: {
    canView: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL, ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO, ROLES.COBRADOR],
    canEdit: [ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO, ROLES.COBRADOR]
  },
  colaboradores: [ROLES.ADMIN, ROLES.GERENTE, ROLES.RH],
  controle_acessos: [ROLES.ADMIN],
  empresas: [ROLES.ADMIN, ROLES.GERENTE],
  escalas_viagens: {
    canView: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL, ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO, ROLES.COBRADOR],
    canEdit: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL]
  },
  frota_onibus: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.MECANICO, ROLES.FISCAL],
  gestao_global: [ROLES.ADMIN, ROLES.GERENTE],
  gestao_guiche: [ROLES.ADMIN, ROLES.GERENTE, ROLES.AGENTE_GUICHE],
  gestao_vendas: [ROLES.ADMIN, ROLES.GERENTE, ROLES.AGENTE_GUICHE, ROLES.SUPERVISOR],
  holerites: [ROLES.ADMIN, ROLES.GERENTE, ROLES.RH, ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO, ROLES.COBRADOR, ROLES.COLABORADOR],
  itinerarios: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL],
  manutencao: [ROLES.ADMIN, ROLES.GERENTE, ROLES.MECANICO, ROLES.SUPERVISOR],
  monitoramento: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL],
  municipios: [ROLES.ADMIN, ROLES.GERENTE],
  ocorrencias: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL, ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO, ROLES.COBRADOR],
  recrutamento_rh: [ROLES.ADMIN, ROLES.RH],
  relatorios: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.RH],
  repositorio_skins: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.MOTORISTA_URBANO, ROLES.MOTORISTA_RODOVIARIO],
  rodoviarias: [ROLES.ADMIN, ROLES.GERENTE, ROLES.AGENTE_GUICHE, ROLES.SUPERVISOR],
  trabalhe_conosco: [ROLES.ADMIN, ROLES.RH],
  vale_transporte: [ROLES.ADMIN, ROLES.GERENTE, ROLES.RH, ROLES.AGENTE_GUICHE],
  vistorias: [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FISCAL, ROLES.MECANICO]
};

export function checkPermission(userRole?: string | null, tabKey?: string, action: 'view' | 'edit' = 'view'): boolean {
  if (!userRole) return false;
  if (userRole === ROLES.ADMIN) return true;

  const config = TAB_PERMISSIONS[tabKey || ''];
  if (!config) return true;

  if (Array.isArray(config)) {
    return config.includes(userRole);
  }

  if (action === 'edit') {
    return config.canEdit?.includes(userRole) ?? false;
  }

  return config.canView?.includes(userRole) ?? false;
}
