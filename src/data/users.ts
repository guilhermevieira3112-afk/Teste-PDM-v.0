import { UserAccount } from '../types/auth';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-master-01',
    username: 'admin.master',
    name: 'Carlos Silva',
    email: 'carlos.silva@premierpet.com.br',
    password: '123',
    role: 'MASTER_ADMIN',
    tenantId: 'dourado-sp',
    tenantName: 'Governança Corporativa Global',
    department: 'Gestão de Master Data & Confiabilidade',
    twoFactorEnabled: true,
    totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 test seed compatible with Microsoft Authenticator
  },
  {
    id: 'usr-dourado-01',
    username: 'almox.dourado',
    name: 'Carlos Eduardo',
    email: 'carlos.eduardo@premierpet.com.br',
    password: '123',
    role: 'UNIT_MANAGER',
    tenantId: 'dourado-sp',
    tenantName: 'Unidade Dourado / SP',
    department: 'Almoxarifado Central Dourado',
    twoFactorEnabled: false,
    totpSecret: 'HXDMVJECJJWSRB3HWIZR4IF2HG4D43',
  },
  {
    id: 'usr-parana-01',
    username: 'almox.parana',
    name: 'Mariana Duarte',
    email: 'mariana.duarte@premierpet.com.br',
    password: '123',
    role: 'UNIT_MANAGER',
    tenantId: 'porto-amazonas-pr',
    tenantName: 'Unidade Porto Amazonas / PR',
    department: 'Almoxarifado & Manutenção Paraná',
    twoFactorEnabled: false,
    totpSecret: 'KRUGS4ZANFZSAYJA',
  },
];
