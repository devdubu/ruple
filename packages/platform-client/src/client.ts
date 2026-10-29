import { isErrorEnvelope, isRequestId, type ApiErrorCode } from '@ruple/platform';

type FailureKind = 'http' | 'network' | 'timeout' | 'aborted' | 'invalid-response' | 'configuration';
const messages: Partial<Record<ApiErrorCode, string>> = {
  INVALID_REQUEST: '입력 내용을 확인해주세요.',
  UNAUTHENTICATED: '로그인이 필요해요.',
  FORBIDDEN: '이 작업에 접근할 수 없어요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없어요.',
  CONFLICT: '정보가 변경됐어요. 최신 내용을 확인해주세요.',
  RATE_LIMITED: '요청이 많아요. 잠시 후 다시 시도해주세요.',
  PAYLOAD_TOO_LARGE: '첨부한 내용이 너무 커요.',
  DEPENDENCY_UNAVAILABLE: '서비스 연결을 확인하지 못했어요. 잠시 후 다시 시도해주세요.',
};

export class ApiError extends Error {
  readonly kind: FailureKind;
  readonly status?: number;
  readonly code?: ApiErrorCode;
  readonly requestId?: string;
  constructor(kind: FailureKind, details: { status?: number; code?: ApiErrorCode; requestId?: string } = {}) {
    super(kind === 'aborted' ? '요청이 취소됐어요.' : kind === 'timeout' ? '응답을 기다리는 시간이 길어졌어요.'
      : kind === 'network' ? '네트워크 연결을 확인해주세요.'
        : details.code ? messages[details.code] ?? '요청을 처리하지 못했어요.' : '서버 응답을 확인하지 못했어요.');
    this.name = 'ApiError';
    this.kind = kind; this.status = details.status; this.code = details.code; this.requestId = details.requestId;
  }
}
export function apiErrorDetails(error: unknown) {
  return error instanceof ApiError ? { message: error.message, requestId: error.requestId }
    : { message: '정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  fetch?: typeof globalThis.fetch;
}
export interface RequestOptions { signal?: AbortSignal; body?: unknown; method?: Method }

function requestId() {
  // getRandomValues also works in local HTTP contexts where randomUUID may be absent.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createApiClient(options: ApiClientOptions) {
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new ApiError('configuration');
  const origin = globalThis.location?.origin ?? 'http://localhost';
  const relative = options.baseUrl.startsWith('/') && !options.baseUrl.startsWith('//');
  let base: URL;
  try {
    base = new URL(options.baseUrl, origin);
    if ((!relative && !/^https?:\/\//.test(options.baseUrl)) || !['http:', 'https:'].includes(base.protocol)
      || base.username || base.password || base.search || base.hash || /[\\\r\n]/.test(options.baseUrl)) throw new Error();
  } catch { throw new ApiError('configuration'); }
  const prefix = base.pathname.replace(/\/$/, '');

  async function request<T>(path: string, decode: (value: unknown) => T, config: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n#]/.test(path)) throw new ApiError('configuration');
    const url = new URL(base.origin + prefix + path);
    if (url.origin !== base.origin || (prefix && !url.pathname.startsWith(`${prefix}/`))) throw new ApiError('configuration');
    const correlationId = requestId();
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (config.signal?.aborted) throw new ApiError('aborted', { requestId: correlationId });
    config.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let cancelListener: (() => void) | undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancelListener = () => reject(new ApiError(timedOut ? 'timeout' : 'aborted', { requestId: correlationId }));
      controller.signal.addEventListener('abort', cancelListener, { once: true });
    });
    const perform = async () => {
      const token = await options.getAccessToken?.();
      if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'aborted', { requestId: correlationId });
      if (token !== undefined && (!token || /[\r\n]/.test(token))) throw new ApiError('configuration', { requestId: correlationId });
      const headers: Record<string, string> = { accept: 'application/json', 'x-request-id': correlationId };
      if (token) headers.authorization = `Bearer ${token}`;
      if (config.body !== undefined) headers['content-type'] = 'application/json';
      const response = await (options.fetch ?? globalThis.fetch)(relative ? url.pathname + url.search : url.href, {
        method: config.method ?? 'GET', body: config.body === undefined ? undefined : JSON.stringify(config.body),
        headers, signal: controller.signal, credentials: 'omit', redirect: 'error',
      });
      const responseId = response.headers.get('x-request-id');
      const correlation = isRequestId(responseId) ? responseId : correlationId;
      let value: unknown;
      try { value = await response.json(); }
      catch { throw new ApiError('invalid-response', { status: response.status, requestId: correlation }); }
      if (!response.ok) {
        if (!isErrorEnvelope(value) || (responseId && (!isRequestId(responseId) || responseId !== value.error.requestId))) {
          throw new ApiError('invalid-response', { status: response.status, requestId: correlation });
        }
        throw new ApiError('http', { code: value.error.code, status: response.status, requestId: value.error.requestId });
      }
      if (responseId && !isRequestId(responseId)) throw new ApiError('invalid-response', { status: response.status, requestId: correlationId });
      try { return decode(value); }
      catch { throw new ApiError('invalid-response', { status: response.status, requestId: correlation }); }
    };
    try { return await Promise.race([perform(), cancellation]); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'aborted', { requestId: correlationId });
      throw new ApiError('network', { requestId: correlationId });
    } finally {
      clearTimeout(timer);
      config.signal?.removeEventListener('abort', abort);
      if (cancelListener) controller.signal.removeEventListener('abort', cancelListener);
    }
  }
  return {
    request,
    get: <T>(path: string, decode: (value: unknown) => T, config: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      request(path, decode, { ...config, method: 'GET' }),
  };
}
