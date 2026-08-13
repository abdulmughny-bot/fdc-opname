import logo from '../assets/fdc-logo.png'

const SIZE_CLASSES = {
  sm: 'w-10',
  md: 'w-16',
  lg: 'w-24',
}

export function FDCLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <img src={logo} alt="FDC Dental Clinic" className={`${SIZE_CLASSES[size]} h-auto`} />
}
