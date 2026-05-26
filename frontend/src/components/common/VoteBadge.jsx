export function VoteBadge({ count, voted, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={voted ? 'Unlike question' : 'Like question'}
      aria-pressed={voted}
      disabled={disabled}
      className={[
        'flex flex-col items-center justify-center w-9 py-1.5 rounded-lg border text-xs font-semibold',
        'transition-colors duration-100 select-none shrink-0',
        disabled
          ? 'border-slate-100 text-slate-200 cursor-default'
          : voted
          ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 active:scale-95'
          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-500 active:scale-95',
      ].join(' ')}
    >
      <svg className="w-3.5 h-3.5 mb-0.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V2.75a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.25M6.633 10.25H5.25a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25h1.383" />
      </svg>
      <span className="leading-none tabular-nums">{count}</span>
    </button>
  )
}
