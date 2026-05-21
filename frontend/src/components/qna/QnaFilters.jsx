import { useState, useRef, useEffect } from 'react'
import { SearchInput } from '@/components/qna/SearchInput'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, other: true })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month, year, other: false })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++)
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, other: true })
  return cells
}

function cellISO(cell) {
  return `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
}

const todayISO = new Date().toISOString().split('T')[0]

const VISIBILITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
]

const DATE_PRESETS = [
  { value: 'last24h', label: 'Last 24 Hours' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
]

function getChipLabel(preset, fromDate, toDate) {
  if (preset === 'last24h') return 'Last 24 Hours'
  if (preset === 'last7') return 'Last 7 Days'
  if (preset === 'last30') return 'Last 30 Days'
  if (preset === 'thisMonth') return 'This Month'
  if (preset === 'custom') {
    const fmt = (d) =>
      new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (fromDate && toDate) return `${fmt(fromDate)} – ${fmt(toDate)}`
    if (fromDate) return `From ${fmt(fromDate)}`
    if (toDate) return `Until ${fmt(toDate)}`
    return 'Custom Range'
  }
  return 'Any Time'
}

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

const ChevronLeftIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
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

export function QnaFilters({
  search,
  setSearch,
  visibility = '',
  setVisibility,
  fromDate = '',
  setFromDate,
  toDate = '',
  setToDate,
  datePreset = '',
  setDatePreset,
  hasActiveFilters,
  onClearFilters,
  role,
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef(null)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [hoverDate, setHoverDate] = useState('')

  useEffect(() => {
    if (!popoverOpen) return
    function onClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target))
        setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [popoverOpen])

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const currentMonthISO = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`
  const isNextMonthFuture = currentMonthISO >= todayISO.slice(0, 7)

  function handleDayClick(iso) {
    if (!fromDate || (fromDate && toDate)) {
      setFromDate(iso)
      setToDate('')
    } else {
      if (iso >= fromDate) { setToDate(iso) }
      else { setToDate(fromDate); setFromDate(iso) }
    }
  }

  function getCellStyle(cell) {
    if (cell.other) return 'text-slate-300 cursor-default pointer-events-none'
    const iso = cellISO(cell)
    if (iso > todayISO) return 'text-slate-300 opacity-40 cursor-not-allowed pointer-events-none'
    const rangeEnd = toDate || hoverDate
    const isStart = iso === fromDate
    const isEnd = iso === toDate
    const isInRange = !!(fromDate && rangeEnd && iso > fromDate && iso < rangeEnd)
    if (isStart || isEnd)
      return 'bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer'
    if (isInRange)
      return 'bg-blue-50 text-blue-700 cursor-pointer'
    return 'text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer'
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        className="flex-1 min-w-[200px]"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search boards..."
      />

      {/* Visibility toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-1 h-10 shrink-0">
        {VISIBILITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setVisibility(opt.value)}
            className={`px-3 h-8 rounded-lg text-xs font-medium transition-all duration-200 ${visibility === opt.value
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date filter chip + popover */}
      <div className="relative shrink-0" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setPopoverOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={popoverOpen}
          className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-all duration-200 ${datePreset
              ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
        >
          <CalendarIcon />
          {datePreset ? getChipLabel(datePreset, fromDate, toDate) : 'Date: Any Time'}
          {datePreset ? (
            <span
              role="button"
              aria-label="Clear date filter"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setDatePreset('') }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDatePreset('') } }}
              className="ml-0.5 rounded-full hover:bg-blue-100 p-0.5 transition-colors cursor-pointer"
            >
              <CloseIcon />
            </span>
          ) : (
            <ChevronDownIcon />
          )}
        </button>

        {/* Dropdown popover */}
        {popoverOpen && (
          <div
            role="listbox"
            aria-label="Date filter options"
            className={`absolute top-full left-0 mt-1.5 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden ${datePreset === 'custom' ? 'flex' : 'min-w-[190px] py-1'
              }`}
          >
            {/* Preset list — always visible */}
            <div className={datePreset === 'custom' ? 'w-36 py-1 border-r border-slate-100 shrink-0' : 'w-full'}>
              {DATE_PRESETS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={datePreset === opt.value}
                  onClick={() => {
                    setDatePreset(opt.value)
                    if (opt.value !== 'custom') setPopoverOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between gap-3 ${datePreset === opt.value
                      ? 'text-blue-600 bg-blue-50 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {opt.label}
                  {datePreset === opt.value && <CheckIcon />}
                </button>
              ))}
            </div>

            {/* Calendar — only when Custom Range selected */}
            {datePreset === 'custom' && (
              <div className="p-3 w-[260px] shrink-0">
                {/* Month nav header */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    disabled={isNextMonthFuture}
                    className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {buildCalendarDays(calYear, calMonth).map((cell, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (!cell.other && cellISO(cell) <= todayISO) handleDayClick(cellISO(cell))
                      }}
                      onMouseEnter={() => { if (!cell.other) setHoverDate(cellISO(cell)) }}
                      onMouseLeave={() => setHoverDate('')}
                      className={`h-8 w-full text-xs font-medium transition-colors ${getCellStyle(cell)}`}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>

                {/* Hint */}
                {fromDate && !toDate && (
                  <p className="text-xs text-slate-400 mt-2 text-center">Click a second date to complete the range</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear all filters */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${hasActiveFilters ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'
          }`}
      >
        <button
          type="button"
          onClick={onClearFilters}
          aria-label="Clear all filters"
          className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors duration-200 shadow-sm whitespace-nowrap"
        >
          <CloseIcon />
          Clear
        </button>
      </div>
    </div>
  )
}
