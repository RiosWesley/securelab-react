// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import App from './App.jsx'
import './styles/styles.css'
import './styles/dark-mode.css';
import './styles/utils.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/mobile.css';
import './styles/devices.css'; // Added
import './styles/logs.css';


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ThemeProvider> {/* Wrap App with ThemeProvider */}
                <App />
            </ThemeProvider>
        </BrowserRouter>
    </React.StrictMode>,
);