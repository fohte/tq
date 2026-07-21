import { createFileRoute } from '@tanstack/react-router'
import { GithubConnectionCard } from '@web/components/settings/github-connection-card'
import {
  useDisconnectGithub,
  useGithubAuthUrl,
  useGithubStatus,
} from '@web/hooks/use-github'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const githubStatus = useGithubStatus()
  const isGithubDisconnected =
    githubStatus.isSuccess && !githubStatus.data.connected
  const githubAuthUrl = useGithubAuthUrl(isGithubDisconnected)
  const disconnectGithub = useDisconnectGithub()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <GithubConnectionCard
          isLoading={githubStatus.isLoading}
          connected={githubStatus.data?.connected ?? false}
          {...(githubStatus.data?.connected === true
            ? { login: githubStatus.data.login }
            : {})}
          {...(githubAuthUrl.data?.url != null
            ? { authUrl: githubAuthUrl.data.url }
            : {})}
          onDisconnect={() => {
            disconnectGithub.mutate()
          }}
          isDisconnecting={disconnectGithub.isPending}
        />
      </div>
    </div>
  )
}
