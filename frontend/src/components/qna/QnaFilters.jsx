import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { SearchInput } from '@/components/qna/SearchInput'
import { Calendar } from '@/components/ui/calendar'

const DATE_PRESETS = [
  { value: 'last24h', label: 'Last 24 Hours' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
]

const CalendarIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

function getChipLabel(preset, fromDate, toDate) {
  if (preset === 'last24h') return 'Last 24 Hours'
  if (preset === 'last7') return 'Last 7 Days'
  if (preset === 'thisMonth') return 'This Month'
  if (preset === 'custom') {
    const fmt = (d) =>
      new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (fromDate && toDate) return `${fmt(fromDate)} – ${fmt(toDate)}`
    if (fromDate) return `From ${fmt(fromDate)}`
    return 'Custom Range'
  }
  return 'Any Time'
}

export function QnaFilters({
  search,
  setSearch,
  fromDate = '',
  setFromDate,
  toDate = '',
  setToDate,
  datePreset = '',
  setDatePreset,
  hasActiveFilters,
  onClearFilters,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const rangeSelected = {
    from: fromDate ? new Date(fromDate + 'T00:00:00') : undefined,
    to:   toDate   ? new Date(toDate   + 'T00:00:00') : undefined,
  }

  function handleRangeSelect(range) {
    setFromDate(range?.from ? format(range.from, 'yyyy-MM-dd') : '')
    setToDate(range?.to   ? format(range.to,   'yyyy-MM-dd') : '')
  }

  function handleSelectPreset(value) {
    setDatePreset(value)
    if (value !== 'custom') setOpen(false)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <SearchInput
        className="w-full sm:flex-1 sm:min-w-0"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search boards..."
      />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative shrink-0" ref={ref}>

          {/* Trigger chip */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={open}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-all duration-150 ${
              datePreset
                ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <CalendarIcon />
            <span>{datePreset ? getChipLabel(datePreset, fromDate, toDate) : 'Date: Any Time'}</span>
            {datePreset ? (
              <span
                role="button"
                aria-label="Clear date filter"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  setDatePreset('')
                  setFromDate('')
                  setToDate('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    setDatePreset('')
                    setFromDate('')
                    setToDate('')
                  }
                }}
                className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
              >
                <CloseIcon />
              </span>
            ) : (
              <ChevronDownIcon />
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div
              aria-label="Date filter options"
              style={{ animation: 'fadeSlideIn 140ms ease both' }}
              className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl max-w-[calc(100vw-2rem)]"
            >
              {datePreset !== 'custom' ? (
                /* Preset list */
                <div className="py-2 w-full sm:w-48 shrink-0">
                  <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Quick filters
                  </p>

                  {DATE_PRESETS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectPreset(opt.value)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-100 ${
                        datePreset === opt.value
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {datePreset === opt.value && <CheckIcon />}
                    </button>
                  ))}

                  <div className="mx-3 my-1.5 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => handleSelectPreset('custom')}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <span>Custom Range</span>
                    <ChevronRightIcon />
                  </button>
                </div>
              ) : (
                /* Calendar only — presets hidden */
                <div className="p-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDatePreset('')}
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Custom Range
                  </button>
                  <Calendar
                    mode="range"
                    selected={rangeSelected}
                    onSelect={handleRangeSelect}
                    disabled={{ after: new Date() }}
                    numberOfMonths={1}
                    defaultMonth={rangeSelected.from ?? new Date()}
                  />
                  {fromDate && toDate && (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="mt-2 w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                    >
                      Apply range
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap shrink-0 px-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
