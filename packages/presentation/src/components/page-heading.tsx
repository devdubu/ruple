export function PageHeading({ title, description, eyebrow }: { title: string; description?: string; eyebrow?: string }) {
  return <div className="grid max-w-3xl gap-3">
    {eyebrow && <p className="text-sm font-medium tracking-wide text-primary">{eyebrow}</p>}
    <h1 className="text-3xl leading-tight font-semibold tracking-tight">{title}</h1>
    {description && <p className="text-base leading-relaxed text-muted-foreground">{description}</p>}
  </div>;
}
