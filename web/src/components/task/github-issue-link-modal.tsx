import { useNavigate } from '@tanstack/react-router'
import { CircleDot, ExternalLink, GitPullRequest, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import {
  useCreateTaskFromGithubUrl,
  useLinkTaskToGithub,
  useResolveGithubUrl,
} from '#hooks/use-github-link'

interface GithubIssueLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 'create' pastes a URL to create a new task; 'link' attaches it to `taskId`. */
  mode: 'create' | 'link'
  taskId?: string
}

export function GithubIssueLinkModal({
  open,
  onOpenChange,
  mode,
  taskId,
}: GithubIssueLinkModalProps) {
  const [url, setUrl] = useState('')
  const [resolved, setResolved] = useState<ResolveGithubUrlResult | null>(null)
  const navigate = useNavigate()
  const resolveUrl = useResolveGithubUrl()
  const createTask = useCreateTaskFromGithubUrl()
  const linkTask = useLinkTaskToGithub(taskId ?? '')
  const confirmMutation = mode === 'create' ? createTask : linkTask

  const resetForm = () => {
    setUrl('')
    setResolved(null)
    resolveUrl.reset()
    createTask.reset()
    linkTask.reset()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleResolve = () => {
    const trimmed = url.trim()
    if (!trimmed || resolveUrl.isPending) return
    resolveUrl.mutate(trimmed, {
      onSuccess: (data) => {
        setResolved(data)
      },
    })
  }

  const goToTask = (id: string) => {
    handleOpenChange(false)
    void navigate({ to: '/tasks/$taskId', params: { taskId: id } })
  }

  const handleConfirm = () => {
    const trimmed = url.trim()
    if (!trimmed) return

    if (mode === 'create') {
      createTask.mutate(trimmed, {
        onSuccess: (data) => {
          goToTask(data.task.id)
        },
      })
    } else {
      linkTask.mutate(trimmed, {
        onSuccess: () => {
          handleOpenChange(false)
        },
      })
    }
  }

  const preview = resolved?.linked === false ? resolved.preview : null
  const linkedTask = resolved?.linked === true ? resolved.task : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? 'Create task from GitHub'
              : 'Link GitHub issue'}
          </DialogTitle>
          <DialogDescription>
            Paste a GitHub issue or pull request URL.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setResolved(null)
            }}
            onBlur={handleResolve}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleResolve()
              }
            }}
            placeholder="https://github.com/owner/repo/issues/123"
            autoFocus
          />

          {resolveUrl.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Looking up issue...
            </div>
          )}

          {resolveUrl.isError && (
            <p className="text-sm text-destructive">
              {resolveUrl.error.message}
            </p>
          )}

          {confirmMutation.isError && (
            <p className="text-sm text-destructive">
              {confirmMutation.error.message}
            </p>
          )}

          {linkedTask && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="text-muted-foreground">Already linked to:</p>
              <p className="font-medium">{linkedTask.title}</p>
            </div>
          )}

          {preview && (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {preview.kind === 'pull_request' ? (
                  <GitPullRequest className="size-3.5" />
                ) : (
                  <CircleDot className="size-3.5" />
                )}
                {preview.owner}/{preview.repo}#{preview.number}
              </div>
              <p className="font-medium">{preview.title}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleOpenChange(false)
            }}
          >
            Cancel
          </Button>
          {linkedTask ? (
            <Button
              onClick={() => {
                goToTask(linkedTask.id)
              }}
            >
              Go to task
              <ExternalLink className="size-3.5" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={!preview || confirmMutation.isPending}
            >
              {mode === 'create' ? 'Create Task' : 'Link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
