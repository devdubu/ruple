# GitHub 원본·내부 GitLab Runner 배포 설계

2026-10-30 사용자 요청에 따라 소스·PR은 GitHub에 유지하고 검사·이미지 빌드·배포 파이프라인을 내부 GitLab과 기존 Runner에 연결하는 방향으로 준비합니다. 이 문서는 연결 구조와 구현 순서를 정의하며, 아직 GitLab 프로젝트·Runner 설정·Webhook·배포 자원을 변경하지 않았습니다.

현재 기초 설계·컨테이너 준비에는 GitLab 접속이 필요하지 않습니다. 저장소 안에서 독립 실행 가능한 컨테이너와 CI 초안을 먼저 준비하고, 실제 GitLab 연결 단계에서 executor·tag·플랜·프로젝트 설정을 확인합니다. 아래 미확인 항목은 현재 작업의 선행 조건이 아닙니다.

## 확인한 환경

| 항목 | 현재 근거·상태 |
|---|---|
| 코드 원본 | GitHub `devdubu/ruple` |
| GitLab | 사용자 제공 주소 `https://gitlab.parasix.com`, 직접 운영 서버 |
| Runner 호스트 | 사용자 제공 Intel N100 서버. CPU 계열상 x86_64/amd64이며 실제 OS·컨테이너 설정은 미조회 |
| Runner 설치 | 사용자 확인: 설치됨. 연결 상태·executor·tag·빌드 권한은 🚧 미확인 |
| GitLab HTTP 접근 | 현재 실행 환경에서 로그인 페이지 200. 인증 없는 `/api/v4/version`은 401 |
| GitLab 플랜·버전·Ruple 프로젝트 | 🚧 미확인. 실제 연결 단계에서 사용자 제공 정보 또는 필요한 조회로 확인 |
| k8s 대상 | 기존 [k3s 기준선](../infrastructure/k3s-baseline-2026-10-27.md)의 ARM64 노드·Argo CD. 실제 배포 전 상태 재조회 필요 |

로그인 페이지 접근은 프로젝트·Runner 관리 권한이나 GitHub Webhook 접근 성공을 의미하지 않습니다. 토큰·Runner 등록 정보·Secret은 저장소나 대화에 기록하지 않습니다.

## 역할과 흐름

```text
GitHub: 소스·PR·검토된 커밋
  → 연동 계층: 커밋 동기화 또는 trigger + 지정 SHA checkout [방식 미정]
  → GitLab CI: 파이프라인·실행 조건·변수·결과 관리
  → 기존 N100 Runner: 검사·컨테이너 빌드
  → 이미지 저장소: 검증한 source SHA·다이제스트로 게시
  → 배포 선언: 검증 이미지 참조 갱신
  → 기존 Argo CD: 초기에는 수동 동기화
  → Ruple 전용 k8s 개발 환경
```

GitLab은 실행을 지시하고 Runner는 작업을 수행합니다. 실제 클러스터 반영은 기존 Argo CD의 배포 선언을 기준으로 합니다. Ruple의 업무 서비스·DB 소유권·로컬 독립 개발 구조는 유지합니다.

코드 원본은 GitHub 한 곳으로 유지합니다. 동기화한 GitLab 사본에 기능 변경을 직접 작성하거나 양방향 동기화를 구성하지 않습니다. 별도 CI 프로젝트를 사용하는 경우 GitLab CI 설정 커밋과 실제 GitHub source SHA를 구분해 기록합니다. 이미지에 CI 프로젝트의 SHA를 소스 버전으로 잘못 붙이지 않습니다.

## 연동 방식 결정

| 방식 | 조건과 구현 범위 |
|---|---|
| 공식 외부 저장소 연동·Pull Mirror | GitLab Premium/Ultimate 기능. GitHub 소스를 동기화하고 mirror 갱신에 pipeline 실행을 연결 |
| 커밋 동기화 | GitHub의 필요한 브랜치·태그를 GitLab CI 프로젝트로 전달. 같은 소스 커밋에서 pipeline 실행. 전달 주체·인증·이벤트 처리는 별도 구성 |
| Trigger + source checkout | GitLab의 신뢰할 수 있는 CI 프로젝트를 호출하고 Runner가 GitHub의 검증된 지정 SHA를 checkout. 호출만으로 소스가 자동 동기화되는 것은 아님 |

