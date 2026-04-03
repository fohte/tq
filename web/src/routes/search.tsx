import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SearchView } from '@web/components/search/search-view'

export const Route = createFileRoute('/search')({
  component: Search,
})

function Search() {
  const navigate = useNavigate()

  return (
    <div className="h-[calc(100dvh-56px)] md:h-dvh">
      <SearchView
        onBack={() => {
          void navigate({ to: '/' })
        }}
      />
    </div>
  )
}
