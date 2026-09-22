export type BackendMode = 'local' | 'live';

export interface ApiConfig {
  mode: BackendMode;
  baseUrl: string;
  useMock: boolean; // Kept for backward compatibility (true when mode === 'local')
  timeoutMs: number;
}

const STORAGE_KEY = 'rag_auditor_api_config';

// Detect environment variable if provided by Vite
const ENV_BASE_URL: string =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : '';

export const DEFAULT_API_CONFIG: ApiConfig = {
  mode: ENV_BASE_URL ? 'live' : 'local',
  baseUrl: ENV_BASE_URL,
  useMock: !ENV_BASE_URL,
  timeoutMs: 15000,
};

let inMemoryConfig: ApiConfig = { ...DEFAULT_API_CONFIG };

export function getStoredApiConfig(): ApiConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate or sanitize stored config
        let mode: BackendMode = 'local';
        if (parsed.mode === 'live' || parsed.mode === 'local') {
          mode = parsed.mode;
        } else if (parsed.baseUrl && parsed.baseUrl !== 'http://localhost:8000' && parsed.useMock === false) {
          mode = 'live';
        }

        const baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : ENV_BASE_URL;
        const timeoutMs = typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : 15000;

        return {
          mode,
          baseUrl,
          useMock: mode === 'local',
          timeoutMs,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored API config, using defaults', e);
  }
  return { ...inMemoryConfig };
}

export function setStoredApiConfig(config: Partial<ApiConfig>): ApiConfig {
  const current = getStoredApiConfig();
  const nextMode: BackendMode =
    config.mode ?? (config.useMock !== undefined ? (config.useMock ? 'local' : 'live') : current.mode);

  const updated: ApiConfig = {
    ...current,
    ...config,
    mode: nextMode,
    useMock: nextMode === 'local',
  };

  inMemoryConfig = updated;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to persist API config', e);
  }
  return updated;
}

export class ApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getStoredApiConfig();

  // Guard: if mode is local or baseUrl is empty, prevent network calls
  if (config.mode !== 'live' || !config.baseUrl.trim()) {
    throw new ApiError('Live backend is not enabled or configured.', 0);
  }

  const cleanBase = config.baseUrl.replace(/\/$/, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${cleanBase}/${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // Temporary development logging
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  if (isDev) {
    let payload = options.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        // Keep original string if not JSON
      }
    }
    console.log('[API REQUEST]', {
      method,
      url,
      payload,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errDetail;
      try {
        errDetail = await response.json();
      } catch {
        errDetail = await response.text();
      }

      if (isDev) {
        console.error('[API ERROR]', {
          url,
          error: `HTTP ${response.status} ${response.statusText}`,
          detail: errDetail,
        });
      }

      throw new ApiError(
        `The audit service returned an error (${response.status}). Please try again.`,
        response.status,
        errDetail
      );
    }

    const data = (await response.json()) as T;

    if (isDev) {
      console.log('[API RESPONSE]', {
        status: response.status,
        response: data,
      });
    }

    return data;
  } catch (error: any) {
    if (isDev) {
      console.error('[API ERROR]', {
        url,
        error: error?.message || String(error),
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new ApiError(
        `The audit request timed out after ${config.timeoutMs}ms. Please try again.`,
        408
      );
    }

    // Map network failures (e.g. TypeError: Failed to fetch) to human-friendly message
    throw new ApiError(
      'Unable to connect to the audit backend. Check the backend connection.',
      0,
      error
    );
  } finally {
    clearTimeout(timer);
  }
}
