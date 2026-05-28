import { DayPicker } from 'react-day-picker'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={clsx('p-2', className)}
      classNames={{
        months: 'flex flex-col',
        month: 'space-y-3',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-semibold text-slate-900',
        nav: 'space-x-1 flex items-center',
        nav_button: clsx(
          'inline-flex items-center justify-center h-7 w-7 rounded-lg',
          'border border-slate-200 bg-transparent text-slate-600',
          'hover:bg-slate-100 hover:text-slate-900',
          'transition-colors disabled:opacity-30 disabled:pointer-events-none'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse',
        head_row: 'flex',
        head_cell: 'text-slate-400 rounded-md w-8 text-center font-normal text-[0.8rem]',
        row: 'flex w-full mt-1',
        cell: clsx(
          'h-8 w-8 text-center text-sm p-0 relative',
          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
          '[&:has([aria-selected].day-range-start)]:rounded-l-md',
          'first:[&:has([aria-selected])]:rounded-l-md',
          'last:[&:has([aria-selected])]:rounded-r-md',
          'focus-within:relative focus-within:z-20'
        ),
        day: clsx(
          'h-8 w-8 p-0 font-normal text-sm rounded-md',
          'inline-flex items-center justify-center',
          'hover:bg-slate-100 hover:text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1',
          'transition-colors aria-selected:opacity-100'
        ),
        day_selected: clsx(
          'bg-slate-900 text-white rounded-md',
          'hover:bg-slate-900 hover:text-white',
          'focus:bg-slate-900 focus:text-white'
        ),
        day_today: 'bg-slate-100 text-slate-900 font-semibold',
        day_outside: 'text-slate-300 opacity-40 aria-selected:bg-slate-100/50 aria-selected:text-slate-400',
        day_disabled: 'text-slate-300 opacity-40 pointer-events-none',
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_range_middle: clsx(
          'aria-selected:bg-slate-100 aria-selected:text-slate-900',
          'aria-selected:rounded-none aria-selected:hover:bg-slate-200'
        ),
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="w-4 h-4" />,
        IconRight: () => <ChevronRight className="w-4 h-4" />,
      }}
      {...props}
    />
  )
}
