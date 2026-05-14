const styles = {
  1: 'text-2xl font-bold text-slate-900 tracking-tight',
  2: 'text-base font-bold text-slate-900 tracking-tight',
  3: 'text-sm font-semibold text-slate-900',
}

export function Heading({ level = 2, className = '', children }) {
  const Tag = `h${level}`
  return <Tag className={`${styles[level] || styles[2]} ${className}`}>{children}</Tag>
}
