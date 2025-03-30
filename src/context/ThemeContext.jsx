// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const THEME_STORAGE_KEY = 'securelab-theme';
// const DARK_MODE_CLASS = 'dark-mode'; // No longer using class

const ThemeContext = createContext({
    theme: 'light',
    toggleTheme: () => {},
    isDarkMode: false,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState('light'); // Default theme

    // Function to apply theme to the document
    // Function to apply theme to the document using data-theme attribute
    const applyTheme = useCallback((selectedTheme) => {
        setTheme(selectedTheme);
        document.documentElement.setAttribute('data-theme', selectedTheme); // Set the attribute
        localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
        // Dispatch event for chart updates etc. if needed, or components can useTheme()
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: selectedTheme } }));
        console.log("Theme applied:", selectedTheme);
    }, []);


    // Load initial theme on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            applyTheme(savedTheme);
        } else if (prefersDark) {
            applyTheme('dark');
        } else {
            applyTheme('light'); // Default
        }

        // Listener for system preference changes ONLY if no theme is saved
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            // Only apply system preference if user hasn't manually set one
            if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);

    }, [applyTheme]); // Include applyTheme in dependency array


    const toggleTheme = useCallback(() => {
        applyTheme(theme === 'light' ? 'dark' : 'light');
    }, [theme, applyTheme]);

    const isDarkMode = theme === 'dark';

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};
