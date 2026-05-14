// action: { label, onClick }
export function PageError({
  heading = 'Something went wrong',
  description = 'Check your connection and try again.',
  action,
  className = 'min-h-[60vh]',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-900">{heading}</h3>
      <p className="text-sm text-slate-500 mt-1.5">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
