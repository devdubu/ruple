import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const variants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
  { variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground hover:opacity-90',
      secondary: 'border border-border bg-card text-foreground hover:bg-muted',
      ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
    },
    size: {
      sm: 'min-h-[var(--control-height-sm)] px-3 text-sm',
      default: 'min-h-[var(--control-height)]',
      lg: 'min-h-[var(--control-height-lg)] px-6',
    },
  }, defaultVariants: { variant: 'primary', size: 'default' } },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof variants> & { pending?: boolean };
export function Button({ className, variant, size, pending = false, disabled, children, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || pending} aria-busy={pending || undefined}
    className={cn(variants({ variant, size }), className)}>
    {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />}
    {children}
  </button>;
}
