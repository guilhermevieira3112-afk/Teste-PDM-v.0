/**
 * Utilitários de controle e validação de usuários PremieRpet
 */

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasNumber: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasSpecialChar: boolean;
}

/**
 * Gera automaticamente o login padrão: primeiro nome + '.' + último sobrenome
 * Exemplo: "Carlos Eduardo da Silva" -> "carlos.silva"
 * Exemplo: "Mariana Duarte" -> "mariana.duarte"
 */
export function generateStandardUsername(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';

  const clean = fullName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z\s]/g, ''); // mantém apenas letras e espaços

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName}.${lastName}`;
}

/**
 * Validação de senha estrita da PremieRpet:
 * - Mínimo 6 caracteres
 * - Pelo menos 1 número (0-9)
 * - Pelo menos 1 letra maiúscula (A-Z)
 * - Pelo menos 1 letra minúscula (a-z)
 * - Pelo menos 1 caractere especial (!@#$%...)
 */
export function validatePasswordRequirements(password: string): PasswordValidationResult {
  const pwd = password || '';

  const hasMinLength = pwd.length >= 6;
  const hasNumber = /\d/.test(pwd);
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd);

  const isValid = hasMinLength && hasNumber && hasUppercase && hasLowercase && hasSpecialChar;

  return {
    isValid,
    hasMinLength,
    hasNumber,
    hasUppercase,
    hasLowercase,
    hasSpecialChar,
  };
}

export const PROFILE_LABELS: Record<string, string> = {
  MASTER_ADMIN: 'Master Admin (Global)',
  ALMOXARIFADO: 'Almoxarifado',
  MANUTENCAO_PRODUCAO: 'Manutenção/Produção',
  UNIT_MANAGER: 'Almoxarifado', // retrocompatibilidade
};
