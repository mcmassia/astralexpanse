// Main App component
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useObjectStore } from './stores/objectStore';
import { useUIStore } from './stores/uiStore';
import { useDriveStore } from './stores/driveStore';
import { Sidebar } from './components/Sidebar';
import { ObjectView } from './components/ObjectView';
import { Calendar } from './components/Calendar';
import { MiniCalendar } from './components/Calendar/MiniCalendar';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider } from './components/common';
import { getGoogleAccessTokenExpiration } from './services/firebase';
import './index.css';

function App() {
  const { user, isLoading: authLoading, error: authError, signIn, initialize: initAuth } = useAuthStore();
  const { isLoading: objectsLoading, initialize: initObjects } = useObjectStore();
  const { theme, openCommandPalette, commandPaletteOpen, currentSection, calendarSidebarOpen, toggleCalendarSidebar } = useUIStore();
  const setTokenExpiration = useDriveStore((s) => s.setTokenExpiration);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, [initAuth]);

  // Initialize objects and Drive state when user is authenticated
  useEffect(() => {
    if (user) {
      initObjects();

      // Initialize Drive token expiration from stored value
      const expiresAt = getGoogleAccessTokenExpiration();
      if (expiresAt) {
        setTokenExpiration(expiresAt);
      }
    }
  }, [user, initObjects, setTokenExpiration]);

  // Apply theme
  useEffect(() => {
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [theme]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (unless command palette)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K or Ctrl+K: Open quick search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!commandPaletteOpen) {
          openCommandPalette('quick');
        }
        return;
      }

      // Cmd+Shift+P or Ctrl+Shift+P: Open extended search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        openCommandPalette('extended');
        return;
      }

      // Don't process other shortcuts if in an input
      if (isInput) return;

      // Cmd+Shift+F or Ctrl+Shift+F: Open extended search (alternative)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        openCommandPalette('extended');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette, commandPaletteOpen]);

  // Loading state
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">✦</div>
          <h1 className="login-title">Astral Expanse</h1>
          <p className="login-subtitle">
            Tu espacio para conectar ideas y conocimiento
          </p>
          <button className="login-btn" onClick={signIn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Iniciar sesión con Google
          </button>
          {authError && <div className="login-error">{authError}</div>}
        </div>
      </div>
    );
  }

  // Render main content based on current section
  const renderContent = () => {
    if (objectsLoading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
        </div>
      );
    }

    switch (currentSection) {
      case 'calendar':
        return <Calendar />;
      case 'objects':
      default:
        return <ObjectView />;
    }
  };

  // Main app
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="app-main">
          {renderContent()}
        </main>

        {/* Global Calendar Sidebar - Always visible, collapsible */}
        <aside className={`app-calendar-sidebar ${calendarSidebarOpen ? 'open' : 'collapsed'}`}>
          <MiniCalendar
            collapsed={!calendarSidebarOpen}
            onToggle={toggleCalendarSidebar}
          />
        </aside>

        {/* Command Palette */}
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}

export default App;

