import { useId, type ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cn(
    'min-h-[var(--control-height)] w-full min-w-0 rounded-[var(--control-radius)] border border-input bg-card px-4 py-2 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive',
    className,
  )} />;
}

export type InputFieldProps = ComponentProps<'input'> & { label: string; hint?: string; error?: string };
export function InputField({ label, hint, error, id, 'aria-describedby': describedBy, ...props }: InputFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptions = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ');
  return <div className="grid min-w-0 gap-2">
    <label htmlFor={fieldId} className="text-sm font-medium">{label}{props.required && <span aria-hidden="true"> *</span>}</label>
    <Input {...props} id={fieldId} aria-invalid={Boolean(error) || props['aria-invalid']}
      aria-describedby={descriptions || undefined} />
    {hint && <p id={`${fieldId}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
