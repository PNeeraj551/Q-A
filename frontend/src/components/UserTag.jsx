export function UserTag({ label, onRemove, disabled }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full font-medium">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-blue-400 hover:text-red-500 disabled:opacity-50 transition-colors duration-200 leading-none"
        >
          ✕
        </button>
      )}
    </span>
  )
}
