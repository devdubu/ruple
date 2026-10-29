// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppShell, AsyncContent, Button, DeviceProvider, Dialog, DialogContent,
  DialogDescription, DialogTitle, DialogTrigger, InputField, defineFeatures, validateFeatureMetadata,
} from './index';

afterEach(cleanup);
beforeEach(() => window.history.replaceState({}, '', '/'));

describe('accessible common components', () => {
  it('associates labels, help and validation errors with inputs', () => {
    render(<InputField label="이름" hint="입력 도움말" error="이름을 입력해주세요" required />);
    const input = screen.getByRole('textbox', { name: '이름' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('입력 도움말 이름을 입력해주세요');
  });

  it('does not submit forms by default or invoke pending actions', async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: FormEvent) => event.preventDefault());
    const action = vi.fn();
    render(<form onSubmit={submit}><Button>기본 동작</Button><Button pending onClick={action}>처리 중</Button></form>);
    await user.click(screen.getByRole('button', { name: '기본 동작' }));
    await user.click(screen.getByRole('button', { name: '처리 중' }));
    expect(submit).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '처리 중' })).toHaveAttribute('aria-busy', 'true');
  });

  it('names dialogs, applies the device profile to portals and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<DeviceProvider device="car"><Dialog><DialogTrigger asChild><Button>열기</Button></DialogTrigger>
      <DialogContent><DialogTitle>내용 확인</DialogTitle><DialogDescription>입력을 확인합니다.</DialogDescription><InputField label="메모" /></DialogContent>
    </Dialog></DeviceProvider>);
    const trigger = screen.getByRole('button', { name: '열기' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '내용 확인' });
    expect(dialog).toHaveAttribute('data-device', 'car');
    expect(screen.getByRole('textbox', { name: '메모' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('keeps existing data visible when background refresh fails', () => {
    render(<AsyncContent data={['이전 내용']} isPending={false} isError onRetry={() => {}}>
      {(data) => <p>{data.join(', ')}</p>}
    </AsyncContent>);
    expect(screen.getByText('이전 내용')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('최신 정보를 확인하지 못했어요');
  });

  it('distinguishes loading, offline and confirmed empty data', () => {
    const { rerender } = render(<AsyncContent data={undefined} isPending isError={false}>{() => null}</AsyncContent>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    rerender(<AsyncContent data={undefined} isPending isError={false} fetchStatus="paused">{() => null}</AsyncContent>);
    expect(screen.getByRole('alert')).toHaveTextContent('연결을 확인해주세요');
    rerender(<AsyncContent data={[]} isPending={false} isError={false} isEmpty={(data) => !data.length}>{() => null}</AsyncContent>);
    expect(screen.getByRole('status')).toHaveTextContent('아직 표시할 내용이 없어요');
  });
});

describe('feature registry and routing', () => {
  const fixtures = JSON.parse(readFileSync('contracts/presentation/feature-v1.examples.json', 'utf8'));
  const features = [
    { id: 'first', path: '/first', label: '첫 화면', Component: () => <h1>첫 화면 내용</h1> },
    { id: 'second', path: '/second', label: '다음 화면', Component: () => <h1>다음 화면 내용</h1> },
  ];
  it('accepts and rejects canonical metadata examples and prevents duplicate routes', () => {
    for (const example of fixtures.valid) expect(validateFeatureMetadata(example.value)).toBe(true);
    for (const example of fixtures.invalid) expect(validateFeatureMetadata(example.value)).toBe(false);
    expect(() => defineFeatures([features[0], { ...features[1], path: '/first' }])).toThrow('duplicate');
    expect(() => defineFeatures([features[0], { ...features[1], id: 'first' }])).toThrow('duplicate');
  });
  it('loads deep links, focuses the main region on navigation and handles unknown routes', async () => {
    window.location.hash = '/second';
    render(<AppShell features={features} />);
    expect(screen.getByRole('heading', { name: '다음 화면 내용' })).toBeVisible();
    window.location.hash = '/first';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.getByRole('heading', { name: '첫 화면 내용' })).toBeVisible());
    expect(screen.getByRole('main')).toHaveFocus();
    window.location.hash = '/unknown';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('화면을 찾을 수 없어요'));
  });
});
