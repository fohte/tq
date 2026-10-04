import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { type ReactNode, useEffect, useState } from 'react'

import { GithubRefSummary } from '#components/task/github-ref-summary'
import { useDebounce } from '#hooks/use-debounce'
import {
  type GithubUrlCandidate,
  useResolveGithubUrlQuery,
} from '#hooks/use-github-link'
import {
  SEARCH_QUERY_DEBOUNCE_MS,
  type SearchResult,
  useSearchTasks,
} from '#hooks/use-search'

const GITHUB_ISSUE_OR_PR_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+\/?(?:[?#].*)?$/i

export function TaskSearchCandidateDialogAppearance({
  open,
  onOpenChange,
  title,
  query,
  onQueryChange,
  candidates,
  isFetching,
  allowGithubUrls = false,
  githubCandidate,
  githubUrlError,
  isResolvingGithubUrl = false,
  onSelectCandidate,
  onSelectGithubCandidate,
  skipAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  query: string
  onQueryChange: (query: string) => void
  candidates: SearchResult[]
  isFetching: boolean
  allowGithubUrls?: boolean
  githubCandidate?: GithubUrlCandidate | null
  githubUrlError?: string | undefined
  isResolvingGithubUrl?: boolean
  onSelectCandidate: (candidate: SearchResult) => void
  onSelectGithubCandidate?:
    ((candidate: GithubUrlCandidate) => void) | undefined
  skipAction?: { label: string; onSkip: () => void } | undefined
}) {
  const isGithubUrl =
    allowGithubUrls && GITHUB_ISSUE_OR_PR_URL_PATTERN.test(query.trim())
  const showNoResults =
    query.trim() !== '' &&
    candidates.length === 0 &&
    !isFetching &&
    githubCandidate == null &&
    !isResolvingGithubUrl &&
    githubUrlError == null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
          }}
          placeholder={
            allowGithubUrls
              ? 'Search tasks or paste a GitHub issue/PR URL...'
              : 'Search tasks...'
          }
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
              {allowGithubUrls
                ? 'Search tasks or paste a GitHub issue/PR URL'
                : 'Type to search tasks'}
            </div>
          ) : showNoResults ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
              {`no results for "${query}"`}
            </div>
          ) : (
            <>
              {candidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-popover-foreground hover:bg-accent/50"
                  onClick={() => {
                    onSelectCandidate(candidate)
                  }}
                >
                  <span className="shrink-0 text-muted-foreground-faint">
                    #{candidate.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {candidate.title}
                  </span>
                  {candidate.parentId != null &&
                    candidate.parentNumber != null && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground-faint">
                        ← #{candidate.parentNumber}
                      </span>
                    )}
                </Button>
              ))}

              {isGithubUrl && isResolvingGithubUrl && (
                <div className="px-4 py-4 text-center font-mono text-xs text-muted-foreground-faint">
                  Looking up GitHub issue or pull request...
                </div>
              )}

              {isGithubUrl && githubUrlError != null && (
                <p className="px-4 py-4 text-center text-xs text-destructive">
                  {githubUrlError}
                </p>
              )}

              {isGithubUrl && githubCandidate != null && (
                <div className="border-y border-border py-1">
                  <div className="px-3 py-1 font-mono text-2xs text-muted-foreground-faint">
                    GitHub
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent/50"
                    onClick={() => {
                      onSelectGithubCandidate?.(githubCandidate)
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <GithubRefSummary {...githubCandidate} />
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground-faint">
                        {githubCandidate.kind === 'pull_request'
                          ? 'pull request'
                          : 'issue'}{' '}
                        · {githubCandidate.state}
                      </span>
                    </span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {skipAction != null && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 min-h-11 w-full border-t border-border px-3 text-center text-sm text-muted-foreground hover:bg-accent/50"
            onClick={skipAction.onSkip}
          >
            {skipAction.label}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function TaskSearchCandidateDialog({
  open,
  onOpenChange,
  title,
  excludedTaskIds,
  excludedGithubUrls = [],
  allowGithubUrls = false,
  onSelectCandidate,
  onSelectGithubCandidate,
  skipAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  excludedTaskIds: Set<string>
  excludedGithubUrls?: string[]
  allowGithubUrls?: boolean
  onSelectCandidate: (candidate: SearchResult) => void
  onSelectGithubCandidate?:
    ((candidate: GithubUrlCandidate) => void) | undefined
  skipAction?: { label: string; onSkip: () => void }
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setQuery('')
    }
  }, [open])

  const { data: searchResults, isFetching } = useSearchTasks(query)

  const candidates = (searchResults ?? []).filter(
    (t) => !excludedTaskIds.has(t.id),
  )
  const trimmedQuery = query.trim()
  const renderAppearance = (githubCandidateState: {
    githubCandidate: GithubUrlCandidate | null
    githubUrlError: string | undefined
    isResolvingGithubUrl: boolean
  }) => (
    <TaskSearchCandidateDialogAppearance
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      query={query}
      onQueryChange={setQuery}
      candidates={candidates}
      isFetching={isFetching}
      allowGithubUrls={allowGithubUrls}
      githubCandidate={githubCandidateState.githubCandidate}
      githubUrlError={githubCandidateState.githubUrlError}
      isResolvingGithubUrl={githubCandidateState.isResolvingGithubUrl}
      onSelectCandidate={onSelectCandidate}
      onSelectGithubCandidate={onSelectGithubCandidate}
      skipAction={skipAction}
    />
  )

  if (!allowGithubUrls) {
    return renderAppearance({
      githubCandidate: null,
      githubUrlError: undefined,
      isResolvingGithubUrl: false,
    })
  }

  return (
    <GithubUrlCandidateResolver
      url={trimmedQuery}
      enabled={open}
      excludedGithubUrls={excludedGithubUrls}
    >
      {renderAppearance}
    </GithubUrlCandidateResolver>
  )
}

function GithubUrlCandidateResolver({
  url,
  enabled,
  excludedGithubUrls,
  children,
}: {
  url: string
  enabled: boolean
  excludedGithubUrls: string[]
  children: (state: {
    githubCandidate: GithubUrlCandidate | null
    githubUrlError: string | undefined
    isResolvingGithubUrl: boolean
  }) => ReactNode
}) {
  const debouncedUrl = useDebounce(url, SEARCH_QUERY_DEBOUNCE_MS)
  const isDebouncing = debouncedUrl !== url
  const shouldResolveGithubUrl =
    GITHUB_ISSUE_OR_PR_URL_PATTERN.test(debouncedUrl) &&
    !excludedGithubUrls.includes(debouncedUrl)
  const githubUrlQuery = useResolveGithubUrlQuery(
    debouncedUrl,
    enabled && !isDebouncing && shouldResolveGithubUrl,
  )
  const resolvedGithub = githubUrlQuery.data
  const githubCandidate =
    resolvedGithub == null
      ? null
      : resolvedGithub.linked
        ? (resolvedGithub.task.githubLinks[0] ?? null)
        : resolvedGithub.preview
  const availableGithubCandidate =
    !isDebouncing &&
    githubCandidate != null &&
    !excludedGithubUrls.includes(githubCandidate.url)
      ? githubCandidate
      : null

  return children({
    githubCandidate:
      shouldResolveGithubUrl && !isDebouncing ? availableGithubCandidate : null,
    githubUrlError:
      shouldResolveGithubUrl &&
      !isDebouncing &&
      githubUrlQuery.error instanceof Error
        ? githubUrlQuery.error.message
        : undefined,
    isResolvingGithubUrl:
      enabled &&
      (isDebouncing || (shouldResolveGithubUrl && githubUrlQuery.isFetching)),
  })
}
