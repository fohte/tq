import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { cn } from '#lib/utils'

// Row indent is a per-instance value (tag depth is unbounded), so it can't
// be a static Tailwind class — same technique as task-row-shared's
// rowIndentStyle, but based on the sidebar row's own px-3.5 base offset.
// Applied unconditionally (including depth 0) so it never diverges from the
// plain px-3.5 padding-left it replaces.
const SIDEBAR_ROW_INDENT_CLASS_NAME = 'pl-(--sidebar-row-indent)'

interface SidebarRowIndentStyle extends React.CSSProperties {
  '--sidebar-row-indent': string
}

function sidebarRowIndentStyle(depth: number): SidebarRowIndentStyle {
  return {
    '--sidebar-row-indent': `calc(var(--spacing) * ${String(3.5 + depth * 4)})`,
  }
}

// Shared row shape for TagLink/ViewLink — both are a full-width link into
// /tasks scoped by a search query, differing only in their prefix/suffix.
export function SidebarRowLink({
  search,
  isActive,
  depth = 0,
  children,
}: {
  search: { q: string }
  isActive: boolean
  depth?: number
  children: ReactNode
}) {
  return (
    <Link
      to="/tasks"
      search={search}
      className={cn(
        'group flex w-full items-center gap-2 px-3.5 py-1 text-left font-mono text-2xs',
        isActive
          ? 'bg-card text-foreground'
          : 'text-muted-foreground-strong hover:bg-card hover:text-foreground',
        SIDEBAR_ROW_INDENT_CLASS_NAME,
      )}
      style={sidebarRowIndentStyle(depth)}
    >
      {children}
    </Link>
  )
}

export function SidebarActionableRow({
  search,
  isActive,
  depth = 0,
  children,
  actionsAriaLabel,
  editItemLabel,
  onEdit,
  deleteTitle,
  deleteDescription,
  onDelete,
}: {
  search: { q: string }
  isActive: boolean
  depth?: number
  children: ReactNode
  actionsAriaLabel: string
  editItemLabel: string
  onEdit: () => void
  deleteTitle: string
  deleteDescription: string
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <SidebarRowLink search={search} isActive={isActive} depth={depth}>
        {children}
        <ActionsMenu
          aria-label={actionsAriaLabel}
          desktopTriggerClassName="h-3.5 w-3.5"
          mobileTriggerClassName="h-4 w-4"
          items={[
            {
              icon: <Pencil className="h-4 w-4" />,
              label: editItemLabel,
              onClick: onEdit,
            },
            {
              icon: <Trash2 className="h-4 w-4" />,
              label: 'delete…',
              onClick: () => {
                setDeleteOpen(true)
              },
              destructive: true,
            },
          ]}
        />
      </SidebarRowLink>
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTitle}
        description={deleteDescription}
        onDelete={onDelete}
      />
    </>
  )
}
