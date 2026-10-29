# Ruple 기반 개발 착수 인계 (2026-10-28)

> 2026-10-29 후속: 기반 PR 1 범위의 모노레포·최소 실행 골격과 트랙별 실행·의존성 검사를 추가했습니다. 현재 실행 방법은 [독립 개발 안내](../development/README.md), 다음 작업은 [기반 후속 항목](../development/foundation-backlog.md)을 따릅니다. 아래 표와 순서는 착수 당시 상태를 보존한 기록입니다.

다음 세션은 제품 기능이나 모듈 내부 로직부터 만들지 않습니다. 먼저 두 담당자가 같은 구조에서 독립적으로 개발할 수 있도록 pnpm·Nx 모노레포, 실행 가능한 앱·서비스 골격, 검증 명령, CI와 배포 산출물의 기준을 만듭니다.

## 1. 시작 위치

새 기기에서 공개 GitHub `devdubu/ruple`의 `master`를 내려받고 최신 상태로 맞춥니다. 이 인계 직전 기준 커밋은 `f941af657948371b8ddc80ee2759d3c6a21cf003`이며, 이 문서를 포함한 후속 커밋이 원격에 있으면 그 커밋을 우선합니다.

```bash
git clone git@github.com:devdubu/ruple.git
cd ruple
git pull --rebase origin master
git status --short
```

작업 전에 다음 순서로 읽습니다.

1. 이 문서
2. [AA 확정본](../architecture/application-architecture.md)
3. [k3s 실측 기준선](../infrastructure/k3s-baseline-2026-10-27.md)
4. [프로젝트 공통 규칙](../governance/project-rules.md)과 [작업 흐름](../governance/workflow.md)
5. [계약 관리](../../contracts/README.md)

Tramen 접근 권한이 없어도 위 문서와 Git 이력만으로 이어갈 수 있습니다.

## 2. 확정된 기준

- React·Vite·TypeScript 공통 웹, NestJS·Fastify 업무 서비스, PostgreSQL·Drizzle, FastAPI·LlamaIndex, DGX Spark의 vLLM·Gemma 4 12B IT
- pnpm workspace와 Nx를 사용하는 모노레포
- 기존 Raspberry Pi k3s·Argo CD·Kustomize를 사용하는 ARM64 배포
- A `context-api`, B `automation-api`·worker, C `interaction-api`, 별도 `ai-api`
- 서비스별 데이터 소유, 다른 서비스 DB·내부 소스 직접 참조 금지
- 진민이 공통 레이아웃·기초 아키텍처·CI/CD·배포 기반을 소유하고, 두 담당자가 공개 계약 안에서 모듈 내부 설계와 업무 로직을 소유
- 대표 출퇴근 흐름과 하네스 v0.1은 저장소에 반영 완료

프레임워크를 다시 선정하지 않습니다. 실제 호환 실패나 측정 근거가 나올 때만 같은 계약·서비스 경계를 유지한 변경안을 올립니다.

## 3. 현재 완료 상태

| 구분 | 상태 | 근거 |
|---|---|---|
| 제품·논리 모듈 | 확정 | 기존 전체 아키텍처와 M1~M6 문서 |
| 애플리케이션 아키텍처 | 확정 | AA 확정본 |
| 멀티모달 주 모델 | 확정 | Gemma 4 12B IT |
| 프로젝트 하네스 | v0.1 적용 | 공통 규칙·계약 카탈로그·로컬 훅·GitHub Actions |
| 대표 흐름 | 흐름 확정, 필드 미정 | `contracts/flows/commute-routine.md` |
| k3s 기반 | 착수 가능 | 4노드 Ready, Argo CD 5개 앱 Synced·Healthy |
| 제품 모노레포 | 개발 전 | 루트 package·Nx·앱 골격 없음 |
| 제품 컨테이너·배포 | 개발 전 | 이미지·Ruple namespace·Kustomize 없음 |
| DGX·차량 웹 호스트 | 미검증 | 별도 호환 시험 필요 |

## 4. 내일 가장 먼저 할 일

### 4.1 남은 읽기 점검

k3s 서버에서 전체 Pod의 READY·RESTARTS, 기존 workload의 requests·limits, node label·taint, Traefik CRD 라우팅, Argo CD 소스 구조를 조회합니다. 명령은 [k3s 실측 기준선](../infrastructure/k3s-baseline-2026-10-27.md)에 있습니다.

