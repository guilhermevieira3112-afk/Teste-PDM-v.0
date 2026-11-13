import { UserRole } from './pdm';

export type UserProfileRole = 'MASTER_ADMIN' | 'ALMOXARIFADO' | 'MANUTENCAO_PRODUCAO';
export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING_APPROVAL';

export interface UserAccount {
  id: string;
  username: string; // Padrão primeiro_nome.ultimo_sobrenome
  name: string;
  email: string; // E-mail corporativo
  password?: string;
  role: UserProfileRole | UserRole;
  profileTitle?: string; // "Master Admin (Global)" | "Almoxarifado" | "Manutenção/Produção"
  tenantId: string; // 'dourado-sp' | 'porto-amazonas-pr' | 'corporativo'
  tenantName: string;
  approvalTier?: 1 | 2 | 3 | 'ALL'; // Nível de Aprovação por Alçada: 1 (até 1k), 2 (até 10k), 3 (> 10k), ALL (Master)
  status: UserStatus;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  totpSecret?: string;
  department?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  blockedAt?: string;
  notes?: string;
}
