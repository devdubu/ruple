import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  ArgumentsHost, Catch, Controller, Get, HttpException, Module, Req, Res,
  SetMetadata, UnauthorizedException, ServiceUnavailableException, ValidationPipe,
  type CanActivate, type ExceptionFilter, type ExecutionContext, type Type,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ConfigurationError, identityIdPattern, loadConfig, validIdentity, type Identity, type Principal } from './config';

const PUBLIC = 'ruple:public';
export const PublicEndpoint = () => SetMetadata(PUBLIC, true);
export const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function makeRequestId(value: unknown): string {
  return typeof value === 'string' && requestIdPattern.test(value) ? value : randomUUID();
}

export interface RequestContext { requestId: string; principal?: Principal }
const identities = new WeakMap<FastifyRequest, Principal>();
export function requestContext(request: FastifyRequest): RequestContext {
  return { requestId: request.id, principal: identities.get(request) };
}
export function traceHeaders(context: RequestContext): Record<string, string> {
  return { 'x-request-id': context.requestId };
}

export interface LogRecord {
  event: 'http.request.completed' | 'service.started' | 'service.start.failed';
  service: string;
  requestId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
}
export type LogSink = (record: LogRecord) => void;
export const jsonLog: LogSink = (record) => console.info(JSON.stringify(record));

const errors: Record<number, [string, string]> = {
  400: ['INVALID_REQUEST', 'Request validation failed.'],
  401: ['UNAUTHENTICATED', 'Authentication is required.'],
  403: ['FORBIDDEN', 'Access is denied.'],
  404: ['NOT_FOUND', 'Resource was not found.'],
  405: ['METHOD_NOT_ALLOWED', 'HTTP method is not allowed.'],
  408: ['REQUEST_TIMEOUT', 'Request timed out.'],
  409: ['CONFLICT', 'Resource version or state conflicts.'],
  413: ['PAYLOAD_TOO_LARGE', 'Request payload is too large.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Request media type is not supported.'],
  429: ['RATE_LIMITED', 'Too many requests.'],
  503: ['DEPENDENCY_UNAVAILABLE', 'A required dependency is unavailable.'],
  502: ['DEPENDENCY_UNAVAILABLE', 'A required dependency is unavailable.'],
  504: ['DEPENDENCY_UNAVAILABLE', 'A required dependency is unavailable.'],
  500: ['INTERNAL_ERROR', 'An internal error occurred.'],
};
export function errorEnvelope(status: number, requestId: string) {
  const [code, message] = errors[status] ?? errors[500];
  return { error: { code, message, requestId } };
}

@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const original = exception instanceof HttpException ? exception.getStatus()
      : typeof exception === 'object' && exception !== null && 'statusCode' in exception
        && typeof exception.statusCode === 'number' ? exception.statusCode : 500;
    const status = errors[original] ? original : original === 422 ? 400 : 500;
    reply.status(status).send(errorEnvelope(status, request.id));
  }
}

class PrincipalDto implements Principal {
  @ApiProperty({ pattern: identityIdPattern.source }) userId!: string;
  @ApiProperty({ required: false, pattern: identityIdPattern.source }) deviceId?: string;
  @ApiProperty({ required: false, pattern: identityIdPattern.source }) vehicleId?: string;
  @ApiProperty({ enum: ['development', 'verified'] }) source!: Principal['source'];
}
class ContextDto {
  @ApiProperty({ pattern: requestIdPattern.source }) requestId!: string;
  @ApiProperty({ type: PrincipalDto }) principal!: PrincipalDto;
}
class ErrorDetailDto {
  @ApiProperty({ enum: [...new Set(Object.values(errors).map(([code]) => code))] }) code!: string;
  @ApiProperty({ minLength: 1, maxLength: 160 }) message!: string;
  @ApiProperty({ pattern: requestIdPattern.source }) requestId!: string;
}
class ErrorEnvelopeDto {
  @ApiProperty({ type: ErrorDetailDto }) error!: ErrorDetailDto;
}
class HealthDto {
  @ApiProperty({ enum: ['ok'] }) status!: string;
  @ApiProperty() service!: string;
}
class ReadinessDto {
  @ApiProperty({ enum: ['ready', 'not_ready'] }) status!: string;
  @ApiProperty() service!: string;
}

export interface ServiceOptions {
  service: string;
  defaultPort: number;
  env?: NodeJS.ProcessEnv;
  log?: LogSink;
  // Adapter verifies credentials and device/vehicle access; raw headers are never identity.
  verifyIdentity?: (request: FastifyRequest) => Promise<Identity | null>;
  readinessChecks?: Array<() => Promise<boolean>>;
  module?: Type;
}

@Module({})
class EmptyModule {}

