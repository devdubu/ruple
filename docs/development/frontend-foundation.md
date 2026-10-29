# 프론트 공통 기반 v1

두 트랙이 같은 UI 재료·화면 등록·API 처리 위에서 자기 기능을 설계하도록 구성했습니다. 확정한 React·Vite·TypeScript·Tailwind CSS·shadcn/ui 방식·TanStack Query를 사용합니다. 추천·루틴·실행 상세 화면과 실제 차량 호스트는 후속입니다.

## 시작하기

```bash
pnpm install --frozen-lockfile
pnpm dev:ui
# http://localhost:5173/#/ui-preview

pnpm dev:a
pnpm dev:b
```

미리보기는 명시적으로 켠 개발 서버에서만 등록합니다. 일반 트랙 실행에는 개발 메뉴가 없고 production 빌드에는 미리보기 모듈·경로가 포함되지 않습니다. 예시 입력·상태는 서버 저장이나 실제 차량 실행을 수행하지 않습니다. API·DB·GPU 없이 UI를 확인할 수 있습니다.

## 소유권과 경계

| 위치 | 제공하는 것 |
|---|---|
| packages/presentation | 토큰·컴포넌트·디바이스 프로필·앱 셸·화면 등록 |
| packages/platform | 기존 HTTP 기술 계약의 소비자 타입·응답 검사 |
| packages/platform-client | API 클라이언트·서비스 주입·Query·캐시 경계 |
| packages/<도메인>/ui | 담당자가 구현할 기능 화면·서버 상태 연결 |
| apps/web | 트랙 선택·앱 조립·API 주소·Provider·개발 미리보기 |

기능 UI는 앱 내부 파일을 import하지 않습니다. 앱이 클라이언트를 주입하고 기능은 `useApiClient('context')` 등으로 사용합니다. 다른 도메인 내부와 서버 코드는 Nx가 차단합니다. 업무 데이터는 자기 공개 API로 조회합니다.

## 디자인 재료

토큰 정본은 `packages/presentation/src/styles.css`입니다. 밝은 바탕·짙은 녹색 주요 동작·검정 RUPLE 심벌을 기본으로 foreground·muted·border·ring·success·warning·destructive를 의미별 변수로 제공합니다. `bg-card`, `text-muted-foreground` 같은 토큰을 사용하고 기능마다 색상·기본 컴포넌트를 복제하지 않습니다. 최종 제품 화면 명세를 대신하지는 않습니다.

Tailwind 4는 presentation, `packages/*/ui/src`, `apps/web/src`를 스캔합니다. 새 위치에 UI를 만들면 소스를 추가하고, utility는 동적 문자열 조합 대신 완성된 class 이름으로 작성합니다. CSS는 앱에서 한 번 import합니다.

| 컴포넌트 | 기본 동작 |
|---|---|
| Button | primary·secondary·ghost·destructive, 기본 type=button, pending 시 차단 |
| Input·InputField | native 입력, 레이블·필수·도움말·오류의 aria 연결 |
| Card*·PageHeading | 정보 묶음과 페이지 제목 |
| Badge | neutral·positive·warning·danger, 문구로도 상태 구분 |
| Dialog* | Radix 기반 명명·포커스 제한·Escape·트리거 복귀 |
| LoadingState·EmptyState·ErrorState | 로딩·확인된 빈 결과·실패·재시도 |
| AsyncContent | 최초 실패와 기존 데이터가 있는 갱신 실패 구분 |

shadcn/ui 방식으로 컴포넌트 소스를 저장소가 소유합니다. Radix·CVA·clsx·tailwind-merge를 사용하며 `components.json`에 위치를 기록했습니다. 기본 재료는 presentation에, 업무 카드·폼의 구성은 담당 UI 패키지에 둡니다. 표·날짜 선택·음성·Gen UI 렌더러는 아직 없습니다.

본문 건너뛰기·focus-visible·스크린리더 상태·reduced-motion을 기본으로 둡니다. 상세 화면의 접근성·입력 설명·초점 이동은 담당 기능에서 추가 검토합니다.

## 스마트폰·차량 프로필

phone은 본문 16px, 보통 컨트롤 48px, 작은 컨트롤 최소 44px입니다. car는 본문 20px, 컨트롤 최소 64px입니다. Dialog portal에도 같은 프로필을 전달합니다.

```tsx
<DeviceProvider device="car"><Button>내용 확인</Button></DeviceProvider>
```

전체 앱은 `VITE_DEVICE_PROFILE=phone|car`로 선택합니다. 미리보기에서는 샘플 영역만 전환합니다. 좁은 화면은 가로 메뉴, 넓은 화면은 사이드 메뉴를 사용합니다.

웹에서 검증한 표시 프로필입니다. 실제 Pleos WebView·Capacitor 호환, 주행 중 허용 정보·입력·마이크·심사 적합성은 미검증입니다. Tailwind 4의 최신 CSS를 사용하므로 대상 WebView 버전을 포함한 호스트 시험이 필요합니다.

## 기능 등록

메타데이터 정본은 `presentation-feature@1.0.0`입니다. id·path·label과 선택적인 description을 정의합니다. React Component는 코드에서 연결하며 서버·AI JSON을 실행하지 않습니다. Gen UI의 동작 허용 목록과는 별도입니다.

