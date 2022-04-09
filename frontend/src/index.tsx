import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import RouterView from './router/RouterView';
import log from '@middleware/logger';
import reportWebVitals from './reportWebVitals';
import '@i18n/i18n';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <RouterView />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(log.info);
