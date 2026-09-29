import { useState } from 'react'

import type { User } from '../api/types.ts'

export function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false)
  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase()
  if (user.avatarUrl && !broken) {
    return (
      <img
        className="avatar"
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="avatar avatar--initial" style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  )
}
