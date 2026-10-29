# 공통 실행 골격 검증 기록

- 대상: 기준 커밋 `40f653ce5013ca9d140ba35c4deb6c1541661d64`에서 시작한 `feat/foundation-workspace` 작업 트리. 이 기록 작성 시 새 커밋·원격 push 전입니다.
- 환경: Linux x86_64, Node.js 24.19.0, pnpm 11.25.0, Python 3.12.14, uv 0.12.23
- 범위: 모노레포·최소 실행 골격·프로젝트 경계·트랙별 실행·CI 설정
- 결과는 이 작업 트리의 로컬 실행 결과입니다. 4단계에는 로컬 Docker DB 검증을 추가했으며 GitHub Actions 원격 실행·ARM64·k3s 배포 결과는 없습니다.

| 명령·검증 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | 통과 |
| `uv sync --project apps/ai-api --locked` | 통과 |
| `pnpm nx show projects` | 앱·패키지 18개 인식, car는 경계만 존재 |
| `pnpm check` | lint·typecheck·test·build 57개 작업 통과 |
| `node harness/check.mjs` | 통과. 기존 계약 변경 비교는 기준 ref 미설정으로 생략; 이번 작업에 등록 업무 계약 변경 없음 |
| `pnpm check:boundaries` | 허용 참조·금지 참조 시험 6개 통과 |
| `pnpm test:smoke` | 트랙 A·B 실제 명령과 네 Node 빌드 산출물 부팅·HTTP 응답·종료 통과 |
| `pnpm test:prototype` | 기존 Pleos 호스트 시험 11개 통과. 에뮬레이터 재실행은 아님 |

실제 실행 검사에서 개발용 변환기가 NestJS 데코레이터 설정을 적용하지 못한 문제를 발견했습니다. Node 개발 실행을 `tsc-watch`의 TypeScript 컴파일 결과 실행으로 통일한 뒤 위 검사를 다시 통과했습니다.

프로세스별 최소 health만 제공하며 DB·예약 작업·실제 모델·RAG·차량 호출은 없습니다. 앱과 공유 패키지의 TypeScript 경계는 검사하지만 OS·컨테이너·네트워크·DB 권한 격리는 후속 환경 구성 대상입니다. 전체 개발자 인계 준비의 남은 항목은 [기반 후속 항목](foundation-backlog.md)에 있습니다.

## 2단계: 백엔드 공통 규약 v1

같은 기준 커밋·`feat/foundation-workspace` 위의 후속 작업 트리에서 검증했습니다. 1단계 기록은 당시 상태를 보존하며, 현재 HTTP 규약은 [백엔드 공통 규약](backend-conventions.md)을 따릅니다. 이번 검증도 커밋·원격 push 전의 로컬 결과입니다.

| 검증 | 결과 |
|---|---|
| JavaScript frozen install·Python locked sync | 통과 |
| `pnpm peers check` | 충돌 없음 |
| `pnpm check` | lint·typecheck·test·build 61개 작업 통과 |
| Node 공통 런타임 시험 | 22개 통과: 설정·개발/검증 신원·위조 헤더·입력 오류·로그·문서·probe |
| Python 시험 | 기존 포함 22개 통과: 같은 HTTP 계약·인증·검증·민감정보 제외 |
| 계약·경계 하네스 시험 | 10개 통과, 등록된 기술 계약의 정상·오류·거부 예시 검증 |
| 실제 부팅 smoke | A·B와 네 Node 산출물의 health·401·request ID·503 readiness·OpenAPI·종료 확인 |
| 기존 Pleos 호스트 시험 | 11개 통과, 에뮬레이터 재실행 아님 |

Python 개발 reload의 하위 프로세스가 `__main__`에 정의된 로그 포매터를 불러오지 못한 문제를 실제 부팅에서 발견했습니다. 포매터를 안정적인 import 경로로 옮기고 개발 reload를 포함해 재검증했습니다. 공통 Node 런타임은 각 서비스보다 먼저 빌드되며 프론트에서 직접 참조할 수 없습니다.

공통 기술 계약 `platform-http@1.0.0`을 새로 등록했습니다. 기존 업무 계약은 변경하지 않았습니다. 실제 JWT/OIDC·업무 권한·DB·마이그레이션·작업 큐·AI 호출은 미구현이고, 배포·클러스터 변경도 없습니다. 기본 인증은 deny이며 이때 readiness는 503입니다. 실제 의존성 준비를 판정하려면 해당 probe를 연결해야 합니다.

## 3단계: 프론트 공통 기반 v1

같은 기준 커밋 `40f653c`·`feat/foundation-workspace` 위의 후속 작업 트리에서 검증했습니다. 커밋·원격 push 전 로컬 결과이며 GitHub Actions 원격 실행 결과가 아닙니다. 적용 규약은 [프론트 공통 기반](frontend-foundation.md)을 따릅니다.

| 검증 | 결과 |
|---|---|
| JavaScript 의존성 설치·peer 확인 | 통과, peer 충돌 없음 |
| `pnpm check` | lint·typecheck·test·build 67개 작업 통과 |
| 프론트 단위 시험 | presentation 7·HTTP 소비자 2·클라이언트/Query 12·웹 셸 2개 통과 |
| 계약·경계 하네스 | 11개 통과, HTTP·화면 등록 메타데이터 2개 계약 예시 검증 |
| `pnpm test:ui` | Chromium 5개 통과: hash 경로·뒤로가기·본문 초점·320px 폭·입력·차량 64px 컨트롤·Dialog 포커스/ESC·API 오류·운영 미리보기 제외 |
| `pnpm test:smoke` | A·B·네 Node 산출물 부팅·종료 통과. 웹 개발 프록시에서 자기 트랙 API의 실제 health 응답 확인 |
| 기존 Pleos 호스트 시험 | 11개 통과. 에뮬레이터·실차 재시험 아님 |

