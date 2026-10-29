import { Component, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from './lib/utils';
import type { FeatureEntry } from './registry';
import { ErrorState } from './components/states';

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <ErrorState title="화면을 표시하지 못했어요" onRetry={() => this.setState({ failed: false })} /> : this.props.children;
  }
}

export function AppShell({ features, brandMark }: { features: FeatureEntry[]; brandMark?: string }) {
  const path = useSyncExternalStore(subscribe,
    () => window.location.hash.slice(1) || features[0]?.path,
    () => features[0]?.path);
  const active = features.find((feature) => feature.path === path);
  const main = useRef<HTMLElement>(null);
  const previous = useRef(path);
  useEffect(() => {
    if (previous.current !== path) main.current?.focus();
    previous.current = path;
  }, [path]);
  return <div className="min-h-screen">
    <a href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }} className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">본문으로 건너뛰기</a>
    <div className="mx-auto max-w-[var(--content-width)] px-[var(--page-space)]">
      <header className="flex min-w-0 flex-col gap-5 border-b py-6 sm:flex-row sm:items-center sm:justify-between">
        <a className="inline-flex w-fit items-center gap-3 text-foreground" href={`#${features[0]?.path ?? '/'}`} aria-label="루플레 홈">
          {brandMark && <img src={brandMark} alt="" className="size-9 object-contain" />}
          <span className="text-xl font-bold tracking-[.12em]">RUPLE</span>
        </a>
        <p className="text-sm text-muted-foreground">나의 이동을 잇는 루틴</p>
      </header>
      <div className="grid min-w-0 gap-8 py-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <nav aria-label="주요 메뉴" className="flex min-w-0 gap-2 overflow-x-auto p-1 md:flex-col md:self-start">
          {features.map((feature) => <a key={feature.id} href={`#${feature.path}`}
            aria-current={active?.id === feature.id ? 'page' : undefined}
            className={cn('flex min-h-[var(--control-height)] shrink-0 items-center rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none',
              active?.id === feature.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
            {feature.label}
          </a>)}
        </nav>
        <main id="main-content" ref={main} tabIndex={-1} className="min-w-0 outline-offset-4">
          {active ? <ScreenBoundary key={active.id}><active.Component /></ScreenBoundary>
            : <ErrorState title="화면을 찾을 수 없어요" message="메뉴에서 이동할 화면을 선택해주세요." />}
        </main>
      </div>
    </div>
  </div>;
}