```tsx
import { PageHeading, type FeatureEntry } from '@ruple/presentation';
function ExamplePage() { return <PageHeading title="내 화면" />; }
export const exampleFeature: FeatureEntry = {
  id: 'example', path: '/example', label: '내 화면', Component: ExamplePage,
};
```

자기 UI 패키지에서 export하고 앱 조립부에 등록합니다. 중복 id·path와 잘못된 메타데이터는 시작 시 거부합니다. 현재 경로는 `#/context`, `#/routines`, `#/activity`입니다. hash 라우팅으로 정적 호스팅에서 직접 진입·뒤로가기를 지원하고, 알 수 없는 경로는 오류를 표시합니다. 화면 전환 시 main으로 초점을 이동하고 기능을 새로 마운트합니다. 편집 이탈 확인은 기능별로 추가합니다.

## API·서버 상태

주소는 앱의 `src/lib/api.ts`에서 구성하고 ApiClientsProvider로 주입합니다. 기능 UI에는 앱 내부 import가 필요하지 않습니다. 아래는 기존 기술 계약을 조회하는 예제입니다.

```tsx
import { parseRuntimeContext } from '@ruple/platform';
import { apiErrorDetails, serviceQueryKey, useApiClient, useQuery } from '@ruple/platform-client';
import { AsyncContent } from '@ruple/presentation';

function ConnectionExample() {
  const api = useApiClient('context');
  const query = useQuery({
    queryKey: serviceQueryKey('context', 'runtime-context'),
    queryFn: ({ signal }) => api.get('/api/v1/runtime/context', parseRuntimeContext, { signal }),
  });
  const { message, requestId } = apiErrorDetails(query.error);
  return <AsyncContent {...query} errorMessage={message} requestId={requestId}
    onRetry={() => { void query.refetch(); }}>
    {(data) => <p>요청 번호: {data.requestId}</p>}
  </AsyncContent>;
}
```

업무 응답은 합의한 계약으로 decoder를 작성합니다. JSON을 TypeScript 타입으로 강제 캐스팅하지 않습니다. 클라이언트는 HTTP 오류·규격 위반·네트워크·timeout·취소를 구분하고 원본 서버 메시지·HTML 대신 코드에 따른 한국어 문구와 유효한 요청 ID를 제공합니다.

요청마다 UUID를 전달하고 오류 본문·헤더의 ID 충돌은 규격 오류로 처리합니다. timeout은 기본 10초이며 AbortSignal을 연결합니다. 조회·변경의 자동 재시도는 기본 비활성화합니다. 중복 방지·승인·409 충돌 처리는 업무 계약으로 설계합니다. 현재는 JSON API용이며 204·파일·음성 스트리밍은 별도 계약·어댑터가 필요합니다.

쿠키는 기본 전송하지 않습니다. 토큰은 명시적인 getAccessToken callback으로만 제공하며 저장·로그·신원 헤더 생성을 하지 않습니다. 주소 탈출·자격 증명 포함 URL·redirect를 차단합니다. 실제 로그인 제공자는 아직 없습니다.

AsyncContent는 최초 로딩·네트워크 대기·확인된 빈 결과·오류를 구분합니다. 기존 데이터가 있으면 갱신 실패 때 내용을 유지합니다. isEmpty 판정은 담당 기능이 지정합니다.

## 주소·캐시

Vite 개발 프록시는 `/services/context`, `/services/automation`, `/services/interaction`, `/services/ai`를 로컬 3001·3002·3003·3010에 연결합니다. 같은 origin에서 개발하므로 기본 CORS를 변경하지 않아도 됩니다. 직접 연결은 VITE_*_API_URL과 백엔드의 정확한 CORS origin으로 설정합니다.

독립 개발용 주소입니다. 운영 BFF·Ingress·AI 공개 경로는 배포 전 별도 구성합니다. VITE_*는 브라우저에 공개되므로 토큰·비밀을 넣지 않습니다.

Query key는 serviceQueryKey로 서비스 이름을 앞에 붙이고 자원·식별자를 잇습니다. 기본 staleTime은 30초, 미사용 캐시는 5분이며 브라우저 저장소에 영속화하지 않습니다. 사용자·차량 맥락이 바뀌면 앱 cacheScope를 불투명한 세션 경계로 바꿉니다. 새 QueryClient를 만들고 기존 요청·캐시를 취소·제거합니다. 토큰을 scope나 query key에 넣지 않습니다. 현재 앱 scope는 anonymous이고 실제 로그인·차량 전환은 후속입니다.

## 검사와 다음 단계

```bash
pnpm check
pnpm test:smoke
pnpm exec playwright install chromium
pnpm test:ui
```

test:ui는 production 빌드 후 개발·production 웹 서버를 띄워 Chromium에서 경로·입력·포커스·차량 크기·API 오류·개발 미리보기 제외를 검사합니다. API·DB·GPU가 필요하지 않습니다. 기존 Chromium은 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH로 선택할 수 있습니다. CI는 Chromium 설치 후 같은 검사를 수행합니다.

다음은 개발 DB·마이그레이션·시험 데이터와 상대 서비스·AI·차량의 계약 기반 대체 응답입니다. UI 상태 예시는 그 서비스 대체 응답을 구현한 것이 아닙니다. 실제 인증·차량 호스트·푸시·음성·PWA 설치 시험도 후속입니다.
