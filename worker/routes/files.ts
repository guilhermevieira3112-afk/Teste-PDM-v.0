import { ApiHttpError, Env } from '../types.ts';
import { requireGovernanceAccess } from '../middleware/authHook.ts';

export async function handleFilesRoute(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (pathname === '/api/files/upload') {
    if (method !== 'POST') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST para /api/files/upload.');
    }
    await requireGovernanceAccess(request, env);
    throw new ApiHttpError(
      503,
      'STORAGE_DISABLED',
      'Armazenamento de arquivos em nuvem (R2) desativado temporariamente.'
    );
  }

  if (pathname.startsWith('/api/files/')) {
    if (method !== 'GET') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET para /api/files.');
    }
    await requireGovernanceAccess(request, env);
    throw new ApiHttpError(
      503,
      'STORAGE_DISABLED',
      'Armazenamento de arquivos em nuvem (R2) desativado temporariamente.'
    );
  }

  throw new ApiHttpError(404, 'NOT_FOUND', `Rota de arquivos desconhecida: ${pathname}`);
}
