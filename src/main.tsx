import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Hash routing keeps deep links working when the PWA is opened from the
        home screen or served from a static folder without a rewrite rule.
        v7_startTransition lets the lazily-loaded routes suspend on navigation
        without React warning about a synchronous update. */}
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </React.StrictMode>
);
