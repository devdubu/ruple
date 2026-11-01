import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const tones = {
  neutral: 'bg-muted text-muted-foreground',
  positive: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-danger-surface text-destructive',
};
export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: keyof typeof tones }) {
  return <span {...props} className={cn('inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium', tones[tone], className)} />;
}
