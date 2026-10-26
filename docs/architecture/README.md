# 루플레 입출력과 역할 아키텍처

루플레는 출퇴근부터 몇 달에 한 번 방문하는 장소까지 챙기는 개인화 모빌리티 루틴 앱입니다. 반복 방문 이력과 등록 장소를 근거로 루틴을 자동 제안하고, 사용자 승인 후 다음 방문을 준비하는 방향을 추구합니다.

- 기준일: 2026년 10월 26일
- 근거: 프로젝트 기획 대화와 네 가지 입출력 시나리오
- 설계 단계: 입력·출력과 구성요소의 역할을 정리한 개념 설계 초안
- 확인 범위: 아래 기획 방향은 사용자 지정 사항이며, 도해의 책임 배치와 상세 설계는 후속 검토 대상

## 기획 방향과 역할

차량 Pleos 앱이 메인이고 스마트폰 앱은 관리·가시화를 담당하는 컴패니언입니다. 두 앱을 엣지 클라이언트(Edge Client), 중앙 서버를 자동화 허브(Automation Hub)로 구성합니다. 사용자는 차량·스마트폰 어디서든 시작할 수 있습니다.

| 구성요소 | 입력 | 출력과 책임 |
| --- | --- | --- |
| 차량 Pleos 앱 | 확보 가능한 차량 근거, 사용자 승인·등록·조회·수정·삭제·확인 요청 | 루틴·진행 상태·알림·결과 표시, 차량 기능 실행 |
| 스마트폰 컴패니언 앱 | 사용자 승인·등록·조회·수정·삭제·확인 요청 | 루틴 관리, 진행 상태·알림·결과 표시 |
| Automation Hub | 두 앱의 정보·요청, 시간·조건 신호 | 관찰 근거·후보·승인 루틴 관리, 규칙 판정, 실행·출력 조정, 상태·결과 통합 |

차량 기능 실행은 현재 개념적인 책임 경계입니다. 구체적인 기능과 권한은 상세 아키텍처 단계에서 결정합니다.

## 입력과 출력의 네 조합

입력은 관찰 정보나 사용자 요청이 들어오는 기기이고, 출력은 해당 처리의 결과를 보여주는 기기입니다. 입력 기기도 자기 요청의 처리 여부를 확인할 수 있어야 합니다.

| 입력 기기 | 스마트폰 결과 표시 | 차량 앱 결과 표시 |
| --- | --- | --- |
| 스마트폰 앱 | 스마트폰 입력 후 스마트폰에서 확인 | 스마트폰 입력 후 차량에서 확인 |
| 차량 앱 | 차량 입력 후 스마트폰에서 확인 | 차량 입력 후 차량에서 확인 |

입력 기기와 결과 표시 기기는 독립적으로 구분합니다. 차량 동작이 포함되면 차량 앱이 실행하고, 그 진행·결과를 서버에 보고합니다. 결과 표시 대상이 스마트폰인 경우에도 차량 동작의 실행 주체는 차량 앱입니다. 안내·알림형 루틴은 서버 처리 후 대상 기기로 결과를 전달할 수 있습니다.

같은 루틴 안에서도 단계마다 입출력 조합이 달라질 수 있습니다. 실제 출력 대상 결정 정책은 미정입니다.

## 역할 구성도

상자는 논리적인 책임 구분입니다. 물리적인 배포 구성과 기술 스택은 추후 결정합니다.

```mermaid
%% 프로젝트 설계 초안. 근거: 현재 대화의 4개 입출력 시나리오와 차량 메인·스마트폰 컴패니언 역할 지정.
%% 논리 책임 구분이며 배포 단위나 기술 스택을 지정하지 않음.
%% 미정: 사용자 연결, 출력 대상 정책, 구체 차량 기능과 권한.
flowchart LR
    subgraph phone ["스마트폰 컴패니언 앱"]
        phoneInput["루틴 관리·확인 입력"]
        phoneOutput["루틴·진행 상태·알림·결과"]
    end
    subgraph hub ["Automation Hub"]
        hubInput["공통 입력·상태 처리"]
        hubPattern["관찰 근거·패턴 엔진·후보"]
        hubRoutine["승인 루틴·규칙 엔진"]
        hubDispatch["실행·출력 조정 (대상 정책 미정)"]
        hubResult["진행·전달·결과 관리"]
    end
    subgraph vehicle ["차량 Pleos 앱 - 메인"]
        vehicleInput["차량 근거·루틴 관리 입력"]
        vehicleOutput["루틴·진행 상태·알림·결과"]
        vehicleAction["차량 기능 실행 (상세 미정)"]
    end

    phoneInput -->|"관리·확인 요청"| hubInput
    vehicleInput -->|"관찰·관리 요청"| hubInput
    hubInput -->|"허용된 관찰 정보"| hubPattern
    hubInput -->|"사용자 승인·등록·조회·변경"| hubRoutine
    hubPattern -->|"스마트폰 제안 대상 시"| phoneOutput
    hubPattern -->|"차량 제안 대상 시"| vehicleOutput
    phoneOutput -.->|"사용자 확인·승인"| phoneInput
    vehicleOutput -.->|"사용자 확인·승인"| vehicleInput
    hubRoutine -->|"활성 루틴"| hubDispatch
    hubRoutine -->|"조회·변경 결과"| hubResult
    hubDispatch -->|"안내·진행 상태"| hubResult
    hubDispatch -->|"차량 동작이 있는 경우"| vehicleAction
    vehicleAction -->|"실행 진행·결과"| hubResult
    hubResult -->|"스마트폰 출력 대상 시"| phoneOutput
    hubResult -->|"차량 출력 대상 시"| vehicleOutput

    style phone fill:#F5F5F5,stroke:#B3B3B3
    style hub fill:#DCCCFF,stroke:#874FFF
    style vehicle fill:#C2E5FF,stroke:#3DADFF
```

