# Pleos 기준 공통 디자인

2026-10-29 사용자 요청에 따라 Ruple 공통 UI의 기준을 Pleos Connect로 통일했습니다. RUPLE 로고와 제품 이름, 기존 React·Tailwind·Radix 기반을 유지하고 공통 색상·타이포·버튼·입력·팝업·테마에 적용했습니다. 업무 필드·승인 정책·상세 화면은 각 기능 담당자가 설계합니다.

## 기준과 구현 위치

- 공식 기준: [Pleos Connect UI Design Guide](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro)
- 조사: [현대자동차·Pleos 디자인 참고 자료](../research/hyundai-pleos-design-references-2026-10-29.md)
- 구현 정본: `packages/presentation/src/styles.css`, 공통 컴포넌트와 `theme.tsx`
- 출처·확인일·원본 해시: `packages/presentation/pleos-sources.json`

색상표와 버튼·글자 도판을 직접 확인하고 공식 `.fig` 두 파일을 내려받아 ZIP 구조와 메타데이터를 확인했습니다. Display guide의 내부 파일 이름은 `2.1.5`입니다. Figma에서 Variables·컴포넌트를 직접 열거나 자동 동기화하지는 않았습니다. 원본 다운로드 자료·도판은 Git 제외 경로 `local-artifacts/pleos-reference/`에 두고 이 저장소에는 출처와 구현을 남깁니다.

## 토큰 대응

[Grayscale·System Color](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/colors)의 원시 색상을 `--pleos-basic-*`, `--pleos-informative-*`로 보관하고 기존 의미 토큰에 연결했습니다. 기능 화면은 기존 `bg-card`, `text-foreground`, `bg-primary` 등을 계속 사용합니다.

| 기존 의미 토큰 | 대응과 사용 |
|---|---|
| background / card / popup | Pleos grayscale 기반 앱 바탕·카드·팝업 역할 |
| foreground / muted-foreground | 주 정보와 보조 정보의 명암 위계 |
| primary / secondary | 중립적인 채움 버튼과 보조 버튼 |
| primary-hover / primary-pressed | hover와 누름 상태를 명시적으로 구분 |
| disabled / disabled-foreground | 버튼 비활성·처리 중 상태 |
| ring / success | informative_positive: 주간 `#0064FF`, 야간 `#0082FF` |
| input / border | 입력 경계와 비상호작용 구분선의 대비를 분리 |

Grayscale의 흰색·회색·검정 값과 informative 원시 색상은 공식 표를 사용합니다. 앱 바탕·카드·버튼에 어떤 단계를 연결할지는 Ruple의 웹 구현 대응표이며, 공식 Figma의 모든 의미 토큰을 그대로 복제했다고 간주하지 않습니다. 원시 accent의 녹색은 사용자 동작의 기본 색으로 사용하지 않습니다.

공식 negative accent `#FF3D16`·`#FF4C28`도 원시 토큰으로 유지합니다. 작은 오류 텍스트·위험 버튼에는 대비를 확보한 읽기용 변형을 사용하고, warning·상태 바탕은 Ruple 보조 토큰으로 구분했습니다. 이는 Pleos가 별도로 공개한 동일 이름의 토큰이라고 주장하지 않습니다. 브라우저 시험에서 주·야간 본문·보조 문구·기본 버튼·성공/오류/주의 문구의 주요 색상 조합을 4.5:1 이상으로 검사합니다.

## 폰트와 크기

[Pleos Typography](https://document.pleos.ai/docs/connect/guide/docs-design/foundations/typography)가 연결하는 Asta Sans를 로컬 번들로 적용했습니다. `@fontsource-variable/asta-sans@5.3.0`을 고정하고 한글·영문 WOFF2 subset을 Vite가 앱 자원으로 출력합니다. 외부 폰트 CDN을 실행 중 호출하지 않습니다. 이번 빌드의 전체 폰트 자원은 92개·약 1.99MB이며 브라우저는 필요한 문자 범위만 요청합니다. PWA 캐시·설치 후 완전 오프라인 부팅은 별도입니다.

[원 배포처](https://github.com/42dot/Asta-Sans)의 OFL 1.1 조건에 따라 라이선스를 앱의 `/licenses/asta-sans-OFL.txt`에도 포함했습니다. 기본 굵기는 300~800 가변 범위이며 별도 Hyundai Sans UI를 포함하지 않습니다.

| 프로필 | 본문 / 보조 | 버튼 최소 높이: small / default / large |
|---|---|---|
| phone | 16 / 14 CSS px | 44 / 48 / 56 CSS px |
| car | 20 / 18 CSS px | 64 / 80 / 100 CSS px |

차량 버튼 글자는 20/24/28 CSS px입니다. 큰 터치 영역과 둥근 채움 버튼, 명확한 정보 위계를 참고해 웹 프로필을 구성했습니다. 이 값은 Android dp·sp 또는 실제 mm를 자동 변환한 차량 인증 수치가 아닙니다. 실제 WebView 밀도·거리·표시 영역에서 별도 확인합니다.

## 주간·야간·자동

앱 루트의 `ThemeProvider`가 기본 `system` 모드에서 브라우저/OS의 `prefers-color-scheme` 변경을 따릅니다. 앱 상단의 `화면 테마`에서 자동·주간·야간을 선택할 수 있습니다. 선택은 현재 앱 세션에 유지하고 재시작하면 자동으로 시작합니다.

```tsx
import { DeviceProvider, ThemeProvider } from '@ruple/presentation';

<ThemeProvider defaultMode="system">
  <DeviceProvider device="car">{/* 공통 UI와 기능 화면 */}</DeviceProvider>
</ThemeProvider>
```

테마와 폰/차량 프로필은 서로 독립적입니다. Dialog portal에도 두 값을 전달하므로 본문 밖의 팝업·입력·닫기 버튼이 같은 테마와 크기를 사용합니다. RUPLE 검정 심벌은 두 테마에서 읽을 수 있는 밝은 타일에 표시합니다.

실제 차량의 주·야간 신호는 아직 연결하지 않았습니다. 호스트 연동 시 신호를 검증한 어댑터가 `useTheme().setMode()`를 호출하도록 연결할 수 있습니다. 테마 상태는 주행 중 기능 허용·차량 권한·CarUxRestrictions 상태를 대신하지 않습니다.

## 기능 개발과 검증

기능마다 색상·버튼·입력·팝업을 복제하지 않고 공통 토큰·컴포넌트를 사용합니다. 오류는 색상과 함께 문구로 표현하고, pending 버튼은 중복 선택을 막으며 키보드 초점·Dialog Escape/복귀를 유지합니다. 폰과 차량의 조작 밀도·기능 허용 범위는 업무 화면·호스트 설계에서 구분합니다.

```bash
pnpm dev:ui
# /#/ui-preview → 상단 테마 + 폰/차량 프로필 확인
pnpm test:ui
pnpm check
```

Chromium에서 320px 폰, 400px 차량 앱 창, 차량 팝업, 자동 테마 변경·수동 선택, 주요 색상 대비, 한글 폰트의 동일 origin 로딩·라이선스 제공을 검사합니다. 실제 Pleos 호스트·분할 창 이벤트·주행 중 입력 제한·음성·심사 적합성은 후속 검증입니다.
