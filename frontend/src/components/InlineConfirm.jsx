import { Button } from '@/components/ui/button'

export function InlineConfirm({ onConfirm, onCancel }) {
  return (
    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
      <Button variant="destructive" size="sm" onClick={onConfirm}>
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
