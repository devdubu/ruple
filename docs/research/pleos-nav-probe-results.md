# Pleos 내비 데이터 조회 실행 결과

즐겨찾기와 최근 목적지를 Pleos 에뮬레이터에서 실제 조회했습니다. 초기 상태에서는 장소 내용이 비어 있는 HOME·OFFICE 항목과 빈 최근 목적지 목록이 반환됐고, 내비 앱에 공개 시험 장소를 저장·지정한 뒤 해당 장소 정보가 반환됐습니다. 현재 모델에는 방문일·횟수·주기 필드가 없습니다.

- 검증일: 2026년 10월 26일
- 작업 분류·목적: 프로젝트. [데이터 대응표](pleos-data-api-matrix.md)의 미검증 조회를 실행해 M1 입력으로 확보 가능한 정보와 제약 확인
- 변경 범위: 독립 검증 앱, 로컬 개발 환경, 원본 자료의 Git 제외, 조사 문서 연결. 기존 기능 모듈·1차 완료 기준은 유지
- 구현: [최소 검증 앱과 실행 방법](../../prototypes/pleos-nav-probe/README.md)
- 근거: [원본에서 생성한 관찰 요약](results/pleos-nav-probe-2026-10-26.json), [요약 산출 스크립트](../../prototypes/pleos-nav-probe/scripts/publish_summary.py)
- 진민 확인: 결과·해석 확인 전. 이번 구현을 제품의 기술 스택·전체 설계 승인으로 표시하지 않음
- 🚧 실차·다른 차종·다른 버전·과거 방문 이력은 미검증

## 설치·실행 환경

| 항목 | 실제 사용 환경 |
| --- | --- |
| 호스트 | macOS 27.0.1, arm64 |
| Android Studio | 사용자 Applications 폴더 설치, 번들 표시 버전 2026.2 |
| Java / Gradle / Android Gradle Plugin | Temurin 21.0.10 / 8.14.3 / 8.13.2 |
| Command-line Tools / 플랫폼 도구 / Android Emulator 실행기 | 23.0 / 37.0.1 / 37.2.12.0 |
| 컴파일 SDK / Build Tools | 35 / 35.0.0 |
| Pleos 이미지 / 게스트 Android | Connect 2.1.0 / API 34, arm64-v8a |
| 가상 기기 | `Ruple_Pleos_2_1`, RAM 4096 MB, Cold Boot, GPU host, 1080×600 |
| SDK / 전이 의존성 | NaviHelper 3.0.5 / navi-data 3.0.4 |
| 내비 서비스 | `ai.pleos.playground.service.navi`, versionName 3.0.4 |
| 내비 앱 | `ai.umos.maps.android.navigation.app`, versionName 3.3.2-rc5-hotfix.3 |
| Android 사용자 | 현재 사용자 10. 시스템 사용자 0과 별도 |
| 조회 권한 | 앱의 `pleos.car.permission.NAVI_ROUTE`가 granted 상태임을 확인 |

개발 프로젝트 생성이나 계정별 기능 신청을 수행하지 않고 공개 Maven 배포 파일을 내려받아 빌드했습니다. 배포 파일 접근 성공과 계정별 SDK 기능 승인 상태를 동일하게 해석하지 않습니다. 앱에 경로 요청·차량 제어·인터넷 권한은 추가하지 않았습니다.

공식 ARM64 이미지의 내려받기 경로·체크섬·크기는 [공식 업데이트 목록](https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml)을 기준으로 확인했습니다.

| 배포 파일 | 검증한 식별값 |
| --- | --- |
| `crp_car_arm64_emulator.zip` | 크기 4669762816 bytes, SHA-1 `24d28eb2f18eba5e87c861a7eb2bdccebb049419` |
| `NaviHelper-3.0.5.aar` | SHA-256 `15fadd11c7c611b1abdf7ebf9ce91f2a6ce2728e60b4e38b4343e11bb9c12e97` |
| `navi-data-3.0.4.aar` | SHA-256 `7ca00e592134b53237a48cc3b7864063ecc5e2885465e3ce9c8c2a29789a2e2b` |

