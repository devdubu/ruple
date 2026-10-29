# 독립 개발 작업공간

트랙 A·B는 각자의 체크아웃과 실행 환경에서 기능을 설계·개발합니다. 하나의 모노레포를 사용하지만 배포 서비스와 DB 소유권은 분리합니다. 연결은 공개 API·이벤트 계약을 사용합니다.

## 현재 제공하는 기반

[2026-10-29 로컬 검증 기록](verification-2026-10-29.md)에 대상 기준 커밋과 실행 결과·한계를 남겼습니다.

- pnpm·Nx와 TypeScript 공통 설정, React·Vite 웹 셸
- NestJS·Fastify API 3개와 워커 프로세스 골격, Python FastAPI 골격
- DB·GPU·상대 서비스 없이 부팅하는 `/health`
- 트랙별 실행 명령, 프로젝트 의존성 검사와 금지 참조 회귀 시험
- lint·타입 검사·기본 시험·빌드를 수행하는 CI
- [백엔드 공통 규약 v1](backend-conventions.md): 설정 검증·인증 연결·오류·요청 추적·JSON 로그·OpenAPI
- [프론트 공통 기반 v1](frontend-foundation.md): 토큰·컴포넌트·화면 등록·API 주입·Query·개발 미리보기
- [트랙별 DB·모의 실행](isolated-development.md): 서비스별 로컬 PostgreSQL·역할·Drizzle·기술 예제 데이터·상대 API 모의 응답·시험 시각

`/health`는 프로세스의 HTTP 응답 여부만 뜻합니다. `/ready`는 인증 설정과 등록한 probe를 검사하며 기본 `AUTH_MODE=deny`에서는 503입니다. DB·모델·RAG·작업 큐 준비나 제품 기능 완료를 뜻하지 않습니다. 워커는 기술 상태 API만 실행하며 예약·작업 처리를 하지 않습니다.

## 설치

Node.js `24.19.0`(24 LTS), pnpm `11.25.0`, Python `3.12`, uv `0.12.23`을 사용합니다. Node 버전은 `.node-version`, pnpm은 루트 `packageManager`, Python은 AI 프로젝트에 명시했습니다. Node 24에는 Corepack이 기본 포함되지 않을 수 있으므로 pnpm을 별도로 설치합니다.

```bash
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile

# AI 골격까지 실행하거나 전체 검사할 때
uv sync --project apps/ai-api --locked
```

JavaScript와 Python 의존성은 각각 `pnpm-lock.yaml`, `apps/ai-api/uv.lock`으로 고정합니다. AI 가상환경은 `apps/ai-api/.venv`에 생성되며 커밋하지 않습니다. 트랙 B 실행에는 Python·uv·GPU가 필요하지 않습니다.

## 트랙별 실행

```bash
# 권장 독립 개발: 자기 서비스 + 상대 서비스·AI 모의 서버
pnpm db:up a
pnpm dev:isolated:a
# 트랙 B는 pnpm db:up b, pnpm dev:isolated:b

# A의 실제 골격만 실행: 웹의 근거·제안 진입점 + context-api + ai-api
pnpm dev:a

# B: 웹의 루틴·실행 진입점 + automation-api + worker + interaction-api
pnpm dev:b

# 통합 개발 때만 전체 골격 실행
pnpm dev:all

# 백엔드 없이 UI 재료 확인: /#/ui-preview
pnpm dev:ui

# 개별 서비스만 실행
pnpm nx serve context-api
```

기본 웹 주소는 `http://localhost:5173`입니다. 모든 개발 서버는 기본적으로 루프백에 바인딩합니다. A·B는 별도 기기·VM·개발 컨테이너 등 각자의 환경에서 실행하는 기준입니다. 두 트랙 명령을 같은 호스트에서 동시에 실행하면 공통 웹 포트가 충돌합니다. 같은 호스트에 복수 사본을 실행할 때는 Vite CLI의 `--port`와 각 Node·Python 서비스의 `PORT`를 따로 지정합니다.

| 프로세스 | 기본 포트 | 담당 |
|---|---|---|
| web | 5173 | 공통 셸·기능별 진입점 |
| context-api | 3001 | 트랙 A, M1·M2 |
| automation-api | 3002 | 트랙 B, M3·M4 |
| interaction-api | 3003 | 트랙 B, M5·M6 |
| automation-worker | 3004 | 트랙 B, 향후 예약·작업 처리 |
| ai-api | 3010 | 트랙 A 중심 AI 연계 |

`VITE_DEV_TRACK=a|b|all`로 웹에서 로드하는 기능 진입점을 선택합니다. 서버 호출과 업무 화면은 아직 없으며, 이 설정은 개발 편의를 위한 것으로 배포·인증·보안 격리를 대신하지 않습니다.

Node API·워커와 Python 진입점은 `HOST`·`PORT`를 지원합니다. 기본 인증은 거부이며, 시험 신원으로 실행하려면 `AUTH_MODE=development pnpm dev:a`처럼 명시합니다. 상세 설정·오류·문서 경로는 [백엔드 규약](backend-conventions.md)을 따릅니다. 실제 운영 인증 제공자와 업무 권한 검증은 아직 연결하지 않았습니다.

