import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('min-w-0 rounded-xl border bg-card text-card-foreground', className)} />;
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid gap-2 p-6', className)} />;
}
export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 {...props} className={cn('text-lg font-semibold tracking-tight', className)} />;
}
export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={cn('text-sm leading-relaxed text-muted-foreground', className)} />;
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid gap-4 px-6 pb-6', className)} />;
}