폰·차량 Dialog 캡처를 직접 확인했습니다. 캡처는 Git 제외 경로 `local-artifacts/frontend/`에 있습니다. 브라우저 시험의 중첩 실행기가 Vite 자식을 남기는 문제를 발견해 Playwright가 Vite를 직접 관리하고 정상 종료하도록 변경했습니다. 이어지는 트랙 부팅 검사까지 통과했습니다.

신규 기술 계약은 `presentation-feature@1.0.0`이며 기존 HTTP 기술 계약의 스키마·버전은 변경하지 않았습니다. 실제 로그인·PWA·푸시·음성·차량 WebView/Capacitor·업무 화면·개발 DB·서비스 대체 응답은 후속입니다. 표시 프로필의 웹 검증을 실제 차량 적합성으로 확대하지 않습니다.

## 4단계: 독립 개발 DB·모의 실행·시험 시각

같은 기준 커밋 `40f653ce5013ca9d140ba35c4deb6c1541661d64`·`feat/foundation-workspace`의 후속 작업 트리에서 검증했습니다. 커밋·원격 push 전 결과입니다. 실행 방법은 [트랙별 DB·모의 실행](isolated-development.md)을 따릅니다.

| 검증 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile --offline`·`pnpm peers check` | 통과, peer 충돌 없음 |
| `pnpm check` | Nx lint·타입·시험·빌드 67개 작업, 기존 경계·계약 시험 11개, 신규 개발 도구 시험 3개 통과 |
| 주입형 Clock 단위 시험 | 2개 통과: 90일 이동·Date 복제·잘못된 시각과 기간 거부 |
| `pnpm test:dev-db` | 실제 PostgreSQL 17.11로 A·B 2개 통합 시험 통과. migration·seed 반복, ORM 읽기·쓰기, 90일 시각 이동, runtime DDL·journal·타 DB 접속 거부 |
| `pnpm test:isolated` | A·B 실제 소유 API·웹과 peer 모의 서버 부팅, 모의 헤더·웹 프록시·503 장애 후 복구·프로세스 종료 통과 |
| `pnpm test:smoke` | 기존 실제 A·B 골격과 네 Node 빌드 산출물의 HTTP 규약·종료 회귀 검사 통과 |
| `db:generate` A context·B automation·B interaction | 초기 snapshot 이후 변경 없음 확인. 중복 초기 migration 미생성 |

Docker Engine 28.4.0·Compose 2.40.3, Linux x86_64에서 공식 `postgres:17-alpine`의 고정 다이제스트를 사용했습니다. 초기 스크립트 실행 권한과 Docker 내부망의 호스트 포트 접근 문제를 발견해 실행 권한·서비스별 브리지·루프백 포트·TCP 준비 검사를 적용한 뒤 새 임시 볼륨으로 검증했습니다. 통합 시험은 자기 임시 프로젝트·볼륨을 정리하며, 수동 검증에 생성한 로컬 DB도 종료·정리했습니다.

기존 `platform-http@1.0.0` 예시를 참조하는 개발 경로 등록표만 추가했으며 업무 계약은 변경하지 않았습니다. `expired`는 409 기술 응답이고 실제 만료 로직이 아닙니다. 빈 결과는 승인 예시가 없어 거부합니다. AI 추론·추천·차량 동작의 업무 응답, 업무 저장 모델·상태 전이, outbox·pg-boss, 운영 인증·배포는 후속입니다. API 골격은 아직 DB를 사용하지 않으므로 도메인 구현 시 pool 종료와 DB readiness 연결이 필요합니다.

## 5단계: 계약 작성 기반·기술 원칙·개발자 인계

기반 작업을 `94850ff`로 커밋한 뒤 그 위의 후속 작업 트리에서 검증했습니다. 이번 범위는 기초팀·기능팀의 책임, 계약 초안 생성·검사, 공통 기술 설계 원칙과 인계 기준입니다. 출퇴근 업무 필드·승인 정책·상태 전이는 추가하지 않았습니다.

| 검증 | 결과 |
|---|---|
| `pnpm contract:new --help`·`pnpm contract:check --help` | 명령 진입점·사용법 확인 |
| 계약 작성 도구 회귀 시험 | 3개 통과: 미작성 초안 검사 실패·카탈로그/모의 등록 불변, 경로 이탈/등록 ID/기존 작업 덮어쓰기 거부, 작성한 정상·거부 예시 검증 |
| `pnpm check` | Nx lint·타입·시험·빌드 67개 작업, 경계·계약·초안 시험 14개, 개발 환경 시험 3개 통과 |
| 등록 계약 | 기존 기술 계약 2개 검증 통과. 카탈로그·등록 스키마·예시 변경 없음 |
| `git diff --check` | 통과 |

초안은 공개 계약의 정본으로 등록되지 않으며 형식 검사 통과와 계약 책임자의 확인을 구분합니다. 새 의존성·업무 endpoint·DB 모델·배포 변경은 없습니다. 기초 기술 원칙 중 버전 비교·중복 방지·업무 인가·서버 외부 호출 등은 도메인 구현 시 연결해야 하며, 문서화만으로 구현 완료로 보지 않습니다. 실제 담당자 환경 첫 실행·원격 CI·ARM64·서버 배포도 이 단계에서 검증하지 않았습니다.
