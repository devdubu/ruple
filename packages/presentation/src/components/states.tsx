import type { ReactNode } from 'react';
import { Button } from './ui/button';

export function LoadingState({ label = '불러오는 중이에요' }: { label?: string }) {
  return <div role="status" aria-busy="true" className="grid gap-4 rounded-lg border bg-card p-6">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div aria-hidden="true" className="grid gap-3 motion-safe:animate-pulse">
      <div className="h-4 w-1/2 rounded bg-muted" /><div className="h-4 w-3/4 rounded bg-muted" />
    </div>
  </div>;
}
export function EmptyState({ title = '아직 표시할 내용이 없어요', description, action }: {
  title?: string; description?: string; action?: ReactNode;
}) {
  return <div role="status" className="grid justify-items-start gap-3 rounded-lg border border-dashed bg-card p-6">
    <p className="font-medium">{title}</p>
    {description && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {action}
  </div>;
}
export function ErrorState({ title = '정보를 불러오지 못했어요', message = '잠시 후 다시 시도해주세요.', requestId, onRetry }: {
  title?: string; message?: string; requestId?: string; onRetry?: () => void;
}) {
  return <div role="alert" className="grid justify-items-start gap-3 rounded-lg border border-destructive/25 bg-danger-surface p-6">
    <p className="font-semibold text-destructive">{title}</p><p className="text-sm leading-relaxed">{message}</p>
    {requestId && <p className="max-w-full break-all text-sm text-muted-foreground">문의 번호: {requestId}</p>}
    {onRetry && <Button variant="secondary" onClick={onRetry}>다시 시도</Button>}
  </div>;
}

export function AsyncContent<T>({ data, isPending, isError, fetchStatus, isEmpty = () => false,
  errorMessage, requestId, onRetry, emptyTitle, emptyDescription, children }: {
  data: T | undefined; isPending: boolean; isError: boolean; fetchStatus?: 'fetching' | 'paused' | 'idle';
  isEmpty?: (data: T) => boolean; errorMessage?: string; requestId?: string; onRetry?: () => void;
  emptyTitle?: string; emptyDescription?: string; children: (data: T) => ReactNode;
}) {
  if (data === undefined) {
    if (fetchStatus === 'paused') return <ErrorState title="연결을 확인해주세요" message="연결되면 정보를 다시 불러옵니다." onRetry={onRetry} />;
    if (isError) return <ErrorState message={errorMessage} requestId={requestId} onRetry={onRetry} />;
    if (isPending) return <LoadingState />;
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <div className="grid gap-4" aria-busy={fetchStatus === 'fetching' || undefined}>
    {isError && <ErrorState title="최신 정보를 확인하지 못했어요" message={errorMessage} requestId={requestId} onRetry={onRetry} />}
    {isEmpty(data) ? <EmptyState title={emptyTitle} description={emptyDescription} /> : children(data)}
  </div>;
}
