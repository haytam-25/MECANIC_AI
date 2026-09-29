interface HubcapProps {
  label: string
  size?: 'sm' | 'md' | 'lg'
}

/** Tapacubos metálico con las iniciales de la marca (sin logotipos de terceros). */
export function Hubcap({ label, size = 'md' }: HubcapProps) {
  return (
    <span className={`hubcap hubcap--${size} ${label.length > 2 ? 'hubcap--long' : ''}`} aria-hidden="true">
      <span className="hubcap__label">{label}</span>
    </span>
  )
}
