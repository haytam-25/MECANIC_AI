import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from './components/AppShell.tsx'
import { SessionProvider } from './context/SessionProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'
import { lazyPage } from './lib/lazyPage.ts'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { VehiclePage } from './pages/VehiclePage.tsx'

// Las secciones de cada coche se descargan al abrirlas: así la portada y el garaje cargan antes (el chat, por ejemplo,
// trae el lector de Markdown)
const ConversationsPage = lazyPage(() => import('./pages/ConversationsPage.tsx').then((m) => m.ConversationsPage))
const ChatRoute = lazyPage(() => import('./pages/ChatRoute.tsx').then((m) => m.ChatRoute))
const ReportPage = lazyPage(() => import('./pages/ReportPage.tsx').then((m) => m.ReportPage))
const RepairsPage = lazyPage(() => import('./pages/RepairsPage.tsx').then((m) => m.RepairsPage))
const RepairFormPage = lazyPage(() => import('./pages/RepairFormPage.tsx').then((m) => m.RepairFormPage))
const BasketPage = lazyPage(() => import('./pages/BasketPage.tsx').then((m) => m.BasketPage))
const DocumentsPage = lazyPage(() => import('./pages/DocumentsPage.tsx').then((m) => m.DocumentsPage))

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              {/* Cada coche del garaje: su página, sus consultas con el mecánico, su informe médico, su diario, su cesta y su documentación */}
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
                <Route path="documentos" element={<DocumentsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
