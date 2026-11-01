<p align="center">
  <img src="assets/branding/ruple-logo.png" alt="루플레 RUPLE 로고" width="320">
</p>

# 루플레 (RUPLE)

출퇴근부터 몇 달에 한 번 방문하는 장소까지 챙기는 개인화 모빌리티 루틴 앱을 기획·개발합니다.

반복 방문 이력과 집·회사·즐겨찾기 등 등록 장소를 근거로 이동 루틴을 자동 제안하고, 사용자 승인 후 루틴을 활성화하는 방향을 추구합니다.

## 현재 확정 기준

2026년 10월 26일, 프로젝트 대표자 진민이 지금까지의 제품 방향·논리 아키텍처·개발 진행 기준을 확정했습니다. [전체 아키텍처와 제출 개발 계획](docs/planning/full-architecture-review-2026-10-26.md)이 제품·모듈·제출 범위의 기준입니다. 10월 27일에는 Kubernetes·MSA, 모듈별 화면·서버 수직 개발과 구체적인 [애플리케이션 아키텍처(AA)·기술 스택](docs/architecture/application-architecture.md)을 확정했습니다. 멀티모달 주 모델은 Gemma 4 12B IT입니다.

**새 기기와 다음 세션은 [기반 개발 착수 인계](docs/handoffs/2026-10-28-foundation-start.md)부터 읽으면 됩니다.** [프로젝트 상세 인계](docs/handoffs/2026-10-27-project-handoff.md), [AA 확정본](docs/architecture/application-architecture.md), [k3s 실측 기준선](docs/infrastructure/k3s-baseline-2026-10-27.md)에 제품 가치·기술 기준·인프라 관찰과 다음 작업을 연결했습니다. Tramen 계정 없이 레포 문서만으로 이어갈 수 있습니다.

| 구분 | 현재 상태 |
| --- | --- |
| 제품 방향 | 이동 루틴과 상태형 차량 관리 통합, 개인별 제안·알림, 음성·카드 중심 동적 화면·보조 채팅 |
| 실행 구조 | 차량 Pleos 앱이 메인, 스마트폰은 컴패니언. 양쪽 에지 클라이언트와 개인 서버 Automation Hub, DGX Spark의 서버 추론 |
| 모듈·협업 | M1~M6 책임 구분. 개발 배정은 트랙 A(M1·M2), B(M3~M6), 기능별 화면·서버·저장·연계를 담당자가 소유 |
| AA·배포 방향 | 기존 Pi k3s 4노드와 Argo CD의 현재 상태 확인. PWA·차량 Android 브리지·업무 서비스·DB·Gemma 4 GPU AI 조합 확정. Ruple 배포는 개발 전 |
| 제출 계획 | 11월 15일 접수 마감. 기존 필수 통합 우선, 상태형·SLM·음성·동적 화면의 대표 흐름은 조건부 확장 목표 |
| 실제 구현 | Pleos 조회·내비 검증 앱과 pnpm·Nx 웹/API/워커/AI 부팅 골격. 제품 업무 로직·업무 DB 모델·AI·컴패니언 통합은 개발 전 |
| 상세 미정 | 담당 실명, 우선 모바일 시험 기기, 실제 차량 연동 수준, 기존 사례의 시험값·임계값, 임베딩·재순위·TTS 모델, 세부 계약 |

## 제품 구성

- 집·회사·즐겨찾기 등 유효한 등록 장소를 먼저 검토하고, 등록 정보가 없으면 추가 이동 근거를 쌓은 뒤 루틴을 제안합니다. 수동 등록도 선택 기능으로 제공합니다.
- 연료·배터리·워셔액·저압·정비·문·창문 등 상태형 관리와 이동 일정을 연결하고, 개인의 관리 습관·응답을 반영해 알림 시점과 중복을 조정합니다.
- 캘린더·날씨·가격·개인 주행 기록을 활용하는 제품 범위를 두며, 실제 데이터 접근·보관·외부 연동은 개별 검증합니다. 익숙한 길은 경유지로 유사하게 재탐색하는 방식을 채택합니다.
- 통계·수치 계산, 소형 언어 모델(SLM)의 맥락 해석·제안, 승인된 규칙의 판정·실행을 구분합니다. 모델 출력은 근거·대상·허용 동작을 검증합니다.
- 음성·터치·채팅이 같은 요청과 실행 상태를 사용합니다. 생성형 사용자 인터페이스(Gen UI)는 사전 정의한 컴포넌트를 조합하고, 차량·스마트폰에 맞게 표시합니다.

차량 데이터나 제어의 문서상 존재를 실제 권한·실차 지원으로 확정하지 않습니다. 실행 결과와 실제 방문·주유·정비 완료도 구분합니다.

## 설계 문서

[프로젝트 상세 인계](docs/handoffs/2026-10-27-project-handoff.md)는 지금까지의 제품·설계·검증·자원·미정 사항과 재개 순서를 정리합니다. [10월 27일 논의 기록](docs/meetings/2026-10-27-aa-and-sharing.md)은 사용자 요구와 AI 추천, 기존 기준과의 변경 관계를 구분합니다.

[전체 아키텍처와 제출 개발 계획](docs/planning/full-architecture-review-2026-10-26.md)에서 확정 범위, 전체 배치도·모듈·작업 묶음·작업분류체계(WBS)·날짜별 판정 기준·시험 행렬·실행 자원·미정 사항을 확인할 수 있습니다.

[AA와 기술 스택 확정본](docs/architecture/application-architecture.md)은 모노레포·화면·네이티브 브리지·업무 서비스·DB·작업 큐·임베딩·검색 증강 생성(RAG)·Gemma 4 멀티모달 추론·Kubernetes 배치를 정합니다. 기존 작은 단일 백엔드 설명은 이 MSA 기준으로 대체합니다. 기술 기준 확정과 호환 검증·제품 구현 완료는 구분합니다.

