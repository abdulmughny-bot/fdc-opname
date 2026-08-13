export function FDCLogo({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) {
  const sizeMap = {
    sm: { container: 'w-10 h-10', text: 'text-[9px]', subtext: 'text-[6px]', gap: 'gap-0.5' },
    md: { container: 'w-16 h-16', text: 'text-xs', subtext: 'text-[7px]', gap: 'gap-1' },
    lg: { container: 'w-24 h-24', text: 'text-base', subtext: 'text-xs', gap: 'gap-1.5' },
  }

  const s = sizeMap[size]

  return (
    <div className={`flex flex-col items-center ${s.gap}`}>
      <svg viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg" className={s.container}>
        {/* Left curved line */}
        <path
          d="M 60 80 Q 40 100 50 140 Q 60 170 90 180"
          stroke="#5ABA4F"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        {/* Right curved line */}
        <path
          d="M 220 80 Q 240 100 230 140 Q 220 170 190 180"
          stroke="#5ABA4F"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        {/* Pink smile */}
        <path
          d="M 90 160 Q 140 200 190 160"
          stroke="#EA73AC"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        {/* fdc text */}
        <text x="140" y="240" fontSize="48" fontWeight="700" fill="#5ABA4F" textAnchor="middle" fontFamily="Arial, sans-serif">
          fdc
        </text>
      </svg>

      {showText && (
        <div className="text-center">
          <p className={`${s.text} font-bold text-teal-deep leading-none`}>fdc</p>
          <p className={`${s.subtext} text-teal-deep leading-none`}>Dental Clinic</p>
        </div>
      )}
    </div>
  )
}
