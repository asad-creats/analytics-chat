import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Board } from './pages/Board';
import { Conversation } from './pages/Conversation';
import { DataSource } from './pages/DataSource';
import { Home } from './pages/Home';
import { Reports } from './pages/Reports';
import { ReportView } from './pages/ReportView';
import { States } from './pages/States';
import { ConversationsProvider } from './state/conversations';
import { ReportsProvider } from './state/reports';
import { SettingsProvider } from './state/settings';
import { ToastProvider } from './state/toast';

/** Scrolls to #anchors on navigation, otherwise back to the top. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <ConversationsProvider>
          <ReportsProvider>
            <ScrollManager />
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path="c/:id" element={<Conversation />} />
                <Route path="board" element={<Board />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reports/:id" element={<ReportView />} />
                <Route path="data" element={<DataSource />} />
                <Route path="states" element={<States />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ReportsProvider>
        </ConversationsProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
