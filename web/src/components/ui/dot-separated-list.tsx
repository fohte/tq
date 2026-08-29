import { Fragment } from 'react'

export function DotSeparatedList({ items }: { items: React.ReactNode[] }) {
  const visibleItems = items.filter((item) => item != null)

  return (
    <>
      {visibleItems.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="text-muted-foreground-faint" aria-hidden="true">
              ·
            </span>
          )}
          {item}
        </Fragment>
      ))}
    </>
  )
}
