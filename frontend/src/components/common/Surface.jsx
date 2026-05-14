export function Surface({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`bg-white border border-slate-200 rounded-2xl ${className}`} {...props}>
      {children}
    </Tag>
  )
}
