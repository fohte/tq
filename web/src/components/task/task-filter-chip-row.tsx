import { CheckIcon, X } from 'lucide-react'

import { ContextFilterInline } from '#components/context-filter'
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
import { TabStrip } from '#components/ui/tab-strip'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortOptionValues } from '#lib/tasks-query'
import { cn } from '#lib/utils'

const sortLabels: Record<TaskSortBy, string> = {
  updated: 'Updated',
  created: 'Created',
}

const filterTriggerClassName =
  'shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground'

interface TaskFilterChipRowProps {
  showCompleted: boolean
  onShowCompletedChange: (checked: boolean) => void
  sortBy: TaskSortBy
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  projectId: string | undefined
  onProjectIdChange: (id: string) => void
  tag: string | undefined
  onTagChange: (tag: string | undefined) => void
}

function FilterSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
      {children}
    </span>
  )
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
  showCompleted,
  onShowCompletedChange,
  sortBy,
  onSortByChange,
  projects,
  projectId,
  onProjectIdChange,
  tag,
  onTagChange,
}: TaskFilterChipRowProps) {
  const selectedProject = projects.find((project) => project.id === projectId)

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
        sort: {sortLabels[sortBy]}
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
          <DropdownMenuRadioGroup value={sortBy} onValueChange={onSortByChange}>
            {sortOptionValues.map((sort) => (
              <DropdownMenuRadioItem key={sort} value={sort}>
                Sort: {sortLabels[sort]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {projects.length > 0 && (
            <DropdownMenuRadioGroup
              value={projectId ?? ''}
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
                    <FilterSectionLabel>SORT</FilterSectionLabel>
                    <TabStrip
                      value={sortBy}
                      options={sortOptionValues.map((sort) => ({
                        value: sort,
                        label: sortLabels[sort],
                      }))}
                      onChange={onSortByChange}
                    />
                  </div>

                  {projects.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <FilterSectionLabel>PROJECT</FilterSectionLabel>
                      <div>
                        <ProjectOptionButton
                          active={projectId == null || projectId === ''}
                          onClick={() => {
                            onProjectIdChange('')
                          }}
                        >
                          All projects
                        </ProjectOptionButton>
                        {projects.map((project) => (
                          <ProjectOptionButton
                            key={project.id}
                            active={projectId === project.id}
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
                    <FilterSectionLabel>CONTEXT</FilterSectionLabel>
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
