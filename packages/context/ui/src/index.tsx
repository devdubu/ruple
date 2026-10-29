import { PageHeading, type FeatureEntry } from '@ruple/presentation';

function ContextPage() {
  return <PageHeading title="근거와 제안" description="이동 기록과 등록 장소를 바탕으로 나에게 맞는 루틴을 살펴보세요." />;
}

export const contextFeature: FeatureEntry = {
  id: 'context',
  path: '/context',
  label: '근거와 제안',
  Component: ContextPage,
};
