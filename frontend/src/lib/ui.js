// Single source of truth for shared UI class strings.
// Every page/component that needs an input, textarea, or card shell imports from here.

export const inputCls =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 transition-colors'

export const textareaCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 transition-colors resize-none'

export const cardCls = 'bg-card border border-border rounded-xl'

export const errorInputCls = 'border-destructive focus-visible:ring-destructive'
