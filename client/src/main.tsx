import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LifeLensProvider } from './hooks/useLifeLens';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LifeLensProvider>
      <App />
    </LifeLensProvider>
  </React.StrictMode>,
);
