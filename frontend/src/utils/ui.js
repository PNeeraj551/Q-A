// Single source of truth for shared UI class strings.
// Every page/component that needs an input, textarea, or card shell imports from here.

export const inputCls =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:opacity-50 transition-all duration-200'

export const textareaCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:opacity-50 transition-all duration-200 resize-none leading-relaxed'

export const errorInputCls = 'border-red-400 focus-visible:ring-red-400/20 focus-visible:border-red-400'
