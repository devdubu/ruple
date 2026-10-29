# 백엔드 공통 규약 v1

트랙 A·B의 독립 서비스가 같은 기술 규약으로 개발되도록 공통 HTTP 실행 기반을 제공합니다. 사용자 요청에 따라 기존 NestJS·Fastify·FastAPI와 서비스 경계를 유지해 적용했습니다. 업무 계약·알고리즘·테이블은 담당자가 설계합니다.

## 구현 위치와 계약 정본

- Node: `packages/platform-server`, 네 API/워커의 `createApp`·진입점에서 사용
- Python: `apps/ai-api/src/ruple_ai/runtime.py`, `python -m ruple_ai` 진입점
- 공개 기술 계약: `contracts/platform/http-v1.schema.json`, 정상·오류·거부 예시와 카탈로그의 `platform-http@1.0.0`
- 검사: `pnpm check`, `pnpm check:contracts`, `pnpm test:smoke`

공통 패키지는 각 서비스가 빌드해 사용하는 라이브러리입니다. 별도 중앙 서버나 공유 DB를 요구하지 않습니다. 업무 서비스끼리 내부 코드를 공유하는 경로로 사용하지 않습니다. 프론트의 `platform-server` 참조는 Nx가 차단합니다.

## 경로와 응답

| 경로 | 인증 | 의미 |
|---|---|---|
| `GET /health` | 공개 | HTTP 프로세스 생존. `{status: "ok", service}` |
| `GET /ready` | 공개 | 인증 설정과 등록된 의존성 준비. 준비 시 200·`ready`, 미준비 시 503·`not_ready` |
| `GET /api/v1/runtime/context` | 필요 | 공통 템플릿의 신원·추적 확인용 기술 예제 |
| `/docs`, `/openapi.json` | 비운영에서만 | Swagger UI와 OpenAPI JSON. 운영은 비활성화 |

업무 경로는 `/api/v1` 아래에 둡니다. 성공 응답은 각 API의 스키마를 그대로 반환하고 공통 `data` 래퍼를 강제하지 않습니다. 생성·조회·비동기 접수의 상태 코드는 해당 계약에서 201·200·202 등을 명시합니다. 기술 상태 경로는 사용자·차량·의존성 상세를 공개하지 않습니다.

현재 `/ready`는 기본 `AUTH_MODE=deny`에서 503입니다. 개발 신원 또는 검증기를 연결하고 등록한 probe가 모두 성공하면 200입니다. DB·모델·RAG가 준비됐다는 보장이 되려면 실제 해당 probe를 등록해야 합니다. 현재 AI·DB probe는 없습니다. probe의 실패·예외·1초 초과는 미준비로 처리합니다.

일반 오류는 아래 형태이며, readiness의 503은 위 상태 응답을 사용합니다.

```json
{"error":{"code":"UNAUTHENTICATED","message":"Authentication is required.","requestId":"example-request-1"}}
```

| HTTP | 공통 코드 |
|---|---|
| 400 | INVALID_REQUEST |
| 401 / 403 / 404 | UNAUTHENTICATED / FORBIDDEN / NOT_FOUND |
| 405 / 408 / 415 | METHOD_NOT_ALLOWED / REQUEST_TIMEOUT / UNSUPPORTED_MEDIA_TYPE |
| 409 / 413 / 429 | CONFLICT / PAYLOAD_TOO_LARGE / RATE_LIMITED |
| 502 / 503 / 504 | DEPENDENCY_UNAVAILABLE |
| 500 | INTERNAL_ERROR |

검증 오류는 Node·Python 모두 400으로 정규화합니다. 원본 예외 메시지·스택·SQL·입력값을 응답에 포함하지 않습니다. 표에 없는 예외는 500으로 처리합니다. 업무별 오류 코드 추가는 계약 버전·스키마·예시를 함께 변경합니다. 409·429 등은 형식만 제공하며 동시성 제어·rate limiter를 구현한 것은 아닙니다.

