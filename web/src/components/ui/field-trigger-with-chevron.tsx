import { FieldTrigger } from '@fohte/ui/field-trigger'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

type FieldTriggerWithChevronProps = Omit<
  ComponentProps<typeof FieldTrigger>,
  'children' | 'className'
> & {
  children: ReactNode
}

export function FieldTriggerWithChevron({
  children,
  ...props
}: FieldTriggerWithChevronProps) {
  return (
    <FieldTrigger className="w-full min-w-0" {...props}>
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDown aria-hidden="true" />
    </FieldTrigger>
  )
}
