import React from 'react';
import { createRoot } from 'react-dom/client';
import { CareerPage } from './src/pages/Career';
import './src/styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CareerPage />
  </React.StrictMode>,
);