## 환경변수와 실행

| 설정 | 기본값 | 검증 |
|---|---|---|
| `APP_ENV` | `NODE_ENV` 또는 development | development / test / production. NODE_ENV=production과 충돌 금지 |
| `HOST` | 127.0.0.1 | 127.0.0.1 / ::1 / 0.0.0.0 / :: |
| `PORT` | 서비스별 포트 | 정수 1~65535 |
| `AUTH_MODE` | deny | deny / development / verified |
| `DOCS_ENABLED` | 비운영 true, 운영 false | true / false. 운영 true 금지 |
| `DEV_USER_ID` | dev-user | 개발 모드에서 유효한 고정 식별자 |
| `DEV_DEVICE_ID`, `DEV_VEHICLE_ID` | 없음 | 지정하면 빈 값·잘못된 식별자 금지 |
| `CORS_ORIGINS` | 없음 | 정확한 http(s) origin의 쉼표 구분 목록. `*` 금지 |

잘못된 설정은 시작 시 거부합니다. 운영 인증 제공자·Secret·도메인은 아직 선택하지 않았습니다. 각 앱의 `.env.example`에는 비밀 없이 예시만 둡니다. `.env`는 Git에서 제외하며 자동 로딩하지 않습니다.

```bash
# 각자 격리된 개발 환경에서, 서버가 정한 시험 신원으로 실행
AUTH_MODE=development DEV_USER_ID=dev-user pnpm dev:a
AUTH_MODE=development DEV_USER_ID=dev-user pnpm dev:b

# 로컬 Node 앱의 개별 설정 파일을 명시적으로 로드
node --env-file=apps/context-api/.env apps/context-api/dist/main.js

# Python도 같은 HOST·PORT 설정 사용
uv run --project apps/ai-api --locked python -m ruple_ai
```

실제 `.env`는 예시를 복사한 뒤 기기별로 작성합니다. Python 진입점은 개발 환경에서 reload하며 운영에서는 끕니다. 별도 uvicorn CLI로 띄우면 CLI의 host·port가 우선하므로 검증된 진입점을 사용합니다.

## 인증과 요청 맥락

기본 deny에서는 health·ready·개발 문서를 제외한 등록 API를 거부합니다. Node는 전역 Guard, Python은 전역 의존성으로 적용합니다. 새 업무 엔드포인트에도 기본으로 적용되며 공개 엔드포인트는 코드에서 명시합니다.

development는 **비운영·루프백 바인딩**에서만 허용합니다. 사용자·기기·차량 신원은 서버 설정에서 고정합니다. `x-user-id` 등 클라이언트 신원 헤더를 권한으로 사용하지 않습니다. 이 모드는 폐기 가능한 시험 자료용이며 운영 로그인·기기 페어링·차량 접근 제어를 대신하지 않습니다.

verified는 Node `verifyIdentity`, Python `verify_identity` 어댑터가 반드시 필요합니다. 어댑터는 자격 증명과 대상 기기·차량 접근을 검증하고 확인한 신원만 반환합니다. null/None은 401, 검증기 예외는 503입니다. 실제 JWT/OIDC·계정 연결·차량 권한 제공자는 후속 결정 사항입니다. 현재 앱 진입점에 이 제공자를 연결하지 않았으므로 verified를 환경변수로만 켜면 시작에 실패합니다.

입력은 서버가 확인한 `principal`에 연결합니다. 이후 업무별 자원 소유권·동의·후보/루틴 버전·승인은 소유 서비스가 별도로 검증합니다. 인증된 신원만으로 모든 차량 동작을 허용하지 않습니다.

## 요청 추적과 로그

`x-request-id`가 영숫자로 시작하고 영숫자·`.`·`_`·`-`로 최대 64자이면 보존합니다. 없거나 잘못됐거나 중복되면 UUID를 생성합니다. 정상·오류 응답 헤더와 오류 본문에 같은 ID를 반환합니다. 이 값은 불투명한 추적용 식별자이며 개인정보·비밀을 넣지 않습니다.

