import { ApiHttpError, Env } from './types.ts';
import {
  createPowerAutomateClient,
  PowerAutomateClient,
} from './integrations/powerAutomateClient.ts';
import { handleGovernanceRoute } from './routes/governance.ts';
import { handleFilesRoute } from './routes/files.ts';
import { errorResponse, jsonResponse } from './utils/http.ts';

export interface WorkerDependencies {
  powerAutomate?: PowerAutomateClient;
}

export async function handleWorkerRequest(
  request: Request,
  env: Env,
  deps?: WorkerDependencies
): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (url.pathname.startsWith('/api/governance/')) {
      const powerAutomate = deps?.powerAutomate ?? createPowerAutomateClient(env);
      return await handleGovernanceRoute(request, url, env, { powerAutomate });
    }

    if (url.pathname === '/api/files' || url.pathname.startsWith('/api/files/')) {
      return await handleFilesRoute(request, url, env);
    }

    if (url.pathname.startsWith('/api/')) {
      throw new ApiHttpError(404, 'NOT_FOUND', `Endpoint da API não encontrado: ${url.pathname}`);
    }

    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return jsonResponse(
      {
        ok: false,
        error: 'Binding ASSETS não configurado para servir o frontend estático.',
        code: 'NOT_FOUND',
      },
      404
    );
  } catch (err) {
    return errorResponse(err);
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env, _ctx) {
    return handleWorkerRequest(request, env);
  },
};

export default worker;