## 입력부터 실행 결과까지의 흐름

자동 제안이 기본 경로이며, 수동 등록도 선택 기능으로 제공합니다. 제안은 사용자 확인·수정·승인을 거쳐 루틴으로 활성화합니다. 조회·수정·삭제도 두 앱에서 같은 서버 상태를 기준으로 처리합니다.

패턴 엔진은 근거를 바탕으로 후보를 생성하고, 규칙 엔진은 승인된 활성 루틴의 조건을 판정합니다.

```mermaid
%% 전체 흐름의 개념 설계 초안. 상세 판정 로직·차량 기능·권한은 미정.
%% 스마트폰·차량 입력과 결과 표시 기기는 독립. 차량 동작 실행 주체는 차량 앱.
%% 실행 결과 확인과 실제 방문 완료 확인은 별개.
flowchart TD
    phoneIn["스마트폰 입력"]
    vehicleIn["차량 앱 입력"]
    intake["서버: 입력·공통 상태 확인"]
    inputKind{"입력 종류"}
    pattern["서버: 근거 정리·패턴 후보"]
    evidenceWait["근거 축적 대기"]
    suggestion["앱: 근거·주기·조건 제안"]
    manualConfirm["앱: 수동 등록 내용 확인"]
    approval{"사용자 승인"}
    inactive["서버: 미활성화·응답 보관"]
    routine["서버: 루틴 조회·등록·수정·삭제"]
    condition["서버: 시간·조건 신호"]
    rule["서버: 활성 루틴 조건 판정"]
    routineWait["조건 충족 대기"]
    actionKind{"동작 유형"}
    vehicleDispatch["서버: 차량 작업 전달"]
    vehicleAction["차량 앱: 차량 동작 실행 (상세 미정)"]
    result["서버: 처리·실행·전달 상태 통합"]
    target{"결과 표시 대상 (정책 미정)"}
    phoneOut["스마트폰: 조회·진행·알림·결과"]
    vehicleOut["차량 앱: 조회·진행·알림·결과"]

    phoneIn --> intake
    vehicleIn --> intake
    intake --> inputKind
    inputKind -->|"관찰·등록 장소"| pattern
    inputKind -->|"관리·확인 요청"| routine
    inputKind -->|"수동 등록 (선택)"| manualConfirm
    manualConfirm --> approval
    pattern -->|"근거 부족"| evidenceWait
    pattern -->|"근거 충족"| suggestion
    suggestion --> approval
    approval -->|"거절"| inactive
    inactive --> result
    approval -->|"승인·수정 후 승인"| routine
    routine -->|"조회·변경 처리 결과"| result
    routine -->|"활성 승인 루틴만"| rule
    condition --> rule
    rule -->|"미충족"| routineWait
    rule -->|"실행 시점 충족"| actionKind
    actionKind -->|"안내·알림"| result
    actionKind -->|"차량 동작"| vehicleDispatch
    vehicleDispatch -->|"전달 대기·진행 상태"| result
    vehicleDispatch --> vehicleAction
    vehicleAction -->|"진행·대기·실행 결과"| result
    result --> target
    target -->|"스마트폰"| phoneOut
    target -->|"차량 앱"| vehicleOut

    style vehicleAction fill:#C2E5FF,stroke:#3DADFF
    style evidenceWait fill:#FFECBD,stroke:#FFC943
    style routineWait fill:#FFECBD,stroke:#FFC943
```

## 상태를 구분하는 기준

- 목적지 지정 기록, 실제 방문 확인, 패턴 추정, 사용자 승인 구분
- 루틴 저장 완료와 출력 기기 전달 완료 구분
- 차량 작업 전달 대기, 실행 진행, 실행 결과 구분
- 안내 전달·차량 기능 실행 결과와 실제 방문 완료 구분
- 삭제된 루틴은 신규 실행 대상에서 제외

실행 시점은 서버의 시간·조건 판정으로 도래할 수 있습니다. 최초 입력 기기를 다시 실행해야 한다고 전제하지 않습니다. 필요한 데이터나 대상 기기가 연결되지 않은 경우의 처리는 전달·실행 상태로 구분해 상세 설계합니다.

## 상세 설계에서 결정할 사항

- 🚧 동일 사용자 식별·로그인·기기 연결 방식
- 🚧 상황별 제안·알림·결과 출력 대상 결정 정책
- 🚧 실제 확보할 수 있는 차량·내비 데이터의 범위
- 🚧 구체적인 차량 실행 기능, 소프트웨어 개발 도구(SDK) 지원과 권한
- 🚧 제안 기준, 주기 추정, 조건 판정 등 내부 로직
- 🚧 데이터 구조, 인터페이스, 기술 스택과 배포 구성
- 🚧 동의 철회, 데이터 보존·삭제, 통신 중단과 동시 변경 처리 정책

이 문서는 현재 합의한 입출력·역할을 기준으로 이어서 설계하기 위한 초안입니다. 미정 항목을 구현 가능 또는 승인 완료로 간주하지 않습니다.