CLI 등록 시 공식 XML의 경로 `pleos_car_emulator`와 압축 파일의 `source.properties`에 적힌 태그 `android-automotive`가 달랐습니다. 이 Mac에서는 압축 내용물을 변경하지 않고 해당 속성에 맞춘 `system-images/android-34/android-automotive/arm64-v8a/` 경로에 설치했습니다. 직접 생성한 패키지 XML은 인식되지 않아 제거했고, `avdmanager`의 속성 인식으로 가상 기기를 생성했습니다. 이 경로는 공식 이미지의 로컬 등록 경로이며 일반 Android 이미지를 대신 실행한 것이 아닙니다.

호스트 가상화 확인에서 Hypervisor.Framework 지원을 확인했습니다. 에뮬레이터 실행은 가상화·CPU 기능 조회가 가능한 호스트 권한에서 수행했습니다. IDE의 첫 실행 마법사·GUI SDK Manager 절차 전체를 검증한 것은 아닙니다.

## 검증 흐름과 관찰

```mermaid
flowchart LR
    baseline["초기 상태: 즐겨찾기 2개 내용 없음 / 최근 목적지 0개"]
    save["내비 UI에서 공개 시험 장소 즐겨찾기 저장"]
    bookmark["즐겨찾기 3개 / 최근 목적지 0개"]
    destination["같은 장소 목적지 지정·내비 안내 시작"]
    recent["즐겨찾기 3개 / 최근 목적지 1개"]
    baseline --> save --> bookmark --> destination --> recent
```

각 단계마다 검증 앱을 새로 실행해 SDK 초기화·리스너 등록 후 즐겨찾기와 최근 목적지를 순서대로 요청했습니다. 아래 개수는 [관찰 요약](results/pleos-nav-probe-2026-10-26.json)의 `list_received` 이벤트에서 산출했습니다. SDK 객체의 내용과 JSON 필드 구조를 함께 확인했으며 시험 자료로 대체하지 않았습니다.

| 실행 | 조작·조건 | 즐겨찾기 응답 | 최근 목적지 응답 | 관찰 판정 |
| --- | --- | --- | --- | --- |
| `20261026T063717Z-baseline` | 초기 내비 데이터 | HOME·OFFICE 2개. 이름·주소·식별자 비어 있음, 좌표 0·0 | 빈 목록 0개 | 서비스 연결·두 콜백 수신. 유효한 장소 2건을 확보했다는 의미는 아님 |
| `20261026T064241Z-bookmark-added` | 내비 검색 결과의 공개 장소를 별표로 저장 | 기존 2개와 DEFAULT 1개 | 빈 목록 0개 | 저장 장소의 내용 수신. 즐겨찾기 저장만으로 최근 목적지가 추가되지는 않은 사례 |
| `20261026T064717Z-destination-selected` | 같은 장소를 목적지로 지정, 내비 앱 안내 진행 | 3개 | 해당 장소 1개 | 최근 목적지의 비어 있지 않은 객체 수신. 실제 방문·도착·서비스 이용을 검증한 것은 아님 |

최초 수집 시 `run-as`의 기본 사용자 0에서 현재 사용자 10의 기록을 읽으려 해 수집에 실패했습니다. 수집기를 현재 사용자 ID에 맞추고 재실행한 결과만 위 표에 사용했습니다. 사용자별 저장소를 구분하는 처리를 코드에 반영했습니다.

검증 중 오류 이벤트·요청 예외·콜백 미수신은 위 세 실행에서 관찰하지 않았습니다. 해당 실패 분기를 실제로 유발해 검증한 것은 아닙니다. 요약의 시간 값은 해당 실행의 관찰 시점이며 응답 성능을 대표하는 측정 결과로 해석하지 않습니다.

독립 검토에서 수집 도구가 일부 실패에도 조기에 종료할 수 있는 문제를 발견해, 현재 주기의 두 목록 응답이 모두 수신된 경우에만 조기 종료하도록 보완했습니다. 실패·늦은 콜백·다음 주기 대기와 요약의 값 제거는 호스트 단위 검사로 확인했습니다. SDK의 실제 실패 분기를 검증한 것으로 확대하지 않습니다.

## 반환 필드와 의미

다음은 SDK 타입 객체를 공개 getter로 읽고 앱이 JSON으로 직렬화한 필드입니다. 내비 서비스의 원본 전송 JSON을 캡처했다는 뜻은 아닙니다. 원본 값은 로컬에 보관하고 공개 문서에는 필드·상태만 기록합니다.

