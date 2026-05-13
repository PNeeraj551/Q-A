export function SendButton({ type = 'submit', disabled, onClick }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label="Post question"
      className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center hover:from-blue-700 hover:to-indigo-700 hover:shadow-md active:scale-95 disabled:opacity-50 transition-all duration-200"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    </button>
  )
}
