import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'
import { CheckIcon, X } from 'lucide-react'
import { useState } from 'react'

import { ContextFilterInline } from '#components/context-filter'
import { TaskFilterQueryInput } from '#components/task/task-filter-query-input'
import {
  BottomSheetHeader,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { Chip } from '#components/ui/chip'
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTrigger,
} from '#components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { SectionLabel } from '#components/ui/section-label'
import { TabStrip } from '#components/ui/tab-strip'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortOptionValues } from '#lib/tasks-query'
import { cn } from '#lib/utils'

const sortLabels: Partial<Record<NonNullable<ParsedQuery['sortBy']>, string>> =
  {
    updated: 'Updated',
    created: 'Created',
  }

const filterTriggerClassName =
  'shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground'

interface TaskFilterChipRowProps {
  query: string
  onQueryChange: (query: string) => void
  parsed: ParsedQuery
  onShowCompletedChange: (checked: boolean) => void
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  onProjectIdChange: (id: string) => void
  onTagChange: (tag: string | undefined) => void
}

function ProjectOptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 border-t border-border px-1 text-left text-sm first:border-t-0',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
      {active && <CheckIcon className="size-4" />}
    </button>
  )
}

export function TaskFilterChipRow({
  query,
  onQueryChange,
  parsed,
  onShowCompletedChange,
  onSortByChange,
  projects,
  onProjectIdChange,
  onTagChange,
}: TaskFilterChipRowProps) {
  const showCompleted = parsed.status == null
  // The chip label falls back to the raw value for a sort the picker below
  // doesn't offer (e.g. a hand-edited `sort:due` in the URL), but the picker
  // controls themselves only ever offer sortOptionValues, so they take a
  // narrowed value instead.
  const sortBy = parsed.sortBy ?? 'updated'
  const pickerSortBy =
    sortOptionValues.find((value) => value === sortBy) ?? 'updated'
  const tag = parsed.label
  const selectedProject = projects.find(
    (project) => project.id === parsed.projectId,
  )
  const freeTextWords =
    parsed.freeText !== ''
      ? parsed.freeText.split(/\s+/).filter((w) => w !== '')
      : []
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <TaskFilterQueryInput
          query={query}
          onCommit={(newQuery) => {
            onQueryChange(newQuery)
            setIsEditing(false)
          }}
          onCancel={() => {
            setIsEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
      {!showCompleted && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onShowCompletedChange(true)
          }}
        >
          not completed ×
        </Chip>
      )}
      <Chip active className="shrink-0">
        sort: {sortLabels[sortBy] ?? sortBy}
      </Chip>
      {selectedProject != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onProjectIdChange('')
          }}
        >
          project: {selectedProject.title} ×
        </Chip>
      )}
      {tag != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onTagChange(undefined)
          }}
        >
          #{tag} ×
        </Chip>
      )}
      {parsed.hasPages === true && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            // exactOptionalPropertyTypes forbids `{ ...parsed, hasPages:
            // undefined }` (hasPages's type is `boolean`, not `boolean |
            // undefined`) — delete is the sanctioned way to unset an
            // optional property under that flag.
            const next = { ...parsed }
            delete next.hasPages
            onQueryChange(buildSearchQuery(next))
          }}
        >
          has:pages ×
        </Chip>
      )}
      {parsed.parentId != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            const next = { ...parsed }
            delete next.parentId
            onQueryChange(buildSearchQuery(next))
          }}
        >
          parent:{parsed.parentId} ×
        </Chip>
      )}
      {freeTextWords.map((word, index) => (
        <Chip
          key={`${word}-${String(index)}`}
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            const remaining = freeTextWords.filter((_, i) => i !== index)
            onQueryChange(
              buildSearchQuery({ ...parsed, freeText: remaining.join(' ') }),
            )
          }}
        >
          {word} ×
        </Chip>
      ))}

      {/* PC: click to edit the query directly */}
      <button
        type="button"
        onClick={() => {
          setIsEditing(true)
        }}
        className={cn('hidden md:inline-flex', filterTriggerClassName)}
      >
        <span aria-hidden="true">&gt;</span>
        <span className="sr-only">Edit filter query</span>
      </button>

      {/* PC: dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn('hidden md:inline-flex', filterTriggerClassName)}
        >
          + filter
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuCheckboxItem
            checked={showCompleted}
            onCheckedChange={onShowCompletedChange}
          >
            show completed
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup
            value={pickerSortBy}
            onValueChange={onSortByChange}
          >
            {sortOptionValues.map((sort) => (
              <DropdownMenuRadioItem key={sort} value={sort}>
                Sort: {sortLabels[sort] ?? sort}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {projects.length > 0 && (
            <DropdownMenuRadioGroup
              value={parsed.projectId ?? ''}
              onValueChange={onProjectIdChange}
            >
              <DropdownMenuRadioItem value="">
                All projects
              </DropdownMenuRadioItem>
              {projects.map((project) => (
                <DropdownMenuRadioItem key={project.id} value={project.id}>
                  {project.title}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* SP: bottom sheet */}
      <Dialog>
        <DialogTrigger
          className={cn('inline-flex md:hidden', filterTriggerClassName)}
        >
          + filter
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay />
          <DialogPopup>
            <div className="fixed inset-0 z-50 flex items-end">
              <BottomSheetPanel>
                <BottomSheetHeader>
                  <span className="text-base font-semibold text-foreground">
                    Filter
                  </span>
                  <DialogClose
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <X className="size-5" />
                    <span className="sr-only">Close</span>
                  </DialogClose>
                </BottomSheetHeader>

                <div className="flex flex-col gap-5 px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="task-filter-show-completed"
                      checked={showCompleted}
                      onCheckedChange={onShowCompletedChange}
                    />
                    <label
                      htmlFor="task-filter-show-completed"
                      className="text-sm text-foreground"
                    >
                      show completed
                    </label>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <SectionLabel>SORT</SectionLabel>
                    <TabStrip
                      value={pickerSortBy}
                      options={sortOptionValues.map((sort) => ({
                        value: sort,
                        label: sortLabels[sort] ?? sort,
                      }))}
                      onChange={onSortByChange}
                    />
                  </div>

                  {projects.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <SectionLabel>PROJECT</SectionLabel>
                      <div>
                        <ProjectOptionButton
                          active={
                            parsed.projectId == null || parsed.projectId === ''
                          }
                          onClick={() => {
                            onProjectIdChange('')
                          }}
                        >
                          All projects
                        </ProjectOptionButton>
                        {projects.map((project) => (
                          <ProjectOptionButton
                            key={project.id}
                            active={parsed.projectId === project.id}
                            onClick={() => {
                              onProjectIdChange(project.id)
                            }}
                          >
                            {project.title}
                          </ProjectOptionButton>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <SectionLabel>CONTEXT</SectionLabel>
                    <ContextFilterInline />
                  </div>
                </div>
              </BottomSheetPanel>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
