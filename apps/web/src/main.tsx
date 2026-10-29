import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, ErrorState, ThemeSelect, defineFeatures, type DeviceProfile, type FeatureEntry } from '@ruple/presentation';
import { AppProviders } from './providers';
import { createConfiguredClients } from './lib/api';
import './style.css';

async function start() {
  const track = import.meta.env.VITE_DEV_TRACK ?? 'all';
  if (!['a', 'b', 'all'].includes(track)) throw new Error('VITE_DEV_TRACK must be a, b, or all');
  const device = import.meta.env.VITE_DEVICE_PROFILE ?? 'phone';
  if (!['phone', 'car'].includes(device)) throw new Error('VITE_DEVICE_PROFILE must be phone or car');
  const features: FeatureEntry[] = [];
  if (track !== 'b') features.push((await import('@ruple/context-ui')).contextFeature);
  if (track !== 'a') {
    features.push((await import('@ruple/automation-ui')).automationFeature);
    features.push((await import('@ruple/interaction-ui')).interactionFeature);
  }
  if (import.meta.env.DEV && import.meta.env.VITE_UI_PREVIEW === 'true') {
    features.push((await import('./dev/ui-preview')).uiPreviewFeature);
  }
  defineFeatures(features);
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element is missing');
  const clients = createConfiguredClients();
  createRoot(root).render(<StrictMode><AppProviders clients={clients} device={device as DeviceProfile} cacheScope={`anonymous:${track}`}>
    <AppShell features={features} brandMark={`${import.meta.env.BASE_URL}ruple-symbol.png`} toolbar={<ThemeSelect />} />
  </AppProviders></StrictMode>);
}

void start().catch(() => {
  const root = document.getElementById('root');
  if (root) createRoot(root).render(<div className="mx-auto max-w-xl p-6"><ErrorState title="화면을 불러오지 못했어요" onRetry={() => window.location.reload()} /></div>);
});
