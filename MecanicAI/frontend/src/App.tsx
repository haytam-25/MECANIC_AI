import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from './components/AppShell.tsx'
import { SessionProvider } from './context/SessionProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'
import { BasketPage } from './pages/BasketPage.tsx'
import { ChatRoute } from './pages/ChatRoute.tsx'
import { ConversationsPage } from './pages/ConversationsPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { RepairFormPage } from './pages/RepairFormPage.tsx'
import { RepairsPage } from './pages/RepairsPage.tsx'
import { ReportPage } from './pages/ReportPage.tsx'
import { VehiclePage } from './pages/VehiclePage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              {/* Cada coche del garaje: su página, sus consultas con el mecánico, su informe médico, su diario y su cesta */}
              <Route path="coche/:vehicleId">
                <Route index element={<VehiclePage />} />
                <Route path="consultas" element={<ConversationsPage />} />
                {/* …/consultas/nuevo o …/consultas/<id> */}
                <Route path="consultas/:conversationId" element={<ChatRoute />} />
                <Route path="informe" element={<ReportPage />} />
                <Route path="reparaciones" element={<RepairsPage />} />
                {/* …/reparaciones/nueva o …/reparaciones/<id> (para corregirla) */}
                <Route path="reparaciones/:repairId" element={<RepairFormPage />} />
                <Route path="cesta" element={<BasketPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
