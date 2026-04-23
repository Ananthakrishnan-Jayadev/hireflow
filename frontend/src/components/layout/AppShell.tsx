import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { GlobalHeader } from './GlobalHeader';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <GlobalHeader />
      <div className="main-row">
        {sidebarOpen && (
          <div
            className="sidebar-overlay visible"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div id="sidebar-container">
          <Sidebar open={sidebarOpen} />
        </div>

        <div className="main-area">
          <header className="mobile-header">
            <button
              className="btn-icon"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', padding: 8 }}
            >
              <Menu size={20} />
            </button>
            <img src="/assets/logo.svg" alt="HireFlow" className="mobile-logo-img" />
          </header>

          <main className="content-area">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
