import { ApiHttpError, AuthenticatedContext, Env, GovernanceRole } from '../types.ts';

const VALID_ROLES = new Set<GovernanceRole>([
  'MASTER_ADMIN',
  'ALMOXARIFADO',
  'MANUTENCAO_PRODUCAO',
  'UNIT_MANAGER',
]);

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function extractCookieToken(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function signSessionPayload(
  payload: Omit<AuthenticatedContext, 'authMethod'> & { exp: number },
  secret: string
): Promise<string> {
  const encodedPayload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  );
  return `${encodedPayload}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

async function verifySignedToken(
  token: string,
  secret: string,
  authMethod: 'SESSION_COOKIE' | 'BEARER_TOKEN'
): Promise<AuthenticatedContext | null> {
  const segments = token.split('.');
  if (segments.length !== 2) return null;

  const [encodedPayload, encodedSig] = segments;
  if (!encodedPayload || !encodedSig) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  );
  const expectedSig = uint8ArrayToBase64Url(new Uint8Array(expectedSigBuffer));

  if (!constantTimeEqual(encodedSig, expectedSig)) {
    return null;
  }

  try {
    const decodedJson = new TextDecoder().decode(base64UrlToUint8Array(encodedPayload));
    const parsed = JSON.parse(decodedJson) as {
      userId?: string;
      username?: string;
      name?: string;
      role?: GovernanceRole;
      tenantId?: string;
      approvalTier?: 1 | 2 | 3 | 'ALL';
      exp?: number;
    };

    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    if (!parsed.userId || !parsed.username || !parsed.role || !VALID_ROLES.has(parsed.role)) {
      return null;
    }

    return {
      userId: parsed.userId,
      username: parsed.username,
      name: parsed.name || parsed.username,
      role: parsed.role,
      tenantId: parsed.tenantId || 'dourado-sp',
      approvalTier: parsed.approvalTier,
      authMethod,
    };
  } catch {
    return null;
  }
}

export function isStage1DevBypassActive(env: Env): boolean {
  return env.APP_ENV === 'development' && env.STAGE1_DEV_BYPASS === 'true';
}

/**
 * Guard de autenticação e RBAC para as rotas de governança e arquivos.
 * - Mantém endpoints protegidos por padrão (401 UNAUTHENTICATED).
 * - Já preparado para tokens/sessões assinadas da Etapa 3 sem retrabalho nas rotas.
 */
export async function requireGovernanceAccess(
  request: Request,
  env: Env,
  allowedRoles?: GovernanceRole[]
): Promise<AuthenticatedContext> {
  let context: AuthenticatedContext | null = null;

  const authHeader = request.headers.get('Authorization');
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

  const cookieToken =
    extractCookieToken(request.headers.get('Cookie'), '__Host-pdm_session') ||
    extractCookieToken(request.headers.get('Cookie'), 'pdm_session');

  const secret = env.AUTH_SESSION_SECRET?.trim();

  if (secret && (cookieToken || bearerToken)) {
    if (cookieToken) {
      context = await verifySignedToken(cookieToken, secret, 'SESSION_COOKIE');
    } else if (bearerToken) {
      context = await verifySignedToken(bearerToken, secret, 'BEARER_TOKEN');
    }

    if (!context) {
      throw new ApiHttpError(
        401,
        'UNAUTHENTICATED',
        'Sessão ou token inválido ou expirado. Realize login novamente.'
      );
    }
  } else if (isStage1DevBypassActive(env)) {
    const devRoleHeader = (request.headers.get('X-Dev-Role') || 'MASTER_ADMIN') as GovernanceRole;
    const role = VALID_ROLES.has(devRoleHeader) ? devRoleHeader : 'MASTER_ADMIN';
    context = {
      userId: 'dev-stage1-user',
      username: request.headers.get('X-Dev-User') || 'dev.local',
      name: 'Desenvolvedor Local (Stage 1)',
      role,
      tenantId: request.headers.get('X-Dev-Tenant') || 'dourado-sp',
      approvalTier: role === 'MASTER_ADMIN' ? 'ALL' : 1,
      authMethod: 'STAGE1_DEV_BYPASS',
    };
  } else {
    throw new ApiHttpError(
      401,
      'UNAUTHENTICATED',
      'Acesso negado: autenticação obrigatória para rotas de governança PDM.'
    );
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(context.role)) {
    throw new ApiHttpError(
      403,
      'FORBIDDEN',
      `Permissão insuficiente: perfil "${context.role}" não autorizado para esta operação.`
    );
  }

  return context;
}
