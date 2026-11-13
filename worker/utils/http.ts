import { ApiHttpError } from '../types.ts';

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiHttpError) {
    return jsonResponse(
      {
        ok: false,
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      err.status
    );
  }

  const message = err instanceof Error ? err.message : 'Erro interno no Worker de governança.';
  return jsonResponse(
    {
      ok: false,
      error: message,
      code: 'INTERNAL_ERROR',
    },
    500
  );
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiHttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type deve ser application/json.'
    );
  }

  let text = '';
  try {
    text = await request.text();
  } catch {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Não foi possível ler o corpo da requisição.');
  }

  if (!text.trim()) {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Corpo JSON vazio.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'JSON inválido na requisição.');
  }
}