공식 Pull Mirror가 Free에서 지원된다고 가정하지 않습니다. 어떤 플랜에서도 구현 가능한 범위를 준비하되 실제 연동은 플랜·네트워크·운영 방식 확인 후 선택합니다. 파이프라인과 GitHub의 검사 상태 연결 방법도 함께 결정합니다.

## N100에서 ARM64 이미지 준비

N100의 native 실행 대상은 `linux/amd64`, 기존 k3s의 목표는 `linux/arm64`입니다. N100에서 만든 amd64 이미지만 게시해 ARM64 배포 완료로 처리하지 않습니다.

1. 서비스별 Dockerfile·배포 패키지를 작성하고 amd64에서 독립 실행·health·종료·설정 주입을 검증합니다.
2. Runner의 executor와 빌드 접근 방식을 확인해 BuildKit/Buildx 사용 방법을 정합니다. Shell executor에는 호스트 명령이, Docker/Kubernetes executor에는 컨테이너·권한·네트워크 설정이 영향을 줍니다.
3. ARM64 출력은 QEMU 에뮬레이션 또는 사용 가능한 ARM64 native builder를 검토합니다. 웹 정적 자원·순수 JS와 아키텍처별 네이티브 의존성·Python wheel을 구분합니다.
4. 실제 ARM64 빌드와 해당 아키텍처에서의 실행 결과를 확인한 뒤 배포 대상으로 게시합니다. N100의 에뮬레이션 속도·메모리 여유는 아직 측정하지 않았습니다.

기존 N100 서비스를 고려해 새 Ruple pipeline은 처음부터 모든 서비스의 빌드를 병렬로 늘리지 않습니다. 직렬 실행을 초기안으로 두고 실제 소요 시간과 자원 여유를 측정한 뒤 조정합니다. 이 문서 작성으로 기존 Runner의 전역 동시 실행 설정을 변경하지 않았습니다.

## 게시·배포 기준

- 기존 계획의 GHCR을 초기 후보로 유지합니다. GitLab Container Registry의 활성화·주소·k8s pull 인증은 미확인이므로 자동으로 이전하지 않습니다.
- GitHub `master`의 검토·검증된 커밋만 게시·배포 대상으로 삼습니다. 현재 기반은 작업 브랜치에 push된 상태이며 `master` 반영 여부는 실제 작업 시 확인합니다.
- 공개 저장소의 임의 fork PR에 내부 Runner·게시·배포 자격 증명을 제공하지 않습니다. 기존 GitHub 품질 검사는 GitLab의 대응 검증이 실제 통과하기 전까지 유지합니다.
- 재시도·중복 이벤트·오래된 pipeline이 더 최신 배포를 덮지 않도록 source SHA·이미지 다이제스트·배포 대상과 실행 순서를 추적합니다.
- 새 pipeline의 실제 성공, 이미지 게시·pull, 배포 선언 갱신·복원과 Argo CD 동기화를 확인한 뒤 운영 경로로 전환합니다.

## 다음 구현 순서와 남은 정보

먼저 CI 공급자와 독립적인 **서비스별 컨테이너·실행 검증**을 만듭니다. GitLab 연결은 다음 정보를 확인한 뒤 추가합니다.

- 🚧 Runner executor, tag, 보호 설정·허용 브랜치, native 아키텍처와 빌드 도구
- 🚧 GitLab 버전·플랜, Ruple CI 프로젝트의 경로·ID·관리 접근
- 🚧 소스 전달 방식과 인증·이벤트 연결, 이미지 저장소·권한
- 🚧 ARM64 builder/에뮬레이션 가능 여부·자원 예산, GitOps 저장소·배포 경로

## 공식 근거

- [GitLab 외부 저장소 CI/CD](https://docs.gitlab.com/ci/ci_cd_for_external_repos/), [Pull mirroring](https://docs.gitlab.com/user/project/repository/mirror/pull/): 플랜·동기화·pipeline 연동 조건
- [GitLab pipeline trigger](https://docs.gitlab.com/ci/triggers/): Free 포함 API/Webhook 실행 방식
- [GitLab BuildKit](https://docs.gitlab.com/ci/docker/using_buildkit/): 빌드 방식·executor·권한 전제
- [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/): 에뮬레이션·native builder·교차 빌드와 한계
- [Argo CD CI 자동화](https://argo-cd.readthedocs.io/en/latest/user-guide/ci_automation/): 이미지 게시·배포 선언 갱신·동기화 흐름
