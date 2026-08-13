import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  interactive?: boolean
  hover?: boolean
}

export function Card({ children, className, interactive, hover = true }: CardProps) {
  return (
    <div
      className={`
        bg-paper border border-line rounded-[12px] p-4
        ${hover && !interactive ? 'transition-shadow duration-200' : ''}
        ${hover && !interactive ? 'hover:shadow-md' : ''}
        ${interactive ? 'cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-teal-light' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={`mb-3 pb-3 border-b border-line-soft ${className}`}>{children}</div>
}

interface CardTitleProps {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CardTitle({ children, size = 'md', className }: CardTitleProps) {
  const sizeStyles = {
    sm: 'text-sm font-semibold text-ink',
    md: 'text-base font-bold text-ink',
    lg: 'text-lg font-bold text-ink',
  }
  return <h3 className={`${sizeStyles[size]} ${className}`}>{children}</h3>
}

interface CardBodyProps {
  children: ReactNode
  className?: string
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={`text-sm text-ink-soft ${className}`}>{children}</div>
}

interface CardFooterProps {
  children: ReactNode
  className?: string
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <div className={`mt-4 pt-4 border-t border-line-soft flex items-center gap-3 ${className}`}>{children}</div>
}