export async function createServiceApp(options: ServiceOptions): Promise<NestFastifyApplication> {
  const config = loadConfig(options.defaultPort, options.env);
  if (config.authMode === 'verified' && !options.verifyIdentity) throw new ConfigurationError('AUTH_MODE verifier');
  const log = options.log ?? jsonLog;
  const readiness = async () => {
    if (config.authMode === 'deny') return false;
    try {
      return (await Promise.all((options.readinessChecks ?? []).map(async (probe) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            probe(), new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 1000); }),
          ]);
        } finally { clearTimeout(timer); }
      }))).every((value) => value === true);
    } catch { return false; }
  };

  @Controller()
  class RuntimeController {
    @PublicEndpoint()
    @ApiOkResponse({ type: HealthDto })
    @Get('health')
    health() { return { status: 'ok', service: options.service }; }

    @PublicEndpoint()
    @ApiOkResponse({ type: ReadinessDto })
    @ApiResponse({ status: 503, type: ReadinessDto })
    @Get('ready')
    async ready(@Res({ passthrough: true }) reply: FastifyReply) {
      const available = await readiness();
      reply.status(available ? 200 : 503);
      return { status: available ? 'ready' : 'not_ready', service: options.service };
    }

    @ApiBearerAuth()
    @ApiOkResponse({ type: ContextDto })
    @Get('runtime/context')
    context(@Req() request: FastifyRequest) { return requestContext(request); }
  }

  @Module({ imports: [options.module ?? EmptyModule], controllers: [RuntimeController] })
  class RootModule {}

  const adapter = new FastifyAdapter({
    logger: false, bodyLimit: 1048576, requestTimeout: 10000,
    requestIdHeader: false,
    genReqId: (request: IncomingMessage) => makeRequestId(request.headers['x-request-id']),
    trustProxy: false,
  });
  const app = await NestFactory.create<NestFastifyApplication>(RootModule, adapter, { logger: false, abortOnError: false });
  const server = adapter.getInstance();
  const started = new WeakMap<FastifyRequest, number>();
  server.addHook('onRequest', async (request, reply) => {
    started.set(request, performance.now());
    reply.header('x-request-id', request.id);
  });
  server.addHook('onResponse', async (request, reply) => {
    log({ event: 'http.request.completed', service: options.service, requestId: request.id,
      method: request.method, route: request.routeOptions.url ?? '__unmatched__',
      status: reply.statusCode, durationMs: Math.round(performance.now() - (started.get(request) ?? performance.now())) });
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: false,
    validationError: { target: false, value: false },
  }));
  const reflector = new Reflector();
  const guard: CanActivate = {
    async canActivate(context: ExecutionContext) {
      if (reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()])) return true;
      const request = context.switchToHttp().getRequest<FastifyRequest>();
      let identity: Identity | null = null;
      if (config.authMode === 'development') identity = config.developmentIdentity;
      if (config.authMode === 'verified') {
        try { identity = await options.verifyIdentity!(request); }
        catch { throw new ServiceUnavailableException(); }
      }
      if (!identity || !validIdentity(identity)) throw new UnauthorizedException();
      identities.set(request, { userId: identity.userId,
        ...(identity.deviceId !== undefined ? { deviceId: identity.deviceId } : {}),
        ...(identity.vehicleId !== undefined ? { vehicleId: identity.vehicleId } : {}),
        source: config.authMode === 'development' ? 'development' : 'verified' });
      return true;
    },
  };
  app.useGlobalGuards(guard);
  if (config.corsOrigins.length) app.enableCors({ origin: config.corsOrigins, credentials: false,
    allowedHeaders: ['content-type', 'authorization', 'x-request-id'], exposedHeaders: ['x-request-id'] });
  if (config.docsEnabled) {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle(`Ruple ${options.service}`).setVersion('1.0.0').addBearerAuth()
      .addGlobalParameters({ name: 'x-request-id', in: 'header', required: false,
        schema: { type: 'string', pattern: requestIdPattern.source } }).build(),
    { extraModels: [ErrorEnvelopeDto] });
    for (const item of Object.values(document.paths)) {
      for (const operation of Object.values(item ?? {})) {
        if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
        for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
          operation.responses ??= {};
          operation.responses[status] ??= { description: errors[status][1], content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelopeDto' } },
          } };
        }
      }
    }
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'openapi.json', raw: ['json'] });
  }
  return app;
}

export async function runService(options: ServiceOptions): Promise<void> {
  const log = options.log ?? jsonLog;
  try {
    const config = loadConfig(options.defaultPort, options.env);
    const app = await createServiceApp(options);
    await app.listen(config.port, config.host);
    log({ event: 'service.started', service: options.service });
  } catch {
    log({ event: 'service.start.failed', service: options.service });
    process.exitCode = 1;
  }
}
