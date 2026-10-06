import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { Layers } from 'lucide-react'
import { useState } from 'react'

import { ExpandableFieldChip } from '#components/ui/modal-field'
import { selectValueHandler } from '#lib/form-utils'

type ContextValue = 'work' | 'personal' | 'dev'
const contextValues = [
  '',
  'work',
  'personal',
  'dev',
] as const satisfies readonly (ContextValue | '')[]
const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
  dev: 'Dev',
}

export function ExpandableContextChipDemo({
  defaultOpen,
}: {
  defaultOpen?: boolean
}) {
  const [context, setContext] = useState<ContextValue | ''>('')

  return (
    <ExpandableFieldChip
      icon={<Layers className="size-3.5" />}
      label={context ? contextLabels[context] : 'Context'}
      active={context !== ''}
      {...(defaultOpen !== undefined && { defaultOpen })}
      expanded={(close) => (
        <Select
          value={context}
          onValueChange={(value) => {
            selectValueHandler(setContext, contextValues)(value)
            close()
          }}
        >
          <SelectTrigger variant="ghost" autoFocus size="sm">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="work">Work</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="dev">Dev</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  )
}
