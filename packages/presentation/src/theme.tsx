import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
const query = '(prefers-color-scheme: dark)';
function subscribe(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
function systemIsDark() { return typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches); }
const ThemeContext = createContext<{ mode: ThemeMode; resolved: ResolvedTheme; setMode(mode: ThemeMode): void } | undefined>(undefined);

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required');
  return theme;
}
export function ThemeProvider({ defaultMode = 'system', children }: { defaultMode?: ThemeMode; children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const dark = useSyncExternalStore(subscribe, systemIsDark, () => false);
  const resolved = mode === 'system' ? (dark ? 'dark' : 'light') : mode;
  return <ThemeContext value={{ mode, resolved, setMode }}>
    <div data-theme={resolved} data-theme-mode={mode} className="min-h-dvh bg-background text-foreground">{children}</div>
  </ThemeContext>;
}
export function ThemeSelect() {
  const { mode, setMode } = useTheme();
  return <label className="flex items-center gap-3 text-sm text-muted-foreground">
    <span>화면 테마</span>
    <select aria-label="화면 테마" value={mode} onChange={(event) => {
      const value = event.target.value;
      if (value === 'system' || value === 'light' || value === 'dark') setMode(value);
    }} className="min-h-[var(--control-height-sm)] max-w-full rounded-md border border-input bg-card px-3 text-base text-foreground">
      <option value="system">자동</option><option value="light">주간</option><option value="dark">야간</option>
    </select>
  </label>;
}
