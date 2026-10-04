import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from './components/AppShell.tsx'
import { SessionProvider } from './context/SessionProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'
import { ChatPage } from './pages/ChatPage.tsx'
import { GuestChatPage } from './pages/GuestChatPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NewVehiclePage } from './pages/NewVehiclePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ReportPage } from './pages/ReportPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="vehiculo/nuevo" element={<NewVehiclePage />} />
              <Route path="chat/invitado" element={<GuestChatPage />} />
              <Route path="informe" element={<ReportPage />} />
              {/* /chat/nuevo?coche=<id> o /chat/<id> */}
              <Route path="chat/:conversationId" element={<ChatPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
