import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Answer } from './pages/Answer';
import { Ask } from './pages/Ask';
import { Board } from './pages/Board';
import { Home } from './pages/Home';
import { States } from './pages/States';
import { Thread } from './pages/Thread';
import { PinsProvider } from './state/pins';
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
      <PinsProvider>
        <ScrollManager />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="ask" element={<Ask />} />
            <Route path="answer/lead-sources" element={<Answer />} />
            <Route path="thread/monday" element={<Thread />} />
            <Route path="board" element={<Board />} />
            <Route path="states" element={<States />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PinsProvider>
    </ToastProvider>
  );
}