이 조회는 모노레포 개발을 막지 않습니다. Ruple namespace와 stateful workload를 실제 배포하기 전까지 완료하면 됩니다.

### 4.2 기반 PR 1: 모노레포와 실행 골격

다음 범위만 구현합니다.

1. Node.js 24 LTS와 pnpm 버전 고정
2. `pnpm-workspace.yaml`, 루트 `package.json`, lockfile, `nx.json`, 공통 TypeScript 설정
3. `apps/web`, `apps/context-api`, `apps/automation-api`, `apps/automation-worker`, `apps/interaction-api`, `apps/ai-api`의 프로젝트 경계
4. `apps/car`는 차량 웹 호스트 호환 시험 전까지 Android 호스트 경계와 기존 프로토타입 연결만 명시
5. `packages/context`, `packages/automation`, `packages/interaction` 아래 `contracts·ui·server` 경계
6. `packages/presentation`, `packages/platform` 공통 경계
7. Nx tag와 의존성 금지 규칙
8. 웹 앱 셸과 각 API의 최소 부팅·health endpoint·기본 테스트
9. 환경변수 검증·구조화 로그·요청 식별자·공통 오류·OpenAPI를 서비스 템플릿의 후속 필수 항목으로 등록

업무 로직, 실제 DB 테이블, 추천 알고리즘, 상세 화면, Gemma 4 연결, k3s 변경은 이 PR에 넣지 않습니다.

### 4.3 기반 PR 1 완료 조건

```bash
pnpm install --frozen-lockfile
pnpm nx run-many -t lint test build
node harness/check.mjs
python3 -m unittest discover -s prototypes/pleos-nav-probe/tests -v
git diff --check
```

- 위 명령이 새 기기에서 통과
- 앱과 패키지가 Nx 프로젝트 그래프에 표시
- 다른 업무 영역의 `server` 패키지 직접 참조가 차단
- 비밀·실제 연결 문자열·내부 IP가 커밋에 없음
- 내부 업무 로직 없이도 웹과 API 골격이 부팅

## 5. 그다음 작업 순서

```text
기반 PR 1
  모노레포·프로젝트 경계·실행 골격
    → 기반 PR 2
      CI lint·type·test·build·contract·ARM64 이미지와 GHCR 게시
        → 기반 PR 3
          ruple-dev namespace·Kustomize·Argo CD·Traefik·NetworkPolicy·스모크 시험
            → 모듈 계약 확정과 담당자별 내부 설계·개발
```

PR 2에서는 PR 변경에 대해 이미지 빌드까지만 수행하고, `master`의 검증된 커밋 SHA 이미지만 GHCR에 게시합니다. `latest`에 의존하지 않습니다.

PR 3에서는 기존 `parasix` DB·PVC·Secret을 재사용하지 않습니다. `ruple-dev`를 별도로 만들고 초기에는 수동 승인 동기화를 적용합니다. DB 자료를 넣기 전 백업·복원 시험을 통과해야 합니다.

## 6. 아직 정하지 않은 사항

- 🚧 두 담당자의 실명과 최종 모듈 배정
- 🚧 Ruple 도메인·라우팅 이름과 Traefik CRD 사용 방식
- 🚧 전용 PostgreSQL의 물리 배치·PVC 용량·백업 대상
- 🚧 GHCR pull 인증과 Argo CD 이미지 갱신 방식
- 🚧 DGX Spark의 vLLM·Gemma 4 컨테이너와 접근 인증
- 🚧 차량 Capacitor 호스트의 Pleos 호환
- 🚧 계약 필드와 사용자 실행 재확인 정책

담당 실명과 업무 계약의 미정은 모노레포 골격 작업을 막지 않습니다. 클러스터 변경, 상태 저장 배치, 외부 공개 경로는 해당 값을 정하기 전 실행하지 않습니다.

## 7. 새 세션 시작 문구

> 루플레 저장소를 최신 `master`로 맞추고 `docs/handoffs/2026-10-28-foundation-start.md`를 읽어라. k3s 실측 기준과 하네스를 대조한 뒤 기반 PR 1의 pnpm·Nx 모노레포와 실행 골격만 설계·구현하라. 업무 로직·실제 DB·클러스터 변경은 범위 밖이다.
