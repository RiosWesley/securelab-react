// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBars } from '@fortawesome/free-solid-svg-icons';
import { auth, database } from '../firebase/firebaseConfig';
import { ref, onValue, query, orderByChild, equalTo, get } from 'firebase/database';
import ThemeToggleButton from './ThemeToggleButton';
// Import theme switcher logic if needed, or manage theme in Layout/Context
// import { toggleTheme } from '../utils/theme'; // Assuming theme logic is moved

function Header({ onToggleSidebar, onToggleMobileMenu }) {
    const [userName, setUserName] = useState('Usuário');
    const [alertsCount, setAlertsCount] = useState(0);
    const [user, setUser] = useState(auth.currentUser);

    // Listen for auth changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            setUser(currentUser);
            if (!currentUser) {
                setUserName('Usuário'); // Reset on logout
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch user name
    useEffect(() => {
        if (user && user.email) {
            const usersRef = ref(database, 'users');
            // Use query to find user by email
            const userQuery = query(usersRef, orderByChild('email'), equalTo(user.email));

            get(userQuery).then(snapshot => {
                if (snapshot.exists()) {
                    // Firebase returns an object even for queries, get the first entry
                    const userData = Object.values(snapshot.val())[0];
                    if (userData && userData.name) {
                        setUserName(userData.name);
                    } else {
                        setUserName(user.displayName || user.email.split('@')[0]); // Fallback
                    }
                } else {
                    setUserName(user.displayName || user.email.split('@')[0]); // Fallback if not in DB
                }
            }).catch(error => {
                console.error("Error fetching user name:", error);
                setUserName(user.displayName || user.email.split('@')[0]); // Fallback on error
            });

        } else {
            setUserName('Usuário'); // Reset if no user
        }
    }, [user]); // Re-run when user object changes

    // Fetch alerts count (example: offline devices)
    useEffect(() => {
        const devicesRef = ref(database, 'devices');
        const unsubscribe = onValue(devicesRef, (snapshot) => {
            const devicesData = snapshot.val();
            let offlineCount = 0;
            if (devicesData) {
                offlineCount = Object.values(devicesData).filter(d => d.status === 'offline').length;
            }
            setAlertsCount(offlineCount);
        }, (error) => {
            console.error("Error fetching alerts count:", error);
            setAlertsCount(0); // Reset on error
        });

        return () => unsubscribe(); // Cleanup listener
    }, []);


    return (
        <header className="main-header">
            {/* Mobile Menu Toggle (conditionally rendered based on screen size in Layout/CSS) */}
            <button className="icon-button mobile-menu-toggle" aria-label="Toggle Mobile Menu" onClick={onToggleMobileMenu}>
                <FontAwesomeIcon icon={faBars} />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button id="sidebar-toggle" className="icon-button sidebar-toggle-desktop" aria-label="Toggle Sidebar" onClick={onToggleSidebar}>
                <FontAwesomeIcon icon={faBars} />
            </button>

            {/* Optional Search Bar - Add input if needed */}
            {/* <div className="header-search">
                <i className="fas fa-search"></i> {}
                <input type="text" placeholder="Search..." />
            </div> */}

            {/* Spacer element to push right items to the end */}
            <div style={{ flexGrow: 1 }}></div>

            {/* Right-aligned items */}
            <div className="header-right">
                <ThemeToggleButton /> {/* Theme toggle button */}

                <div className="notifications">
                    <button className="icon-button" title="Alertas">
                        <FontAwesomeIcon icon={faBell} />
                        {alertsCount > 0 && <span className="badge">{alertsCount}</span>}
                    </button>
                    {/* Notification dropdown can be implemented here */}
                </div>

                <div className="user-menu">
                    <span className="user-name">{userName}</span>
                    {/* User dropdown menu can be implemented here */}
                    {/* Example: <img src={userAvatarUrl} alt="User Avatar" className="avatar" /> */}
                </div>
            </div>
        </header>
    );
}

export default Header;
