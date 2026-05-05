import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { UIPreferencesProvider } from './context/UIPreferencesContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <UIPreferencesProvider>
        <App />
      </UIPreferencesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
