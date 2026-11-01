# 트랙별 DB와 상대 서비스 모의 실행

각 담당자는 자기 체크아웃·기기 또는 개발 컨테이너에서 실행합니다. 트랙 A·B는 같은 호스트의 웹·API 포트를 사용하므로 동시에 실행하지 않습니다. 운영 서버·k8s·vLLM·RAG에 연결하지 않고 로컬 Docker와 기존 기술 계약만 사용합니다.

## 시작

기본 [설치](README.md#설치) 후 Docker Engine/Desktop과 Compose v2를 준비합니다. 로컬 Docker endpoint만 허용하며 원격 Docker context는 거부합니다. PostgreSQL 공식 이미지의 다이제스트는 `infra/development/images.lock.json`에 고정했습니다. 현재 실제 검증은 Linux x86_64의 PostgreSQL 17.11입니다.

```bash
# 트랙 A: context DB + 실제 context-api·web + 상대 API·AI 모의 서버
pnpm db:up a
pnpm dev:isolated:a

# 트랙 B: automation·interaction DB + 실제 API·worker·web + context·AI 모의 서버
pnpm db:up b
pnpm dev:isolated:b
```

웹은 `http://localhost:5173`입니다. 개발 명령을 종료하면 해당 API·웹·모의 서버를 종료하고 DB는 유지합니다. `pnpm db:down a` 또는 `b`로 DB를 중지합니다. 개발 고정 신원을 사용하는 로컬 모드이며 실제 로그인·권한 체계를 대신하지 않습니다. `APP_ENV` 또는 `NODE_ENV=production`이면 도구 실행을 거부합니다.

기존 `pnpm dev:a`, `dev:b`, `dev:all`은 실제 골격 프로세스 실행용으로 유지합니다. `dev:isolated:*`는 상대 서비스를 실행하지 않고 모의 서버로 대체합니다. A의 AI도 이 모드에서는 모의 서버이므로 Python·GPU가 필요 없습니다. 실제 Python AI 골격까지 시험할 때는 기존 `dev:a`를 사용합니다.

## DB 소유권과 마이그레이션

| 소유 서비스 | 트랙 | 로컬 포트 | DB | 스키마·마이그레이션 |
|---|---|---|---|---|
| context | A | 55431 | ruple_context | `packages/context/server/{src/db,db/migrations}` |
| automation | B | 55432 | ruple_automation | `packages/automation/server/{src/db,db/migrations}` |
| interaction | B | 55433 | ruple_interaction | `packages/interaction/server/{src/db,db/migrations}` |

각 DB는 별도 컨테이너·볼륨·브리지 네트워크를 사용하고 호스트의 `127.0.0.1`에만 포트를 엽니다. 로컬 관리자에게서 컨테이너를 숨기는 격리나 운영 NetworkPolicy를 제공하지는 않습니다. DB 포트 변경이 필요하면 **최초 준비 전** `CONTEXT_DB_PORT`, `AUTOMATION_DB_PORT`, `INTERACTION_DB_PORT`를 지정합니다.

- `ruple_admin`: 컨테이너 초기화용. 앱에 전달하지 않습니다.
- `ruple_migrator`: 자기 DB의 DDL·Drizzle journal·초기 데이터용.
- `ruple_runtime`: `app` 스키마의 DML만 허용. 테이블·역할 생성, journal 읽기, `postgres` DB 접속을 거부합니다.

비밀번호는 무작위 생성하며 Git 제외 경로 `local-artifacts/development/<a|b>/`의 `state.json`·`compose.env`에 보관합니다. 파일 권한은 600으로 생성합니다. 이 파일과 URL을 로그·이슈·인계 자료에 복사하지 않습니다. 상태 파일을 지우면 기존 볼륨의 비밀번호와 달라지므로, 상태·볼륨을 임의로 따로 삭제하지 않습니다.

각 앱에는 자기 `*_DATABASE_URL`의 runtime 계정만 전달합니다. 워커는 automation 소유 계정을 공유하고 웹에는 DB URL을 전달하지 않습니다. 마이그레이션 자격 증명은 해당 CLI에만 주입합니다. 다른 서비스 ORM 모델을 import하거나 DB를 직접 읽지 않습니다.

```bash
pnpm db:generate a context       # 자기 schema.ts 변경 후 SQL·snapshot 생성
pnpm db:generate b automation
pnpm db:generate b interaction
pnpm db:migrate a                # migration만 적용
pnpm db:seed a                   # migration 후 기술 예제 데이터를 upsert
pnpm db:verify a                 # 예제 데이터·runtime 권한 확인
pnpm db:down a                   # 볼륨 유지
pnpm db:reset a --confirm-local-reset  # 이 도구의 해당 트랙 볼륨 삭제·재생성
```

`b`에도 같은 명령을 사용합니다. 적용한 SQL·snapshot·journal은 함께 커밋하고 적용 후 SQL을 수정하지 않습니다. `db:up`은 migration·seed·권한 검증까지 수행합니다. 현재 예제는 `app.development_probe` 한 테이블과 고정 키 `baseline`의 합성 데이터뿐입니다. 추천·루틴·사용자·실행 스키마, outbox·pg-boss는 담당자가 계약을 확인한 뒤 설계합니다.

각 도메인 server 패키지의 `createDatabase(url)`은 자기 Drizzle schema와 공통 pool·`ready()`·`close()`를 제공합니다. 아직 API는 DB를 사용하지 않습니다. 기능 구현 시 Nest provider가 리소스를 소유하고 공통 런타임의 `readinessChecks`에 `resource.ready`, 종료 lifecycle에 `resource.close`를 연결합니다. 이 연결 전 `/ready`를 DB 준비 완료로 해석하지 않습니다. 배포 시 해당 server 패키지의 `dist`와 production 의존성도 포함합니다.

## 계약 기반 모의 응답

현재 등록한 것은 `/health`, `/ready`, `GET /api/v1/runtime/context`의 **기술 응답**입니다. AI 추론·추천·루틴·차량 실행의 업무 응답을 임의로 만들지 않았습니다. 모든 응답에 `x-ruple-mock: true`를 붙이고, 미등록 경로는 404를 반환합니다. 실제 차량 호출은 없습니다.

`contracts/development/mock-routes.json`은 `catalog.json`에 등록된 계약의 valid 예시를 참조합니다. 서버는 예시와 응답을 같은 JSON Schema로 검사합니다. 새 업무 경로는 계약·예시를 먼저 합의한 뒤 여기에 등록합니다. 현재 등록 경로는 모든 peer의 공통 기술 경로이며 서비스별 업무 라우팅이 필요하면 registry에 서비스 구분을 함께 추가합니다.

```bash
# 별도 터미널: 트랙 B가 보는 context를 일시 장애로 바꾼 후 복구
pnpm mock:scenario b context unavailable
pnpm mock:scenario b context success

# 실제 앱 없이 상대 모의 서버만 실행
pnpm mock:serve b
```

| 시나리오 | 결과 |
|---|---|
| success | 등록된 정상 예시 |
| unauthenticated / forbidden | 401 / 403 |
| conflict / expired | 409 기술 오류. 실제 업무 만료 판정은 미구현 |
| unavailable / error | 503 / 500 |
| slow | 기본 1,500ms 지연. 로컬 `mocks.json`에서 1~60,000ms 설정 |
| offline | 등록 API 요청의 소켓을 끊어 전송 실패 재현 |
| malformed | 잘못된 JSON으로 소비자 검증 실패 재현 |
| empty | 승인된 빈 결과 예시가 있어야 설정 가능. 현재 계약에는 없어 CLI가 거부 |

장애는 실행 중 다음 요청부터 반영합니다. `offline`에서도 `/health`는 살아 있고 `/ready`는 503이므로 프로세스 종료와 응답 실패를 구분합니다. success로 돌려 재연결·재요청을 시험할 수 있지만 업무 재전달·중복·실제 승인 상태를 검증하지는 않습니다. 웹 프록시 `/services/<service>/...`에서도 동일한 헤더·응답을 확인할 수 있습니다.

## 시험 시각

```bash
pnpm dev:clock a show
pnpm dev:clock a advance 7776000000  # 90일, 대기 없이 이동
pnpm dev:clock a set 2026-01-01T00:00:00.000Z
pnpm db:seed a                      # 기술 예제 관측 시각에 반영
```

초기 시각은 `2026-01-01T00:00:00.000Z`입니다. 모의 서버는 `x-ruple-test-clock` 헤더로 시험 시각을 표시합니다. 실제 도메인의 시간 판정은 `@ruple/platform`의 `Clock`을 주입하고 시험에서 `createFixedClock`을 사용합니다. 전역 Date나 실제 서버 시계를 바꾸지 않으며 기존 앱의 업무 타이머에 자동 연결하지 않습니다.

## 검증

```bash
pnpm check              # 기본 검사 + 로컬 상태·모의 HTTP 시험
pnpm test:dev-db        # 임시 포트·프로젝트로 실제 PostgreSQL 검증 후 해당 볼륨 삭제
pnpm test:isolated      # A/B 실제 앱 + peer 모의 서버·웹 프록시·복구·종료
```

DB 시험은 migration·seed 반복 적용, Drizzle 읽기·쓰기, 90일 시각 이동, runtime의 DDL·journal·타 DB 접근 거부를 확인합니다. Docker 접근이 필요한 시험과 HTTP listener 시험은 해당 권한이 있는 환경에서 실행합니다. 테스트 로그는 `local-artifacts/` 아래에 보관합니다. CLI가 `LOCAL_SETUP_ERROR`를 반환하면 Docker 실행 상태·포트 중복·해당 트랙 설정을 확인하며, 생성된 `compose.env`나 `state.json` 전체를 출력해 진단하지 않습니다.