[1차 프로토타입 범위와 완료 기준](docs/planning/prototype-v1-scope.md)에서 구현·시연 범위, 완료 판정안과 사용자 결정 대기 항목을 관리합니다.

[입출력과 역할 아키텍처](docs/architecture/README.md)에서 차량 앱·스마트폰 앱·서버·추론 자원의 역할, 네 가지 입출력 조합과 흐름을 관리합니다. 역할 구조는 확정했고 구체적인 차량 기능·권한과 내부 로직은 상세 설계에서 결정합니다.

[기능 모듈과 연결 계약](docs/architecture/functional-modules.md)에서 확정한 기능별 책임·상태 소유권과 후속 상세화할 연결 계약을 관리합니다.

[초기 루틴 제안 정책](docs/requirements/initial-routine-proposal.md)에 집·회사·내비 등록 장소 우선, 등록 정보 부재 시 이동 근거 축적 후 제안, 근거가 없을 때 수동 등록 선택을 반영했습니다. 세부 판정·화면·계약은 후속 명세에서 정합니다.

[필요 데이터와 Pleos API 대응표](docs/research/pleos-data-api-matrix.md)에서 문서 확인 사항과 실제 호출·반환·차량 동작의 검증 항목, 시험 데이터·에뮬레이터·실차별 개발 방법을 구분합니다.

## 개발 하네스

[개발자 인계](docs/development/developer-handoff.md)에 기초팀·기능 담당자의 책임과 첫 실행 절차를, [계약 작성 기준](docs/development/contract-authoring.md)에 초안 생성·검증·공동 검토·등록 절차를 정리했습니다. 업무 필드·정책은 각 트랙에서 설계합니다.

[프론트 공통 기반 v1](docs/development/frontend-foundation.md)에서 토큰·컴포넌트·화면 등록·API 주입·서버 상태 처리를 제공합니다. `pnpm dev:ui`로 백엔드 없이 확인하고 `pnpm test:ui`로 브라우저 동작과 운영 빌드의 개발 미리보기 제외를 검증합니다.

[백엔드 공통 규약 v1](docs/development/backend-conventions.md)을 웹과 분리한 서버 공통 패키지와 Python AI API에 적용했습니다. 설정·오류·요청 추적·검증기 연결·OpenAPI와 기술 계약 검증을 제공하며, 실제 로그인 제공자·업무 DB·AI 연결은 후속입니다.

2026년 10월 29일, 트랙 A·B의 독립 개발을 위한 모노레포와 최소 실행 골격을 추가했습니다. 설치·트랙별 실행·의존성 경계·검증은 [독립 개발 안내](docs/development/README.md), 현재 제공 범위와 남은 기초 작업은 [기반 후속 항목](docs/development/foundation-backlog.md)을 따릅니다. 실제 제품 업무 로직·AI·차량·배포 통합은 후속 단계입니다.

서로 다른 개발자와 인공지능 도구가 같은 계약과 경계를 따르도록 프로젝트 공통 하네스 v0.1을 적용합니다.

- [하네스 구성과 적용 단계](docs/governance/README.md)
- [프로젝트 공통 규칙](docs/governance/project-rules.md)
- [작업 흐름](docs/governance/workflow.md)
- [담당 경계](docs/governance/ownership.md)
- [계약 관리](contracts/README.md)

```bash
# 전체 점검
node harness/check.mjs

# 선택 사항: 저장소별 커밋 전 점검 활성화
node harness/install.mjs
```

## 장기 방향

허용된 이동·일정·선호·차량 관리 근거를 연결하는 개인화 이동 맥락 데이터 계층(Mobility Context)을 축적합니다. 향후 제조사 권한 확대에 따른 에너지 관리·자율주행 개인화 연계, 별도 동의 기반 집단 추천, 장소 대체 추천·광고는 장기 확장으로 구분합니다. 현재 구현·권한이나 제출 필수 기능으로 표시하지 않습니다.

## 개발 검증

[Pleos 최소 조회 앱](prototypes/pleos-nav-probe/README.md)으로 즐겨찾기·최근 목적지 SDK 호출을 검증합니다. [에뮬레이터 실행 결과](docs/research/pleos-nav-probe-results.md)에 실제 수신 자료의 필드·제약과 재현 방법을 기록했습니다. 제품의 기술 스택·실차 동작·1차 전체 완료와 구분합니다.

[내비 실행 검증](docs/research/pleos-navigation-execution.md)에서 별도 시험 화면의 SDK 경로 요청·완료 콜백·목적지·전경 화면·취소 결과를 확인합니다. 현재 위치·경로 상태의 수신과 콜백 이름의 호환성 제약도 기록합니다.

## 로고

2026년 10월 26일, 프로젝트 대표자가 비교 시안 중 **B안**을 루플레 로고로 선택했습니다.

열린 원형 경로는 반복되는 방문 주기를, 분리된 점은 다음 목적지를 나타냅니다. 매일 반복되는 이동과 오랜 간격을 두고 돌아오는 방문을 함께 기억한다는 의미를 담았습니다.

| 파일 | 구성 및 용도 |
| --- | --- |
| [ruple-logo.png](assets/branding/ruple-logo.png) | 심벌과 RUPLE 이름을 결합한 기본 로고, 흰 배경 |
| [ruple-symbol.png](assets/branding/ruple-symbol.png) | 이름을 제외한 검정 심벌, 투명 배경. 밝은 배경에 사용 |

기본 로고는 이름과 함께 프로젝트를 소개할 때, 심벌은 공간이 작은 화면에서 사용합니다. 로고의 비율과 열린 경로·목적지 점의 관계를 유지합니다.
