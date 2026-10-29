export type AuthMode = 'deny' | 'development' | 'verified';
export interface Identity { userId: string; deviceId?: string; vehicleId?: string }
export interface Principal extends Identity { source: 'development' | 'verified' }
export interface ServiceConfig {
  environment: 'development' | 'test' | 'production';
  host: string;
  port: number;
  docsEnabled: boolean;
  authMode: AuthMode;
  developmentIdentity: Identity;
  corsOrigins: string[];
}

export const identityIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class ConfigurationError extends Error {
  constructor(key: string) { super(`Invalid configuration: ${key}`); }
}

export function validIdentity(value: Identity): boolean {
  return typeof value?.userId === 'string' && identityIdPattern.test(value.userId)
    && [value.deviceId, value.vehicleId].every((id) => id === undefined
      || (typeof id === 'string' && identityIdPattern.test(id)));
}

export function loadConfig(defaultPort: number, env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const environment = env.APP_ENV ?? env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)
    || (env.NODE_ENV === 'production' && environment !== 'production')) {
    throw new ConfigurationError('APP_ENV/NODE_ENV');
  }
  const rawPort = env.PORT ?? String(defaultPort);
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new ConfigurationError('PORT');
  }
  const host = env.HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '::1', '0.0.0.0', '::'].includes(host)) throw new ConfigurationError('HOST');
  const authMode = env.AUTH_MODE ?? 'deny';
  if (!['deny', 'development', 'verified'].includes(authMode)) throw new ConfigurationError('AUTH_MODE');
  if (authMode === 'development' && (environment === 'production' || !['127.0.0.1', '::1'].includes(host))) {
    throw new ConfigurationError('AUTH_MODE');
  }
  const rawDocs = env.DOCS_ENABLED ?? String(environment !== 'production');
  if (!['true', 'false'].includes(rawDocs) || (environment === 'production' && rawDocs === 'true')) {
    throw new ConfigurationError('DOCS_ENABLED');
  }
  const developmentIdentity = {
    userId: env.DEV_USER_ID ?? 'dev-user',
    ...(env.DEV_DEVICE_ID !== undefined ? { deviceId: env.DEV_DEVICE_ID } : {}),
    ...(env.DEV_VEHICLE_ID !== undefined ? { vehicleId: env.DEV_VEHICLE_ID } : {}),
  };
  if (authMode === 'development' && !validIdentity(developmentIdentity)) throw new ConfigurationError('DEV_*_ID');
  const corsOrigins = env.CORS_ORIGINS === undefined ? [] : env.CORS_ORIGINS.split(',');
  for (const origin of corsOrigins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error();
    } catch { throw new ConfigurationError('CORS_ORIGINS'); }
  }
  return { environment: environment as ServiceConfig['environment'], host, port: Number(rawPort),
    docsEnabled: rawDocs === 'true', authMode: authMode as AuthMode, developmentIdentity, corsOrigins };
}
