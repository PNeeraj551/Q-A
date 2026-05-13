const gapMap = {
  1: 'space-y-1',
  1.5: 'space-y-1.5',
  2: 'space-y-2',
  3: 'space-y-3',
  4: 'space-y-4',
  5: 'space-y-5',
  6: 'space-y-6',
  8: 'space-y-8',
}

export function Stack({ gap = 4, as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`${gapMap[gap] ?? `space-y-${gap}`} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
