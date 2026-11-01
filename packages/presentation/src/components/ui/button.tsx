import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const variants = cva(
  'inline-flex shrink-0 items-center justify-center gap-3 px-5 py-2 font-semibold leading-snug transition-colors disabled:pointer-events-none motion-reduce:transition-none',
  { variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed disabled:bg-disabled disabled:text-disabled-foreground',
      secondary: 'bg-secondary text-foreground hover:bg-secondary-hover active:bg-secondary-pressed disabled:bg-disabled disabled:text-disabled-foreground',
      ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary-pressed disabled:text-disabled-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:brightness-95 active:brightness-90 disabled:bg-disabled disabled:text-disabled-foreground',
    },
    size: {
      sm: 'min-h-[var(--control-height-sm)] rounded-[var(--control-radius-sm)] px-4 text-[length:var(--button-font-size-sm)]',
      default: 'min-h-[var(--control-height)] rounded-[var(--control-radius)] text-[length:var(--button-font-size)]',
      lg: 'min-h-[var(--control-height-lg)] rounded-[var(--control-radius-lg)] px-7 text-[length:var(--button-font-size-lg)]',
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
