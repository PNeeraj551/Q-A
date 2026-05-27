export function VisibilityBadge({ visibility }) {
  if (visibility === 'PUBLIC') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
      Private
    </span>
  )
}

export function StatusBadge({ isClosed }) {
  if (!isClosed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Open
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
      Closed
    </span>
  )
}
