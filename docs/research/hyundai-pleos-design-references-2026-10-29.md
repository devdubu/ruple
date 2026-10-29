# 현대자동차·Pleos 디자인 참고 자료

> 후속: 사용자 요청으로 [Pleos 기준 공통 디자인](../development/pleos-design-system.md)을 적용했습니다. 아래는 채택 전 조사 기록이며, 이후 자산 다운로드·토큰·폰트·테마 적용 상태는 해당 구현 문서를 따릅니다.

- 조사일: 2026-10-29
- 저장소 기준: `60d7403` 이후 조사 문서 작업 트리
- 범위: 공식 공개 문서·디자인 자산 링크·폰트 배포와 Ruple 공통 프론트 기반의 연결 가능성
- 구분: 확인한 사실과 아래 적용 제안은 별도입니다. 디자인 채택·토큰 교체·Figma import·차량 검증은 수행하지 않았습니다.

## 조사 결론

Ruple의 Pleos 차량 화면에는 **Pleos Connect UI Design Guide**가 가장 직접적인 참고 기준입니다. 공식 사이트는 기초 규칙·컴포넌트 설명과 Figma용 `.fig` 파일을 제공합니다. 현대차의 기존 ccNC 디자인 시스템 **Seon**도 존재하지만, 이번 조사에서는 Seon의 공개 재사용 라이브러리를 확인하지 못했습니다.

