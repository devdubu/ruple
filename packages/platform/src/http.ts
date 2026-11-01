// Consumer types for contracts/platform/http-v1.schema.json; fixtures verify compatibility.
export const apiErrorCodes = [
  'INVALID_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_ALLOWED',
  'REQUEST_TIMEOUT', 'CONFLICT', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED', 'DEPENDENCY_UNAVAILABLE', 'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = typeof apiErrorCodes[number];
export interface ErrorEnvelope { error: { code: ApiErrorCode; message: string; requestId: string } }
export interface RuntimeContext {
  requestId: string;
  principal: { userId: string; deviceId?: string; vehicleId?: string; source: 'development' | 'verified' };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function only(object: Record<string, unknown>, keys: string[]) {
  return Object.keys(object).every((key) => keys.includes(key));
}
export function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !/[\r\n]/.test(value);
}
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!record(value) || !only(value, ['error']) || !record(value.error)) return false;
  const error = value.error;
  return only(error, ['code', 'message', 'requestId'])
    && (apiErrorCodes as readonly unknown[]).includes(error.code)
    && typeof error.message === 'string' && error.message.length >= 1 && error.message.length <= 160
    && isRequestId(error.requestId);
}
export function parseRuntimeContext(value: unknown): RuntimeContext {
  if (record(value) && only(value, ['requestId', 'principal']) && isRequestId(value.requestId) && record(value.principal)) {
    const principal = value.principal;
    const validId = (id: unknown) => typeof id === 'string' && id.length <= 128
      && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id) && !/[\r\n]/.test(id);
    if (only(principal, ['userId', 'deviceId', 'vehicleId', 'source'])
      && validId(principal.userId) && ['deviceId', 'vehicleId'].every((key) =>
        !Object.hasOwn(principal, key) || validId(principal[key]))
      && (principal.source === 'development' || principal.source === 'verified')) {
      return value as unknown as RuntimeContext;
    }
  }
  throw new TypeError('Invalid runtime context response');
}
