export function FDCLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: { container: 'w-8 h-8', text: 'text-[10px]' },
    md: { container: 'w-12 h-12', text: 'text-xs' },
    lg: { container: 'w-16 h-16', text: 'text-sm' },
  }

  const s = sizeMap[size]

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${s.container} rounded-lg bg-gradient-to-br from-teal-deep to-teal flex items-center justify-center`}>
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
          {/* Apple/Tooth Shape - FDC Green */}
          <path
            d="M32 8C32 8 20 15 20 28C20 38.6 24.5 45 32 48C39.5 45 44 38.6 44 28C44 15 32 8 32 8Z"
            fill="#5ABA4F"
          />
          {/* Smile/Arc - FDC Pink */}
          <path d="M24 32C24 32 28 36 32 36C36 36 40 32 40 32" stroke="#EA73AC" strokeWidth="2" strokeLinecap="round" />
          {/* Stem */}
          <rect x="30" y="4" width="4" height="5" rx="2" fill="#5ABA4F" />
        </svg>
      </div>
      <div className={`${s.text} font-display font-bold text-teal-deep leading-none`}>
        fdc
      </div>
    </div>
  )
}
