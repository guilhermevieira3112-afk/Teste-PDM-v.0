import { UserRole } from './pdm';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  totpSecret?: string;
  department?: string;
}
