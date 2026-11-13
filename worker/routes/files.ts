import { ApiHttpError, Env } from '../types.ts';
import { MediaStorage } from '../storage/contracts.ts';
import { requireGovernanceAccess } from '../middleware/authHook.ts';
import { jsonResponse } from '../utils/http.ts';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB

function sanitizePathSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'arquivo';
}

export async function handleFilesRoute(
  request: Request,
  url: URL,
  env: Env,
  mediaStorage: MediaStorage
): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (pathname === '/api/files/upload') {
    if (method !== 'POST') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST para /api/files/upload.');
    }

    const auth = await requireGovernanceAccess(request, env);
    const formData = await request.formData();
    const file = formData.get('file');
    const categoryRaw = String(formData.get('category') || 'items');
    const itemIdRaw = String(formData.get('itemId') || 'geral');

    if (!file || typeof file === 'string') {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Campo multipart "file" é obrigatório.');
    }

    const uploadedFile = file as File;
    if (!ALLOWED_MIME_TYPES.has(uploadedFile.type)) {
      throw new ApiHttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        `Tipo de arquivo não suportado (${uploadedFile.type || 'desconhecido'}). Permitidos: JPG, PNG, WEBP e PDF.`
      );
    }

    const buffer = await uploadedFile.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_FILE_BYTES) {
      throw new ApiHttpError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Arquivo deve ter entre 1 byte e 5 MB para envio ao Cloudflare R2.'
      );
    }

    const category = categoryRaw === 'quotations' ? 'quotations' : 'items';
    const itemSegment = sanitizePathSegment(itemIdRaw);
    const fileSegment = sanitizePathSegment(uploadedFile.name || 'anexo');
    const uniqueKey = `${category}/${itemSegment}/${crypto.randomUUID()}-${fileSegment}`;

    const ref = await mediaStorage.putMedia({
      key: uniqueKey,
      data: buffer,
      contentType: uploadedFile.type,
      fileName: uploadedFile.name || fileSegment,
      uploadedBy: auth.username,
    });

    return jsonResponse({ ok: true, file: ref }, 201);
  }

  if (pathname.startsWith('/api/files/')) {
    if (method !== 'GET') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET para recuperar arquivo do R2.');
    }

    await requireGovernanceAccess(request, env);
    const key = decodeURIComponent(pathname.slice('/api/files/'.length));
    if (!key || key.includes('..')) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Chave de arquivo R2 inválida.');
    }

    const object = await mediaStorage.getMedia(key);
    if (!object) {
      throw new ApiHttpError(404, 'NOT_FOUND', 'Arquivo não encontrado no R2.');
    }

    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': object.contentType,
        'Content-Length': String(object.size),
        ETag: object.etag,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  throw new ApiHttpError(404, 'NOT_FOUND', `Rota de arquivos desconhecida: ${pathname}`);
}
