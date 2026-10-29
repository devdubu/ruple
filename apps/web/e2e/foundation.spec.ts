import { expect, test } from '@playwright/test';

test('feature routes support deep links, back navigation and keyboard skip links', async ({ page }) => {
  await page.goto('/#/context');
  await expect(page.getByRole('heading', { name: '근거와 제안', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '루틴 관리', exact: true }).click();
  await expect(page.getByRole('heading', { name: '루틴 관리', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '실행과 알림', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/#\/routines$/);
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto('/#/context');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문으로 건너뛰기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL(/#\/context$/);
});

test('phone preview remains usable at a narrow width and validates input', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/#/ui-preview');
  await expect(page.getByRole('heading', { name: '공통 UI 미리보기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: '입력 확인', exact: true }).click();
  const input = page.getByRole('textbox', { name: '미리보기 이름' });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAccessibleDescription(/이름을 입력해주세요/);
  await input.fill('입력 예시');
  await page.getByRole('button', { name: '입력 확인', exact: true }).click();
  await expect(page.getByText('입력 형식을 확인했어요.')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'local-artifacts/frontend/phone.png' });
});

test('car profile enlarges controls including dialog portals and traps keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/ui-preview');
  await page.getByRole('button', { name: '차량', exact: true }).click();
  const button = page.getByRole('button', { name: '기본 버튼', exact: true });
  await expect(button).toHaveCSS('font-size', '24px');
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(80);
  const trigger = page.getByRole('button', { name: '대화상자 열기' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '입력 내용 확인' });
  await expect(dialog).toHaveAttribute('data-device', 'car');
  await expect(dialog.getByRole('textbox', { name: '메모' })).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  expect((await dialog.getByRole('button', { name: '닫기', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await page.screenshot({ path: 'local-artifacts/frontend/car-dialog.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'local-artifacts/frontend/car.png' });
});

test('Pleos day/night themes follow the system, allow override, and reach dialog portals', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/ui-preview');
  const theme = page.getByLabel('화면 테마');
  const host = page.locator('[data-theme-mode]');
  await expect(theme).toHaveValue('system');
  await expect(host).toHaveAttribute('data-theme', 'dark');
  for (const mode of ['light', 'dark']) {
    await theme.selectOption(mode);
    await expect(host).toHaveAttribute('data-theme', mode);
    const pairs = await page.getByTestId('ui-samples').evaluate((element) => {
      const names = [['foreground', 'background'], ['muted-foreground', 'card'], ['primary-foreground', 'primary'],
        ['success', 'success-surface'], ['destructive', 'danger-surface'], ['warning', 'warning-surface']];
      const swatch = document.createElement('span'); element.append(swatch);
      function luminance(token: string) {
        swatch.style.color = `var(--${token})`;
        const channels = getComputedStyle(swatch).color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
          const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      }
      const result = names.map(([foreground, background]) => {
        const a = luminance(foreground); const b = luminance(background);
        return { foreground, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      swatch.remove(); return result;
    });
    for (const pair of pairs) expect(pair.ratio, `${mode}: ${pair.foreground}/${pair.background}`).toBeGreaterThanOrEqual(4.5);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(host).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '차량', exact: true }).click();
  await page.getByRole('button', { name: '대화상자 열기' }).click();
  const dialog = page.getByRole('dialog', { name: '입력 내용 확인' });
  await expect(dialog).toHaveAttribute('data-theme', 'dark');
  await expect(dialog).toHaveCSS('background-color', 'rgb(19, 20, 23)');
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toHaveCSS('font-size', '24px');
  await page.screenshot({ path: 'local-artifacts/frontend/pleos-night-dialog.png' });
  await page.keyboard.press('Escape');
  await theme.selectOption('system');
  await expect(host).toHaveAttribute('data-theme', 'light');
});

test('car components fit a narrow app window and keep loading actions unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto('/#/ui-preview');
  await page.getByLabel('화면 테마').selectOption('dark');
  await page.getByRole('button', { name: '차량', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
  await expect(page.getByRole('button', { name: '처리 중', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '처리 중', exact: true })).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: '대화상자 열기' }).click();
  const dialog = page.getByRole('dialog');
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(400);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'local-artifacts/frontend/pleos-narrow-car.png' });
});

test('production serves Korean Asta Sans locally with its license and no font CDN', async ({ page }) => {
  const fontUrls: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'font') fontUrls.push(request.url()); });
  await page.goto('http://127.0.0.1:4173/#/context');
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 20px "Asta Sans Variable"', '루플레 한글 Aa');
    return faces.length > 0 && faces.every((face) => face.status === 'loaded');
  });
  expect(loaded).toBe(true);
  expect(fontUrls.length).toBeGreaterThan(0);
  expect(fontUrls.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  const license = await page.request.get('http://127.0.0.1:4173/licenses/asta-sans-OFL.txt');
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
});

test('browser API client handles the registered error contract without leaking messages', async ({ page }) => {
  await page.route('**/services/context/api/v1/runtime/context', async (route) => {
    const id = route.request().headers()['x-request-id'];
    expect(id).toBeTruthy();
    expect(route.request().headers()['x-user-id']).toBeUndefined();
    await route.fulfill({ status: 401, contentType: 'application/json', headers: { 'x-request-id': id },
      body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'private-provider-detail', requestId: id } }) });
  });
  await page.goto('/#/context');
  const result = await page.evaluate(async (modulePath) => {
    const { createConfiguredClients } = await import(modulePath);
    const api = createConfiguredClients();
    try { await api.context.get('/api/v1/runtime/context', (value: unknown) => value); }
    catch (error) {
      if (error instanceof Error && 'code' in error && 'requestId' in error) {
        return { message: error.message, code: error.code, requestId: error.requestId };
      }
    }
    return null;
  }, '/src/lib/api.ts');
  expect(result).toMatchObject({ message: '로그인이 필요해요.', code: 'UNAUTHENTICATED' });
  expect(result?.requestId).toBeTruthy();
});

test('production contains no developer gallery or gallery navigation', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/#/ui-preview');
  await expect(page.getByRole('link', { name: 'UI 미리보기' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '공통 UI 미리보기' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('화면을 찾을 수 없어요');
});
