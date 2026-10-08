import { useEffect, useState } from 'react'

import { fetchReports } from '../../api/endpoints.ts'
import type { SavedReport } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'

/**
 * Informes médicos guardados en la cuenta (null mientras se cargan). Como invitado no se guarda ninguno: lista vacía.
 */
export function useSavedReports() {
  const { me } = useSession()
  const authenticated = Boolean(me?.authenticated)
  const [reports, setReports] = useState<SavedReport[] | null>(null)

  useEffect(() => {
    if (!authenticated) return
    let active = true
    fetchReports()
      .then((list) => {
        if (active) setReports(list)
      })
      .catch(() => {
        if (active) setReports([])
      })
    return () => {
      active = false
    }
  }, [authenticated])

  const remember = (report: SavedReport) =>
    setReports((list) => [report, ...(list ?? []).filter((r) => r.vehicleId !== report.vehicleId)])

  return { reports: authenticated ? reports : [], remember }
}
