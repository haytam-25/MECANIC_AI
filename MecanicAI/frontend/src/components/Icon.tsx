const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  send: 'M12 19V5M5 12l7-7 7 7',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  logout: 'M15 12H4M8 8l-4 4 4 4M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5',
  copy: 'M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 16V5a1 1 0 0 1 1-1h10',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
  refresh: 'M20 12a8 8 0 1 1-2.35-5.65M20 4v5h-5',
  wrench:
    'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.6 17.4a1.4 1.4 0 0 0 2 2l5.7-5.7a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-.6-.6-2 2.6-2.6z',
  install: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  car: 'M5 16l1.6-5.3A2 2 0 0 1 8.5 9.3h7a2 2 0 0 1 1.9 1.4L19 16M4 16h16v3H4zM7.5 13h.01M16.5 13h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
} as const

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName | 'stop'
  size?: number
  className?: string
}

export function Icon({ name, size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'stop' ? (
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
      ) : (
        <path d={PATHS[name]} />
      )}
    </svg>
  )
}
