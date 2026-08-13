import type { ReactNode } from 'react'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-4xl',
}

export function Dialog({ isOpen, onClose, title, children, actions, size = 'md' }: DialogProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-200" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className={`bg-paper border border-line rounded-[12px] shadow-xl w-full ${sizeStyles[size]} transition-all duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-line-soft">
            <h2 className="font-display font-bold text-ink text-lg">{title}</h2>
          </div>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
          {actions && <div className="px-6 py-4 border-t border-line-soft flex items-center justify-end gap-3">{actions}</div>}
        </div>
      </div>
    </>
  )
}
