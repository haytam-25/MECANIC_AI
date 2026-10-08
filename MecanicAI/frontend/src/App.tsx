import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from './components/AppShell.tsx'
import { SessionProvider } from './context/SessionProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'
import { ChatRoute } from './pages/ChatRoute.tsx'
import { ConversationsPage } from './pages/ConversationsPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
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
              {/* Cada coche del garaje: su página, sus consultas con el mecánico y su informe médico */}
              <Route path="coche/:vehicleId">
                <Route index element={<VehiclePage />} />
                <Route path="consultas" element={<ConversationsPage />} />
                {/* …/consultas/nuevo o …/consultas/<id> */}
                <Route path="consultas/:conversationId" element={<ChatRoute />} />
                <Route path="informe" element={<ReportPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
