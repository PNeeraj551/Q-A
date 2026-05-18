import { useState, useRef, useEffect } from 'react'

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const PRESETS = [
  { label: '24 Hours', ms: 24 * 3600 * 1000 },
  { label: '1 Week',   ms: 7 * 24 * 3600 * 1000 },
  { label: '1 Month',  ms: 30 * 24 * 3600 * 1000 },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, other: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, other: false })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, other: true })
  }
  return cells
}

const CalendarIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

function formatDateLabel(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeLabel(t) {
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export default function AutoCloseField({ value, onChange, disabled, minDate, showClear, onClear, error }) {
  const [autoClose, setAutoClose] = useState(!!value)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const [calPlacement, setCalPlacement] = useState('bottom')
  const [timePlacement, setTimePlacement] = useState('bottom')
  const datePopoverRef = useRef(null)
  const timeDropdownRef = useRef(null)

  const [calYear, setCalYear] = useState(() => {
    if (value) return parseInt(value.split('T')[0].split('-')[0])
    return new Date().getFullYear()
  })
  const [calMonth, setCalMonth] = useState(() => {
    if (value) return parseInt(value.split('T')[0].split('-')[1]) - 1
    return new Date().getMonth()
  })

  useEffect(() => { if (value) setAutoClose(true) }, [value])

  useEffect(() => {
    if (!value) return
    const parts = value.split('T')[0].split('-')
    setCalYear(parseInt(parts[0]))
    setCalMonth(parseInt(parts[1]) - 1)
  }, [value])

  useEffect(() => {
    if (!datePopoverOpen) return
    function handler(e) {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target)) setDatePopoverOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [datePopoverOpen])

  useEffect(() => {
    if (!timeDropdownOpen) return
    function handler(e) {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target)) setTimeDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [timeDropdownOpen])

  function handleToggle(on) {
    setAutoClose(on)
    if (!on) { onChange(''); setDatePopoverOpen(false); setTimeDropdownOpen(false) }
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const datePart = value ? value.split('T')[0] : ''
  const timePart = value ? (value.split('T')[1] || '09:00').slice(0, 5) : '09:00'

  function handleDateChange(newDate) {
    onChange(newDate ? `${newDate}T${timePart}` : '')
    setDatePopoverOpen(false)
  }

  function handleTimeChange(newTime) {
    if (!datePart) return
    onChange(`${datePart}T${newTime}`)
    setTimeDropdownOpen(false)
  }

  function isCellDisabled(cell) {
    if (cell.other) return true
    const cellDate = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
    if (minDate && cellDate < minDate.split('T')[0]) return true
    return false
  }

  function isCellSelected(cell) {
    if (cell.other || !datePart) return false
    return datePart === `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
  }

  const isPast = value && new Date(value) < new Date()
  const daysUntil = value ? Math.ceil((new Date(value) - Date.now()) / 86400000) : 0
  const formatted = value
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      }).format(new Date(value))
    : ''

  const triggerCls = 'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">Auto-close board</span>
            <div className="relative group/tip">
              <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 px-3 py-2 bg-slate-800 text-white text-xs rounded-xl shadow-lg invisible group-hover/tip:visible opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 pointer-events-none z-10 text-center leading-relaxed">
                If set, this Q&A board will automatically close at the selected date and time.
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Automatically lock the board at a set date and time</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={autoClose}
          onClick={() => handleToggle(!autoClose)}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            autoClose ? 'bg-blue-600' : 'bg-slate-200'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
              autoClose ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Expanded content */}
      {autoClose && (
        <div className="flex flex-col gap-3 pt-1">
          {/* Preset pills */}
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(({ label, ms }) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(toDatetimeLocal(new Date(Date.now() + ms)))}
                disabled={disabled}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-150 disabled:opacity-50 disabled:cursor-default"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date + Time row */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Date picker — custom calendar */}
            <div className="relative" ref={datePopoverRef}>
              <button
                type="button"
                onClick={() => {
                  if (datePopoverOpen) { setDatePopoverOpen(false); return }
                  const rect = datePopoverRef.current?.getBoundingClientRect()
                  const spaceBelow = rect ? window.innerHeight - rect.bottom : 300
                  setCalPlacement(spaceBelow < 320 ? 'top' : 'bottom')
                  setDatePopoverOpen(true)
                }}
                disabled={disabled}
                className={triggerCls}
              >
                <CalendarIcon />
                <span>{datePart ? formatDateLabel(datePart) : 'Set date'}</span>
                <ChevronDownIcon />
              </button>

              {datePopoverOpen && (
                <div className={`absolute left-0 z-50 rounded-xl border border-slate-200 bg-white shadow-lg p-3 w-[280px] ${calPlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
                  {/* Month/Year header */}
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
                      className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
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
                    {buildCalendarDays(calYear, calMonth).map((cell, i) => {
                      const cellDisabled = isCellDisabled(cell)
                      const selected = isCellSelected(cell)
                      const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={cellDisabled || disabled}
                          onClick={() => handleDateChange(dateStr)}
                          className={[
                            'h-8 w-full rounded-lg text-xs font-medium transition-colors',
                            cell.other ? 'text-slate-300' : '',
                            selected ? 'bg-blue-600 text-white hover:bg-blue-700' : '',
                            !selected && !cell.other && !cellDisabled ? 'text-slate-700 hover:bg-slate-100' : '',
                            cellDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                          ].join(' ')}
                        >
                          {cell.day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Time dropdown */}
            <div className="relative" ref={timeDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  if (timeDropdownOpen) { setTimeDropdownOpen(false); return }
                  const rect = timeDropdownRef.current?.getBoundingClientRect()
                  const spaceBelow = rect ? window.innerHeight - rect.bottom : 300
                  setTimePlacement(spaceBelow < 220 ? 'top' : 'bottom')
                  setTimeDropdownOpen(true)
                }}
                disabled={disabled || !datePart}
                className={triggerCls}
              >
                <ClockIcon />
                <span>{formatTimeLabel(timePart)}</span>
                <ChevronDownIcon />
              </button>

              {timeDropdownOpen && (
                <div className={`absolute left-0 z-50 w-36 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1 ${timePlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
                  {TIME_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTimeChange(t)}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        t === timePart
                          ? 'bg-slate-100 text-slate-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {formatTimeLabel(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear */}
            {value && (
              <button
                type="button"
                aria-label="Clear date and time"
                onClick={() => onChange('')}
                disabled={disabled}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <CloseIcon />
              </button>
            )}
          </div>

          {/* Submit-time error */}
          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Dynamic badges */}
          {value && isPast && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              This date is in the past — the board will close immediately upon saving.
            </div>
          )}

          {value && !isPast && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Board locks on {formatted} — in {daysUntil === 0 ? 'less than a day' : `${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
