# Ruple k3s 실측 기준선 (2026-10-27)

Ruple의 공통 웹·업무 API·워커를 배치할 Raspberry Pi k3s 기반은 사용할 수 있습니다. 네 노드가 모두 `Ready`이고 Argo CD 애플리케이션 5개가 `Synced·Healthy`였습니다. 다만 Ruple용 네임스페이스·저장소·라우팅·백업은 아직 만들지 않았으므로 실제 배포와 지속 자료 적재는 별도 게이트로 둡니다.

## 목적·출처·변경 범위

- 목적: 과거 구축 기록이 아니라 현재 클러스터 실측을 기준으로 모노레포와 CI/CD 기반 설계를 시작합니다.
- 관찰 시점: 2026년 10월 27일 한국 표준시
- 출처: 사용자가 k3s 서버에서 실행한 `kubectl get`과 `kubectl top` 결과
- 확인 범위: 노드, 할당 가능 자원, 현재 사용량, StorageClass·PV·PVC, IngressClass·Ingress, Argo CD Application, NetworkPolicy, Running이 아닌 Pod
- 변경 범위: 읽기 전용 조회와 문서 반영. 클러스터·기존 `parasix` 워크로드·저장소는 변경하지 않았습니다.
- 공개 제외: 내부 IP, MAC 주소, 인증정보, kubeconfig, Secret

## 노드와 자원

| 노드 | 역할 | 상태 | CPU 할당 가능·현재 | 메모리 할당 가능·현재 | 임시 저장소 할당 가능 |
|---|---|---|---|---|---|
| `pi-1` | control-plane·etcd | Ready | 4코어·191m(4%) | 약 3.9GiB·1,806MiB(45%) | 약 222GiB |
| `pi-2` | worker | Ready | 4코어·37m(0%) | 약 3.9GiB·1,428MiB(35%) | 약 222GiB |
| `pi-3` | worker | Ready | 4코어·39m(0%) | 약 7.8GiB·1,311MiB(16%) | 약 222GiB |
| `pi-4` | worker | Ready | 4코어·54m(1%) | 약 7.8GiB·1,338MiB(16%) | 약 445GiB |

네 노드는 ARM64 Ubuntu와 k3s `v1.36.5+k3s1`을 사용합니다. 현재 CPU 사용 합계는 약 321m이고 메모리 사용 합계는 약 5.7GiB입니다. 이 수치는 조회 시점의 관찰값이며 Ruple에 보장된 자원 예산은 아닙니다.

`pi-3`과 `pi-4`는 상대적으로 메모리 여유가 커서 Ruple의 상태 비저장 웹·API·워커를 우선 검토할 수 있습니다. 실제 node label·taint·affinity와 requests·limits는 기존 워크로드의 예약량을 추가로 확인한 뒤 정합니다. control-plane인 `pi-1`에 일반 워크로드를 우선 배치하지 않습니다.

## 저장소

| StorageClass | 회수 정책 | 바인딩 | 확장 | 용도 판단 |
|---|---|---|---|---|
| `local-path` | Delete | WaitForFirstConsumer | 불가 | 폐기 가능한 개발 자료 |
| `local-path-retain` | Retain | WaitForFirstConsumer | 불가 | 보존이 필요한 자료의 후보. 별도 백업 필수 |

기존 `parasix` 네임스페이스에는 `local-path-retain`을 사용하는 Bound PVC 4개가 있고 합계 용량은 220GiB입니다. 이는 Ruple에 할당된 용량이 아니며 기존 DB·객체 저장소·PVC를 재사용하지 않습니다.

두 StorageClass는 로컬 RWO 볼륨입니다. Pod를 다른 노드로 옮길 때 자료가 자동 이동하는 공유 스토리지가 아니며 볼륨 확장도 지원하지 않습니다. `Retain`은 삭제 시 PV를 남기는 정책일 뿐 백업·복원 성공의 근거가 아닙니다.

## 네트워크·배포 상태

- Traefik IngressClass가 기본값으로 존재합니다.
- 표준 Kubernetes Ingress 리소스는 조회 시점에 없었습니다. 기존 서비스가 Traefik CRD 또는 다른 경로를 사용하는지는 추가 확인이 필요합니다.
- Argo CD Application `root`, `parasix-base`, `parasix-postgres`, `parasix-objstore`, `traefik-config`가 모두 `Synced·Healthy`였습니다.
- `parasix`에는 default-deny와 서비스별 허용 NetworkPolicy가 있습니다. Ruple 정책은 이를 복사하지 않고 Ruple 서비스 경계에 맞게 별도로 만듭니다.
- Running이 아닌 Pod 조회에는 Traefik 설치와 기존 DB·객체 저장소 초기화의 `Completed` Job만 나타났습니다.

마지막 조회는 Pod의 phase만 필터링했으므로, phase가 Running이면서 컨테이너가 NotReady이거나 CrashLoopBackOff인 경우까지 배제하지는 못합니다. 배포 작업 전 전체 Pod의 READY·RESTARTS와 이벤트를 한 번 더 확인합니다.

## 게이트 판정

| 게이트 | 판정 | 남은 조건 |
|---|---|---|
| 모노레포·로컬 개발 기반 착수 | 통과 | 없음 |
| CI에서 ARM64 이미지 빌드 | 착수 가능 | 실제 이미지 빌드 시험 |
| Ruple 개발 네임스페이스 배포 | 조건부 | 전체 Pod 상태, 라우팅 방식, GHCR pull, 자원 예약 확인 |
| 상태 저장 서비스 배포 | 조건부 | 전용 PVC·노드 배치·마이그레이션·복구 절차 |
| 지속 자료 적재 | 미통과 | 백업·복원 실증 |
| Gemma 4 연계 | 미통과 | DGX Spark 런타임·접근·지연·동시 처리량 실측 |

## 배포 전 추가 읽기 점검

```bash
sudo k3s kubectl get pods -A -o wide
sudo k3s kubectl get deploy,statefulset -A
sudo k3s kubectl get resourcequota,limitrange -A
sudo k3s kubectl get nodes --show-labels
sudo k3s kubectl get ingressroute,ingressroutetcp -A
sudo k3s kubectl get applications.argoproj.io -A \
  -o custom-columns=NAME:.metadata.name,REPO:.spec.source.repoURL,PATH:.spec.source.path,SYNC:.status.sync.status,HEALTH:.status.health.status
```

Secret과 kubeconfig 본문은 조회·공유하지 않습니다. Codex 세션은 서버에 직접 접속하지 못하므로 새 기기에서도 사용자가 읽기 명령을 실행하고 결과만 전달합니다.
