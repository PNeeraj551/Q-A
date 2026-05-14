export function FormError({ message }) {
  if (!message) return null
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600 flex items-center gap-2">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
      </svg>
      {message}
    </div>
  )
}
