import { cn } from "@/lib/utils"

const variants = {
  default:     "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 hover:shadow-md",
  outline:     "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
  ghost:       "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  destructive: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 focus-visible:ring-red-400/30",
}

const sizes = {
  default: "h-10 gap-1.5 px-5",
  sm:      "h-9 gap-1 px-4 text-sm",
}

function Button({ className, variant = "default", size = "default", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Button }
