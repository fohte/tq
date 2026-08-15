export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
      {children}
    </span>
  )
}
