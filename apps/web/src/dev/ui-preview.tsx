import { useState } from 'react';
import {
  AsyncContent, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  DeviceProvider, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogTitle, DialogTrigger, EmptyState, ErrorState, InputField, LoadingState, PageHeading,
  type DeviceProfile, type FeatureEntry,
} from '@ruple/presentation';

function UiPreview() {
  const [device, setDevice] = useState<DeviceProfile>('phone');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState('');
  const [retries, setRetries] = useState(0);
  return <div className="grid gap-8">
    <PageHeading eyebrow="개발용 미리보기" title="공통 UI 미리보기"
      description="실제 저장이나 차량 실행 없이 공통 요소와 화면 상태를 확인합니다." />
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div><p className="font-medium">화면 프로필</p><p className="text-sm text-muted-foreground">같은 구성에 글자와 터치 크기를 적용합니다.</p></div>
      <div role="group" aria-label="화면 프로필" className="flex gap-2">
        <Button variant={device === 'phone' ? 'primary' : 'secondary'} aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>스마트폰</Button>
        <Button variant={device === 'car' ? 'primary' : 'secondary'} aria-pressed={device === 'car'} onClick={() => setDevice('car')}>차량</Button>
      </div>
    </div>
    <DeviceProvider device={device}>
      <div data-testid="ui-samples" className="grid min-w-0 gap-6">
        <Card>
          <CardHeader><CardTitle>동작과 상태</CardTitle><CardDescription>주요 동작·보조 동작·비활성 상태를 구분합니다.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3"><Button>기본 버튼</Button><Button variant="secondary">보조 버튼</Button><Button variant="ghost">간단한 버튼</Button></div>
            <div className="flex flex-wrap gap-3"><Button disabled>사용 불가</Button><Button pending>처리 중</Button><Button variant="destructive">주의 버튼</Button></div>
            <div className="flex flex-wrap gap-2"><Badge>대기</Badge><Badge tone="positive">확인</Badge><Badge tone="warning">주의</Badge><Badge tone="danger">확인 필요</Badge></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>입력과 확인</CardTitle><CardDescription>레이블·도움말·오류와 키보드 포커스를 함께 확인합니다.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid max-w-xl gap-4" noValidate onSubmit={(event) => {
              event.preventDefault();
              setError(name.trim() ? undefined : '이름을 입력해주세요.');
              setResult(name.trim() ? '입력 형식을 확인했어요.' : '');
            }}>
              <InputField label="미리보기 이름" hint="서버에 저장되지 않는 입력 예시입니다." error={error} value={name}
                required onChange={(event) => { setName(event.target.value); setResult(''); }} />
              <div><Button type="submit">입력 확인</Button></div>
              {result && <p role="status" className="text-sm text-success">{result}</p>}
            </form>
            <div className="border-t pt-5">
              <Dialog><DialogTrigger asChild><Button variant="secondary">대화상자 열기</Button></DialogTrigger>
                <DialogContent>
                  <DialogTitle>입력 내용 확인</DialogTitle>
                  <DialogDescription>이 미리보기는 서버에 저장하지 않습니다.</DialogDescription>
                  <InputField label="메모" placeholder="내용을 입력하세요" />
                  <DialogFooter><DialogClose asChild><Button variant="secondary">취소</Button></DialogClose>
                    <DialogClose asChild><Button>확인</Button></DialogClose></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3"><h2 className="text-xl font-semibold">데이터 상태</h2>
          <p className="text-sm text-muted-foreground">아래 상태는 컴포넌트 확인을 위한 예시입니다.</p></div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <LoadingState /><EmptyState description="내용이 생기면 이곳에 표시합니다." />
          <ErrorState requestId="preview-request" onRetry={() => setRetries((count) => count + 1)} />
          <AsyncContent data={undefined} isPending isError={false} fetchStatus="paused">{() => null}</AsyncContent>
        </div>
        <AsyncContent data={['샘플 항목']} isPending={false} isError onRetry={() => setRetries((count) => count + 1)}>
          {(items) => <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">이전에 불러온 내용</p><p>{items.join(', ')}</p></CardContent></Card>}
        </AsyncContent>
        <p role="status" className="text-sm text-muted-foreground">다시 시도 선택: {retries}회</p>
      </div>
    </DeviceProvider>
  </div>;
}

export const uiPreviewFeature: FeatureEntry = { id: 'ui-preview', path: '/ui-preview', label: 'UI 미리보기', Component: UiPreview };
