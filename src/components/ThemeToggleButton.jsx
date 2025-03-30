// src/components/ThemeToggleButton.jsx
import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

function ThemeToggleButton() {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <button
            id="theme-toggle"
            className="icon-button" // Use existing style
            onClick={toggleTheme}
            title={`Alternar para tema ${isDarkMode ? 'claro' : 'escuro'}`}
            aria-label="Alternar tema"
        >
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} />
        </button>
    );
}

export default ThemeToggleButton;