import { PageHeading, type FeatureEntry } from '@ruple/presentation';

function InteractionPage() {
  return <PageHeading title="실행과 알림" description="이동에 필요한 안내와 진행 상황을 확인하세요." />;
}

export const interactionFeature: FeatureEntry = {
  id: 'interaction',
  path: '/activity',
  label: '실행과 알림',
  Component: InteractionPage,
};
