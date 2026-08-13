import { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-wash text-success border border-teal-light',
  warning: 'bg-warning-wash text-warning border border-yellow-200',
  error: 'bg-error-wash text-error border border-red-200',
  info: 'bg-info-wash text-info border border-blue-200',
  neutral: 'bg-line-soft text-ink border border-line',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-xs font-semibold rounded',
  md: 'px-3 py-1.5 text-sm font-semibold rounded-md',
}

export function Badge({ children, variant = 'neutral', size = 'sm', className }: BadgeProps) {
  return <span className={`inline-flex items-center ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>{children}</span>
}

interface StatusBadgeProps {
  status: 'active' | 'finished' | 'pending' | 'error'
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    active: { label: 'Active', variant: 'success' as const },
    finished: { label: 'Finished', variant: 'neutral' as const },
    pending: { label: 'Pending', variant: 'warning' as const },
    error: { label: 'Error', variant: 'error' as const },
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} size="md" className={className}>
      {config.label}
    </Badge>
  )
}