Node `traceHeaders(context)`, Python `trace_headers(request)`는 다음 호출에 전달할 추적 헤더만 만듭니다. 사용자 신원을 헤더로 복사하지 않으며 인증 전파 방식은 검증기 계약에서 별도 정의합니다. 추적 ID는 승인·실행·중복 방지 키를 대체하지 않습니다.

HTTP 애플리케이션 로그는 JSON으로 event·service·requestId·method·route 템플릿·status·durationMs를 기록합니다. 원본 URL/query·body·Authorization·Cookie·신원 값·원본 예외를 기록하지 않습니다. Python의 기본 uvicorn access log는 끄고 전송 계층 진단도 JSON으로 제한합니다. 비밀을 포함할 수 있는 원본 오류의 디버깅은 명시적인 로컬 디버거에서 수행합니다.

## 입력·브라우저·종료 처리

Node는 전역 ValidationPipe로 DTO 검증과 정의되지 않은 필드 거부를 적용합니다. DTO에는 검증 데코레이터와 OpenAPI 정보를 함께 작성합니다. Python 입력 모델은 `StrictBody`를 상속해 엄격한 타입·추가 필드 거부를 사용합니다. 계약에 필요한 길이·범위·형식은 담당자가 지정합니다.

Node 입력 본문은 1MiB, 본문 수신 제한 시간은 10초입니다. AI의 이미지·오디오 입력 한도와 전송 제한은 실제 멀티모달 계약에서 별도로 정해야 하며 현재 Python에 같은 한도를 구현했다고 간주하지 않습니다. CORS는 기본 비활성화하고 지정한 정확한 origin만 허용합니다. CORS는 인증·네트워크 격리를 대신하지 않습니다.

Node는 종료 신호에 Nest 정상 종료를 적용합니다. Python은 Uvicorn의 ASGI 정상 종료를 사용합니다. DB·워커 작업을 추가할 때 연결 종료·진행 작업·중복·재시도 정책을 함께 구현합니다.

## 서비스 확장 방법과 남은 작업

Node 서비스의 `src/app.ts`에 있는 서비스 정의의 `module`에 자기 업무 모듈을 등록합니다. main과 테스트가 같은 정의를 사용합니다. shared runtime의 타입·JavaScript는 Nx가 의존 서비스보다 먼저 빌드합니다. 공통 런타임을 수정한 뒤에는 재빌드·서비스 재시작합니다.

Python은 `create_app()`에서 자기 라우터를 등록하고 전역 인증 의존성을 유지합니다. 업무용 공개 endpoint를 임의로 추가하지 않습니다. 새 서비스는 정상·오류·인증·계약 검증과 실제 진입점 부팅 시험을 함께 작성합니다.

관련 기반의 현재 제공 범위와 남은 작업은 다음과 같습니다.

- 🚧 실제 인증 제공자, 기기 페어링·동의·차량 권한 구현
- 🚧 목록 페이지·업무 시각·버전·중복 키·충돌 처리의 개별 계약과 구현. 공통 설계 원칙은 [계약 작성 기준](contract-authoring.md) 제공
- 🚧 외부 HTTP 클라이언트의 timeout·취소·재시도 예제. 비멱등 실행을 자동 재시도하지 않도록 별도 설계
- 제공: 로컬 서비스별 Drizzle·DB 역할·기술 예제 migration. 🚧 업무 모델·outbox·pg-boss
- 🚧 AI 본문·오디오 길이·동시성·모델 준비 probe

이 항목들은 해당 기능과 저장·외부 연동을 추가할 때 구체화합니다. 현재 버전은 두 트랙이 같은 HTTP·설정·인증 연결 규약 위에서 설계를 시작할 수 있게 하는 기술 템플릿입니다.