| 필드 | 즐겨찾기 | 최근 목적지 | 이번 비어 있지 않은 시험 장소의 값 상태 |
| --- | --- | --- | --- |
| `latitude`, `longitude` | 수신 | 수신 | 0이 아닌 수치 |
| `displayLatitude`, `displayLongitude` | 수신 | 수신 | null |
| `name`, `address` | 수신 | 수신 | 비어 있지 않은 문자열 |
| `poiId` | 수신 | 수신 | 비어 있지 않은 문자열 |
| `poiSubId` | 수신 | 수신 | null |
| `poiProvider` | 수신 | 수신 | 빈 문자열 |
| `category` | 수신 | 모델에 없음 | HOME·OFFICE·DEFAULT 관찰 |
| 방문일·횟수·주기 | 현재 공개 모델에 없음 | 현재 공개 모델에 없음 | 이 조회 결과로 확보하지 못함 |

HOME·OFFICE 분류가 있어도 초기 응답처럼 장소 내용이 비어 있을 수 있습니다. 분류 이름만으로 집·회사가 등록됐다고 판정하면 잘못된 초기 제안이 발생할 수 있습니다. 유효성 기준은 M1 상세 설계에서 정해야 합니다.

최근 목적지가 생긴 사실은 그 장소에 방문했다는 증거가 아닙니다. 앱의 `observed_at`도 SDK 자료를 받은 시각이며 방문 시각이 아닙니다. 수집 시작 전의 수개월 방문 주기를 이 API 결과만으로 복원할 수 있다는 근거는 확보하지 못했습니다.

## 구현·검증 범위

빌드와 `lintDebug`를 통과했습니다. 최신 대상 API·의존성, 화면 방향, 백업 선언과 앱 아이콘 관련 비차단 경고가 남아 있습니다. 현재 API 34의 개발용 검증 앱이며 배포 심사 완료를 뜻하지 않습니다. 원본 로그는 Android의 `getNoBackupFilesDir()`와 Git 제외 경로에 저장하고 일반 Logcat에는 이벤트 이름만 기록합니다.

실제 확인한 범위는 SDK 자료 다운로드·빌드, 에뮬레이터 부팅, 권한 부여, 서비스 연결, 두 API 요청과 빈 목록·비어 있지 않은 목록 수신입니다. 화면 상단 상태 표시와 수집 파일도 확인했습니다. 아래 미검증 범위는 그대로 남깁니다.

- 🚧 실차 설치·배포·권한·앱 생명주기와 차종별 지원
- 🚧 반복 목적지의 중복·정렬·보존 기간, 프로필 전환, 장소 식별자의 안정성
- 🚧 집·회사 실제 등록 시 값과 일반 즐겨찾기 다건 변경 이벤트
- 🚧 SDK 오류·권한 거부·서비스 중단·콜백 지연 분기의 실제 재현
- 🚧 실제 방문 확인과 장주기 루틴의 초기 학습 정책
- 🚧 백그라운드 수집·자동 시작·원격 기동·서버 전송 조건

관찰시각·자료 종류·출처를 구분하는 M1 계약이 필요하다는 점을 이번 조회로 구체화했습니다. 구체적인 축적·학습·제안 정책은 진민과 후속 설계하며, 이 결과 문서에서 확정하지 않습니다.

## 원본에서 요약 재생성

저장소 루트에서 실행합니다. 원본 폴더는 로컬 전용이므로 다른 개발자는 같은 조건을 재현해 자신의 실행 폴더를 지정합니다.

```sh
python3 prototypes/pleos-nav-probe/scripts/publish_summary.py \
  local-artifacts/pleos-nav-probe/20261026T063717Z-baseline \
  local-artifacts/pleos-nav-probe/20261026T064241Z-bookmark-added \
  local-artifacts/pleos-nav-probe/20261026T064717Z-destination-selected \
  --output docs/research/results/pleos-nav-probe-2026-10-26.json
```

요약에는 장소명·좌표·주소·식별자의 실제 값을 포함하지 않습니다. 원본 로그·에뮬레이터 이미지·APK·로컬 경로 설정·서명 키는 공개 저장소에 올리지 않습니다.
