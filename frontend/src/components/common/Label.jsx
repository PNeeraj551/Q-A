import { cn } from "@/utils/utils"

export function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 text-sm leading-none font-medium select-none",
        className
      )}
      {...props}
    />
  )
}
