import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ModalProvider } from './contexts/ModalContext';
import { ToastContainer } from './components/ui/Toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ModalProvider>
        <App />
        <ToastContainer />
      </ModalProvider>
    </AuthProvider>
  </React.StrictMode>,
);
