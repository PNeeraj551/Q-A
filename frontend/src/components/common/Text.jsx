const sizes = { xs: 'text-xs', sm: 'text-sm' }
const colors = { secondary: 'text-slate-500', muted: 'text-slate-500' }

export function Text({ size = 'sm', color = 'secondary', as: Tag = 'p', className = '', children }) {
  return (
    <Tag className={`${sizes[size] || sizes.sm} ${colors[color] || colors.secondary} ${className}`}>
      {children}
    </Tag>
  )
}