| 자료 | 공식 확인 내용 | Ruple에서의 용도 |
|---|---|---|
| [Pleos Connect UI Design Guide](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro) | 사용성·일관성·가독성, 색상·타이포·아이콘·컴포넌트, 디자인 자원 링크 | 차량 UI의 우선 참고 기준 |
| [Colors](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/colors) | 기본 색상과 Background·Surface·Text·Button 등 역할별 색상 체계 | 공통 토큰을 차량용 표현에 대응시키는 기준 |
| [Typography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/typography) | 정보 위계와 서체 지침, 한글·영문용 Asta Sans 연결 | 폰트와 글자 위계의 구체적인 검토 출발점 |
| [Components: Basic button](https://document.pleos.ai/docs/connect/guide/docs-design/components/actions/basic-button) | 버튼 구조·Pressed/Disabled/Loading 상태, 다른 컴포넌트 문서로 연결 | 기존 Button 등과 대응 관계 검토 |
| [Display Layout](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout)·[Window Policy](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/window) | 시스템 UI와 앱 영역, Standard/Wide, 분할·방향 전환 | 전체 디스플레이와 앱 가용 영역을 구분하는 반응형 설계 |
| [현대자동차 공식 Seon 소개](https://www.hyundai.com/content/hyundai/worldwide/en/newsroom/detail/0000000287.html) | 2023년 발표된 ccNC용 디자인 시스템. 수평선·단순한 그래픽·공통 그리드/컴포넌트 | 기존 현대차 화면의 시각·정보 위계 참고. Pleos 규격과 동일시하지 않음 |

## 바로 확인할 디자인 자원

공식 UI 가이드의 `Design Resources Download`에서 다음 링크를 확인했습니다.

- [Pleos Connect display guide — Figma 파일](https://document.pleos.ai/img/Pleos_Connect_display_guide_215.fig)
- [Pleos Connect design assets — Figma 파일](https://document.pleos.ai/img/Pleos_Connect_design_assets_215.fig)

문서와 바이너리 링크까지 확인했으며 Figma에서 파일을 열어 레이어·컴포넌트·Variables·내부 버전을 검사하지는 않았습니다. 파일명의 `215`만으로 배포 버전을 단정하지 않습니다. 이후 사용하는 시점에는 공식 가이드의 최신 다운로드 링크를 다시 확인합니다. 디자인 자산의 재배포 조건도 폰트 라이선스와 별개입니다.

공식 문서·검색 범위에서 바로 설치해 사용할 수 있는 Pleos React/npm 컴포넌트 패키지는 확인하지 못했습니다. 가이드·디자인 자산 제공과 웹 구현 라이브러리 제공은 구분합니다. 검색에 나오는 비공식 현대차 웹사이트 토큰 분석이나 제3자 UI kit도 공식 차량 규격의 근거로 쓰지 않습니다.

## 폰트: Asta Sans

Pleos Typography 문서는 System UI 폰트 자료로 Asta Sans를 연결하고 한글·영문 지원을 명시합니다. 원 배포처는 [42dot/Asta-Sans](https://github.com/42dot/Asta-Sans)이며 [OFL.txt](https://github.com/42dot/Asta-Sans/blob/main/OFL.txt)에서 SIL Open Font License 1.1을 확인했습니다. 앱에 포함해 배포할 때는 저작권 표시·라이선스 동봉 등 해당 조건을 반영합니다.

Seon과 함께 소개된 **Hyundai Sans UI**와 **Asta Sans**는 서로 다른 서체입니다. 현대차 브랜드 폰트를 공개 무료 폰트라고 가정해 포함할 근거는 확보하지 않았습니다. 현재 Ruple은 시스템 폰트 목록을 사용하므로 Asta Sans는 도입 후보이며 설치·적용 완료 상태가 아닙니다.

## 차량 UI에서 함께 확인할 사항

- UI 가이드는 높은 대비, 짧고 명확한 정보, 주·야간 가독성, 다양한 화면 비율 대응을 제시합니다. 전체 시스템 상태 표시줄·GNB를 Ruple 화면 안에 복제하는 대신 실제 앱 창에 맞춰 설계합니다.
- 아이콘 가이드의 [48×48dp 제작 그리드](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/contents-creation/iconography)는 아이콘 제작 기준입니다. 이를 버튼 터치 영역의 크기로 해석하지 않습니다. Android dp·sp, CSS px, 물리 mm도 자동으로 같다고 보지 않습니다.
- [주행 안전 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driver-distraction-guideline)와 [주행 규제 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)는 플랫폼의 `CarUxRestrictions`에 따른 기능·UI 제한을 설명합니다. 단순히 버튼 크기만 키우는 것으로 충족되지 않습니다.
- [앱 리뷰 가이드](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide/review-driver-distraction-elements)는 UI 가이드를 사전 확인하도록 요구하며, 준수만으로 등록이 보장되지는 않는다고 명시합니다. 주행 규제 개발 문서는 별도의 UX 규제 Figma 사양서는 공개하지 않는다고 밝힙니다. 공개 디자인 자산이 모든 규제 상세를 포함한다고 보지 않습니다.

## 현재 기반에 적용하는 제안

아래는 조사 결과에 따른 제안이며 아직 채택·구현한 디자인 사양이 아닙니다.

1. **RUPLE 브랜드 + Pleos 차량 UX 기준**으로 구성합니다. RUPLE 로고·브랜드 의미는 유지하고 차량 레이아웃·정보 위계·컴포넌트 상태·제약을 Pleos와 맞춥니다. 폰 웹에는 동일한 브랜드·의미 토큰을 사용하되 조작 밀도·메뉴·편집 흐름은 별도 설계합니다.
2. 현재 React·Tailwind·Radix 기반 `packages/presentation`을 구현 기반으로 유지하고 Pleos 참고 자료와 토큰·컴포넌트의 대응표를 먼저 만듭니다. 가이드가 npm 라이브러리를 제공한다고 가정해 기술 스택을 바꾸지 않습니다.
3. 공식 `.fig` 자료를 열어 색상·글자 위계·버튼·팝업·입력·탭·상태 표현과 필요한 사용 조건을 확인한 뒤, 현재 CSS 토큰에 매핑합니다. 현재 밝은 테마·시스템 폰트·차량 64px 컨트롤은 Ruple의 기술 초기값이며 Pleos 인증 수치가 아닙니다.
4. 주·야간 모드, 차량 분할 창·방향 전환·가용 영역, 주행 규제 상태를 공통 프레젠테이션/차량 호스트의 후속 설계 항목으로 둡니다. 실제 WebView 밀도·호스트·터치·한글 가독성을 검증한 뒤 차량 표시 프로필을 확정합니다.

이 작업은 공통 디자인 기반의 책임에 해당합니다. 추천·루틴·승인 등 업무 필드와 상세 화면의 정책을 대신 설계하는 작업은 아닙니다.
