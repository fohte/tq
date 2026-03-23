import { Link } from '@tanstack/react-router'
import { useLiveTimer } from '@web/hooks/use-live-timer'
import type { Task, TreeNode } from '@web/hooks/use-tasks'
import { useTaskActions } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  CircleDot,
  Play,
  Square,
  Timer,
} from 'lucide-react'
import { useState } from 'react'

function StatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'completed') {
    return (
      <CircleCheckBig className="h-[18px] w-[18px] text-muted-foreground" />
    )
  }
  if (status === 'in_progress') {
    return <CircleDot className="h-[18px] w-[18px] text-primary" />
  }
  return <Square className="h-[18px] w-[18px] text-muted-foreground" />
}

function ActionArea({
  status,
  onStart,
  onStop,
  onComplete,
}: {
  status: Task['status']
  onStart: () => void
  onStop: () => void
  onComplete: () => void
}) {
  if (status === 'completed') return null

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {status === 'in_progress' ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onStop()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-80"
          aria-label="Stop task"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onStart()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-80"
          aria-label="Start task"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>
      )}

      {status === 'in_progress' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onComplete()
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E2E2E] text-white transition-opacity hover:opacity-80"
          aria-label="Complete task"
        >
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function LiveTimer({
  startTime,
  estimatedMinutes,
}: {
  startTime: string | null | undefined
  estimatedMinutes: number | null | undefined
}) {
  const { formatted, isOverEstimate } = useLiveTimer(
    startTime,
    estimatedMinutes,
  )

  return (
    <div className="flex items-center gap-1" data-testid="live-timer">
      <Timer
        className={cn(
          'h-3 w-3',
          isOverEstimate ? 'text-destructive' : 'text-primary',
        )}
      />
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          isOverEstimate ? 'text-destructive' : 'text-primary',
        )}
      >
        {formatted}
      </span>
      {estimatedMinutes != null && (
        <>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            est: {formatMinutes(estimatedMinutes)}
          </span>
        </>
      )}
    </div>
  )
}

function ContextBadge({ context }: { context: Task['context'] }) {
  if (context === 'personal') return null

  return (
    <span
      className={cn(
        'rounded-[10px] px-2 py-0.5 text-[11px] font-medium',
        context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
        context === 'dev' && 'bg-[#1A2040] text-[#B2B2FF]',
      )}
    >
      {context}
    </span>
  )
}

interface TaskRowBaseProps {
  id: string
  title: string
  status: Task['status']
  context: Task['context']
  estimatedMinutes: number | null
  parentId: string | null
  activeTimeBlockStartTime: string | null
  updatedAt: string
}

function TaskRowContent({
  id,
  title,
  status,
  context,
  estimatedMinutes,
  parentId,
  activeTimeBlockStartTime,
  updatedAt,
}: TaskRowBaseProps) {
  const { handleStatusAction, handleComplete } = useTaskActions(id, status)
  const isInProgress = status === 'in_progress'
  const isCompleted = status === 'completed'

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        isInProgress &&
          'border-l-[3px] border-b border-b-primary border-l-primary bg-[#2D1F0F]',
        !isInProgress && 'border-b border-b-border',
        isCompleted && 'opacity-50',
      )}
    >
      <StatusIcon status={status} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* TopRow */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={cn(
              'truncate text-sm',
              isInProgress && 'font-semibold',
              isCompleted && 'font-normal text-muted-foreground',
              !isInProgress && !isCompleted && 'font-medium',
            )}
          >
            {title}
          </span>
          {parentId && (
            <span className="shrink-0 text-xs text-muted-foreground">
              ← #{parentId.slice(0, 4)}
            </span>
          )}
        </div>

        {/* TimerRow - only for in_progress */}
        {isInProgress && (
          <LiveTimer
            startTime={activeTimeBlockStartTime ?? updatedAt}
            estimatedMinutes={estimatedMinutes}
          />
        )}

        {/* BottomRow */}
        <div className="flex items-center gap-1.5">
          <ContextBadge context={context} />
          {estimatedMinutes != null && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatMinutes(estimatedMinutes)}
            </span>
          )}
        </div>
      </div>

      <ActionArea
        status={status}
        onStart={handleStatusAction}
        onStop={handleStatusAction}
        onComplete={handleComplete}
      />
    </div>
  )
}

export function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="block transition-colors hover:bg-secondary/30"
    >
      <TaskRowContent
        id={task.id}
        title={task.title}
        status={task.status}
        context={task.context}
        estimatedMinutes={task.estimatedMinutes}
        parentId={task.parentId}
        activeTimeBlockStartTime={task.activeTimeBlockStartTime}
        updatedAt={task.updatedAt}
      />
    </Link>
  )
}

export function TreeTaskRow({
  node,
  depth = 0,
  defaultExpanded = true,
}: {
  node: TreeNode
  depth?: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { handleStatusAction, handleComplete } = useTaskActions(
    node.id,
    node.status,
  )
  const hasChildren = node.children.length > 0
  const isInProgress = node.status === 'in_progress'
  const isCompleted = node.status === 'completed'

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <>
      <Link
        to="/tasks/$taskId"
        params={{ taskId: node.id }}
        className="block transition-colors hover:bg-secondary/30"
      >
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2',
            isInProgress &&
              'border-l-[3px] border-b border-b-primary border-l-primary bg-[#2D1F0F]',
            !isInProgress && 'border-b border-b-border',
            isCompleted && 'opacity-50',
          )}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={handleExpand}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          <StatusIcon status={node.status} />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* TopRow */}
            <div className="flex items-center gap-2 overflow-hidden">
              <span
                className={cn(
                  'truncate text-sm',
                  isInProgress && 'font-semibold',
                  isCompleted && 'font-normal text-muted-foreground',
                  !isInProgress && !isCompleted && 'font-medium',
                )}
              >
                {node.title}
              </span>
            </div>

            {/* TimerRow */}
            {isInProgress && (
              <LiveTimer
                startTime={node.activeTimeBlockStartTime ?? node.updatedAt}
                estimatedMinutes={node.estimatedMinutes}
              />
            )}

            {/* BottomRow */}
            <div className="flex items-center gap-1.5">
              {/* Child completion count */}
              {node.childCompletionCount.total > 0 && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="child-completion"
                >
                  {node.childCompletionCount.completed}/
                  {node.childCompletionCount.total}
                </span>
              )}
              <ContextBadge context={node.context} />
              {node.estimatedMinutes != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {formatMinutes(node.estimatedMinutes)}
                </span>
              )}
            </div>
          </div>

          <ActionArea
            status={node.status}
            onStart={handleStatusAction}
            onStop={handleStatusAction}
            onComplete={handleComplete}
          />
        </div>
      </Link>

      {/* Children */}
      {hasChildren && expanded && (
        <div data-testid="tree-children">
          {node.children.map((child) => (
            <TreeTaskRow
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </>
  )
}