## 소스와 소유권

| 위치 | 내용 |
|---|---|
| `apps/*` | 서비스별 부팅·배포 진입점, 웹 셸, AI·차량 호스트 |
| `packages/context/{ui,contracts,server}` | 트랙 A 기능 화면·공개 타입·서버 내부 |
| `packages/automation/{ui,contracts,server}` | 트랙 B 루틴 기능 |
| `packages/interaction/{ui,contracts,server}` | 트랙 B 실행·상호작용 기능 |
| `packages/presentation` | 공통 웹 셸과 기능 진입점 형식 |
| `packages/platform-client` | 브라우저 API·Query·캐시 경계 |
| `packages/platform` | 도메인 로직이 없는 공통 기술 기반 |
| `packages/platform-server` | Node 전용 HTTP·설정·인증 연결·문서 런타임 |
| `contracts/` | 승인할 API·이벤트 스키마·예시의 정본 |

`contracts` 패키지의 업무 필드는 미정입니다. `server`에는 자기 DB factory·Drizzle 설정과 기술 시험용 테이블만 제공하며 업무 ORM 모델은 아직 없습니다. 상세 공개 타입을 임의로 확정하지 않고 `contracts/catalog.json`에 합의한 계약을 등록한 뒤 연결합니다.

허용되는 의존성은 자기 도메인 내부와 상대 도메인의 공개 계약입니다. 다른 도메인의 UI·server 내부, 앱에서 다른 앱, 브라우저에서 서버, 공통 패키지에서 업무 도메인 참조는 차단합니다. 트랙 B 안의 automation과 interaction도 별도 서비스 경계를 유지합니다.

Nx tag·ESLint는 TypeScript 프로젝트 참조를 검사합니다. Python·Android의 참조와 실행 중 DB 권한은 이것만으로 차단되지 않습니다. 로컬 개발 DB에는 서비스별 컨테이너·역할을 적용했고 운영 네트워크 정책은 후속 단계에서 적용합니다. 현재 부팅 경로에는 DB·서비스 간 통신이 없습니다.

## 검사와 빌드

```bash
pnpm nx show projects
pnpm nx graph
pnpm check
pnpm test:prototype
pnpm test:smoke
git diff --check

# 자기 영역만 빠르게 점검
pnpm nx run-many -t lint typecheck test build -p context-api,context-ui,context-contracts,context-server,ai-api
```

`pnpm check`에는 금지된 의존성을 실제 입력했을 때 ESLint가 실패하는 시험이 포함됩니다. 브라우저 소스 공유 패키지의 현 단계 `build`는 타입 검증이며 `platform-server`와 각 도메인 `server`는 실제 CommonJS 산출물을 만듭니다. 배포 산출물은 웹의 정적 자원, 각 Node 앱의 JavaScript, AI 앱의 wheel·sdist입니다. 패키지에 서버 로직을 추가할 때 해당 서비스의 독립 산출물에 포함되는 빌드 방식을 함께 검증합니다.

```bash
node apps/context-api/dist/main.js
# 다른 Node 서비스도 apps/<서비스>/dist/main.js
```

Node 산출물은 현재 외부 의존성을 번들하지 않습니다. 실행에는 해당 앱의 `package.json`·production 의존성, `platform-server/dist`와 사용하는 도메인 `server/dist`가 필요합니다. Nx는 공통 런타임을 서비스보다 먼저 빌드합니다. 서비스별 컨테이너·ARM64 빌드·GHCR 게시·k3s 배포는 후속 작업입니다.

## 다음 단계

`pnpm test:smoke`는 전체 빌드 후 Linux·macOS·WSL에서 실행합니다. 개발 서버를 모두 종료한 상태에서 A·B 트랙을 번갈아 부팅하고, 선택한 프로세스의 HTTP 응답·상대 트랙 미실행·종료와 Node 빌드 산출물 실행을 검사합니다. CI에서도 실행하며 로그는 Git 제외 경로인 `local-artifacts/workspace-smoke/`에 남깁니다.

1. 백엔드 공통 규약 v1 적용 완료, 실제 인증·저장·업무 계약은 후속
2. 프론트 공통 기반 v1 적용 완료, 업무 화면·차량 호스트 시험은 후속
3. 로컬 개발 DB·마이그레이션·기술 예제 데이터·계약 기반 모의 응답 적용 완료, 업무 예제는 계약 합의 후 추가
4. 대표 출퇴근 흐름의 최소 계약과 연결 예제
5. ARM64 이미지·공유 개발 배포, 이후 실제 AI·차량 연동

vLLM 미구축은 골격 개발을 막지 않습니다. RAG의 검색 대상·색인·근거 구성은 트랙 A의 업무 설계와 함께 구현합니다. 공통 인증 연결 지점과 OpenAPI는 제공하며, 기술 경로의 AI 모의 서버는 제공하며 실제 운영 인증·AI 업무 응답·추론 API·RAG는 후속입니다.
