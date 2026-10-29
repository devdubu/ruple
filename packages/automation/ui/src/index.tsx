import { PageHeading, type FeatureEntry } from '@ruple/presentation';

function AutomationPage() {
  return <PageHeading title="루틴 관리" description="내가 승인한 루틴과 이동 계획을 한곳에서 관리하세요." />;
}

export const automationFeature: FeatureEntry = {
  id: 'automation',
  path: '/routines',
  label: '루틴 관리',
  Component: AutomationPage,
};
