import { BottomTabBar } from '@web/components/layout/bottom-tab-bar'
import { Sidebar } from '@web/components/layout/sidebar'
import { ProjectFormModal } from '@web/components/project/project-form-modal'
import type { ReactNode } from 'react'
import { useState } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  const [showCreateProject, setShowCreateProject] = useState(false)

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
    </div>
  )
}
