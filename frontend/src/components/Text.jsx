const sizes = { xs: 'text-xs', sm: 'text-sm', '13': 'text-[13px]' }
const colors = { secondary: 'text-slate-500', muted: 'text-slate-400' }

export function Text({ size = 'sm', color = 'secondary', as: Tag = 'p', className = '', children }) {
  return (
    <Tag className={`${sizes[size] || sizes.sm} ${colors[color] || colors.secondary} ${className}`}>
      {children}
    </Tag>
  )
}
