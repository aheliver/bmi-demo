import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AddFab() {
  return (
    <Button
      size="icon"
      aria-label="Add record"
      className="fixed right-6 bottom-6 h-14 w-14 rounded-full shadow-lg"
    >
      <Plus className="h-6 w-6" />
    </Button>
  )
}
