import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '@ruple/presentation';
import { contextFeature } from '@ruple/context-ui';
import { automationFeature } from '@ruple/automation-ui';
import { interactionFeature } from '@ruple/interaction-ui';

describe('standalone track shells', () => {
  it('renders track A without track B features or a server connection', () => {
    const html = renderToStaticMarkup(<AppShell features={[contextFeature]} />);
    expect(html).toContain('근거와 제안');
    expect(html).not.toContain('루틴 관리');
  });
  it('renders track B without track A features or a server connection', () => {
    const html = renderToStaticMarkup(<AppShell features={[automationFeature, interactionFeature]} />);
    expect(html).toContain('루틴 관리');
    expect(html).toContain('실행과 알림');
    expect(html).not.toContain('근거와 제안');
  });
});
