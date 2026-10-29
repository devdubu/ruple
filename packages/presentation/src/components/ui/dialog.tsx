import * as Primitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import { useDeviceProfile } from '../../device';
import { useTheme } from '../../theme';
import { cn } from '../../lib/utils';
import { Button } from './button';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  const device = useDeviceProfile();
  const { resolved: theme } = useTheme();
  return <Primitive.Portal>
    <Primitive.Overlay data-device={device} data-theme={theme} className="fixed inset-0 z-40 bg-overlay" />
    <Primitive.Content {...props} data-device={device} data-theme={theme}
      className={cn('fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[var(--dialog-width)] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl border bg-popup p-[var(--dialog-space)] text-foreground shadow-xl', className)}>
      {children}
      <Primitive.Close asChild><Button variant="ghost" size="sm" className="absolute top-3 right-3 min-w-[var(--control-height-sm)] px-2" aria-label="닫기">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </Button></Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>;
}
export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title {...props} className={cn('pr-[calc(var(--control-height-sm)+1rem)] text-xl font-semibold', className)} />;
}
export function DialogDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description {...props} className={cn('text-base leading-relaxed text-muted-foreground', className)} />;
}
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('flex flex-wrap justify-end gap-3 pt-2', className)} />;
}
