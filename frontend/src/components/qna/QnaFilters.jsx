import { SearchInput } from '@/components/qna/SearchInput'

const VISIBILITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
]

const dateCls =
  'h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 ' +
  'focus-visible:border-blue-500 transition-all duration-200 cursor-pointer'

export function QnaFilters({
  search,
  setSearch,
  visibility = '',
  setVisibility,
  fromDate = '',
  setFromDate,
  toDate = '',
  setToDate,
  hasActiveFilters,
  onClearFilters,
  role,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        className="flex-1 min-w-[200px]"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search boards..."
      />

      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-1 h-10 shrink-0">
        {VISIBILITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setVisibility(opt.value)}
            className={`px-3 h-8 rounded-lg text-xs font-medium transition-all duration-200 ${
              visibility === opt.value
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        max={toDate || undefined}
        className={dateCls}
        aria-label="From date"
      />

      <input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        min={fromDate || undefined}
        className={dateCls}
        aria-label="To date"
      />

      <button
        type="button"
        onClick={onClearFilters}
        aria-label="Clear all filters"
        className={`flex items-center gap-1.5 h-10 px-3 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-200 shrink-0 shadow-sm ${
          hasActiveFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear
      </button>
    </div>
  )
}
