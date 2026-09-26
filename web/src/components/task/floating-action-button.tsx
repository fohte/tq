import { Button } from '@fohte/ui/button'
import { Plus } from 'lucide-react'

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon-lg"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 md:hidden"
    >
      <Plus />
    </Button>
  )
}
