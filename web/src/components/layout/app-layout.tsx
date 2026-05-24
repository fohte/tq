import { BottomTabBar } from '@web/components/layout/bottom-tab-bar'
import { Sidebar } from '@web/components/layout/sidebar'
import { ProjectFormModal } from '@web/components/project/project-form-modal'
import { SearchModal } from '@web/components/search/search-modal'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setSearchOpen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div className="flex h-screen">
      <Sidebar
        onNewProject={() => {
          setShowCreateProject(true)
        }}
      />
      <main className="flex-1 overflow-auto pb-14 md:pb-0">{children}</main>
      <BottomTabBar />
      <ProjectFormModal
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
      />
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
