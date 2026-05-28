import { useState } from 'react'

const thumbsUpPath = 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'

export function QuestionActionPill({
  question,
  isAdmin,
  canModify,
  onMarkHandled,
  onPushSlack,
  menuBtnRef,
  openMenu,
  menuOpen,
  count,
  voted,
  isClosed,
  isTopQuestion,
  onVote,
}) {
  const [pushing, setPushing] = useState(false)

  async function handlePushSlack() {
    if (pushing) return
    setPushing(true)
    try {
      await onPushSlack()
    } finally {
      setPushing(false)
    }
  }

  const handled = !!question.answered_in_slack
  const pushedToSlack = !!question.pushed_to_slack
  const showAdminActions = isAdmin
  const showMore = canModify

  const voteColorCls = isClosed
    ? 'text-slate-300 cursor-default font-semibold'
    : voted || isTopQuestion
    ? 'text-indigo-600 font-bold hover:bg-slate-50'
    : count > 0
    ? 'text-blue-500 font-semibold hover:bg-slate-50'
    : 'text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 active:bg-slate-100'

  const voteContent = (
    <>
      <span className="tabular-nums">{count}</span>
      <svg className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={thumbsUpPath} />
      </svg>
    </>
  )

  return (
    <>
      {/* Desktop (≥md): outer pill always visible — admin actions slide in from left */}
      <div className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0">
        {(showAdminActions || showMore) && (
          <div className="inline-flex items-center max-w-0 group-hover:max-w-[200px] overflow-hidden transition-all duration-200 ease-out">
            {showAdminActions && (
              <>
                <button
                  type="button"
                  onClick={onMarkHandled}
                  title={handled ? 'Remove Slack answer' : 'Mark answered in Slack'}
                  className={[
                    'px-2.5 py-1.5 transition-colors duration-150',
                    handled
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600',
                  ].join(' ')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </button>

                <div className="w-px h-5 bg-slate-200 shrink-0" />

                <button
                  type="button"
                  onClick={!pushedToSlack ? handlePushSlack : undefined}
                  disabled={pushing || pushedToSlack}
                  title={pushedToSlack ? 'Already pushed to Slack' : 'Push to Slack'}
                  className={[
                    'px-2.5 py-1.5 transition-colors duration-150 disabled:cursor-not-allowed',
                    pushedToSlack
                      ? 'text-emerald-500 opacity-60'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40',
                  ].join(' ')}
                >
                  {pushing ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4A10 10 0 002 12h2z" />
                    </svg>
                  ) : pushedToSlack ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                    </svg>
                  )}
                </button>

                {showMore && <div className="w-px h-5 bg-slate-200 shrink-0" />}
              </>
            )}

            {showMore && (
              <button
                ref={menuBtnRef}
                type="button"
                onClick={openMenu}
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                className={[
                  'px-2.5 py-1.5 transition-colors duration-150',
                  menuOpen
                    ? 'bg-slate-100 text-slate-600'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600',
                ].join(' ')}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
            )}

            <div className="w-px h-5 bg-slate-200 shrink-0" />
          </div>
        )}

        {/* Vote — always visible */}
        {isAdmin ? (
          <div className={[
            'inline-flex items-center gap-1.5 px-2 py-1 text-xs select-none cursor-default',
            isTopQuestion ? 'text-indigo-600 font-bold' : count > 0 ? 'text-blue-500 font-semibold' : 'text-slate-400 font-semibold',
          ].join(' ')}>
            {voteContent}
          </div>
        ) : (
          <button
            type="button"
            onClick={!isClosed ? onVote : undefined}
            disabled={isClosed}
            aria-label={voted ? 'Remove like' : 'Like question'}
            aria-pressed={voted}
            className={['inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors duration-150 select-none', voteColorCls].join(' ')}
          >
            {voteContent}
          </button>
        )}
      </div>

      {/* Mobile (<md): pill with dots (if applicable) + vote — always visible */}
      <div className="md:hidden inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0">
        {(showAdminActions || showMore) && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={openMenu}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className={[
                'px-2 py-1 transition-colors duration-150',
                menuOpen
                  ? 'bg-slate-100 text-slate-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              ].join(' ')}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            <div className="w-px h-4 bg-slate-200 shrink-0" />
          </>
        )}

        {/* Vote */}
        {isAdmin ? (
          <div className={[
            'inline-flex items-center gap-1.5 px-2 py-1 text-xs select-none cursor-default',
            isTopQuestion ? 'text-indigo-600 font-bold' : count > 0 ? 'text-blue-500 font-semibold' : 'text-slate-400 font-semibold',
          ].join(' ')}>
            {voteContent}
          </div>
        ) : (
          <button
            type="button"
            onClick={!isClosed ? onVote : undefined}
            disabled={isClosed}
            aria-label={voted ? 'Remove like' : 'Like question'}
            aria-pressed={voted}
            className={['inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors duration-150 select-none', voteColorCls].join(' ')}
          >
            {voteContent}
          </button>
        )}
      </div>
    </>
  )
}
