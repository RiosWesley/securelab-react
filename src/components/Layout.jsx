// src/components/Layout.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import GeminiChatPopup from './GeminiChatPopup'; // Import the new chat popup
// Import Mobile Overlay if needed as a separate component or handle via CSS

function Layout({ children }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleSidebar = () => {
        // Only toggle for desktop view
        if (window.innerWidth > 768) {
            setIsSidebarCollapsed(!isSidebarCollapsed);
        }
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    // Combine classes for the main container
    const appContainerClasses = [
        'app-container',
        isSidebarCollapsed ? 'sidebar-collapsed' : '',
        isMobileMenuOpen ? 'show-mobile-menu' : ''
    ].filter(Boolean).join(' '); // Filter out empty strings and join

    return (
        <div className={appContainerClasses}>
            <Sidebar isCollapsed={isSidebarCollapsed} />

            {/* Mobile Overlay - closes menu on click */}
            {isMobileMenuOpen && <div className="mobile-overlay" onClick={closeMobileMenu}></div>}

            <main className="main-content">
                <Header
                    onToggleSidebar={toggleSidebar}
                    onToggleMobileMenu={toggleMobileMenu}
                />
                <div className="content-wrapper">
                    {children} {/* This is where the page content will be rendered */}
                </div>
            </main>

            {/* Render Gemini Chat Popup here so it floats above main content */}
            <GeminiChatPopup />
        </div>
    );
}

export default Layout;
