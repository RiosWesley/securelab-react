// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTachometerAlt, faDoorOpen, faUsers, faMicrochip, faClipboardList, faCog, faSignOutAlt, faShieldAlt, faBars, faArrowLeft // Added faBars and faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

// Re-implement logout logic here or pass down from Layout
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

function Sidebar({ isCollapsed, onToggleSidebar }) { // Receive onToggleSidebar
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login'); // Redirect after logout
        } catch (error) {
            console.error("Logout failed:", error);
            // Consider showing a notification to the user
        }
    };

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="logo">
                    <FontAwesomeIcon icon={faShieldAlt} />
                    {!isCollapsed && <span>SecureLab</span>}
                </div>
                {/* Add Toggle Button Here */}
                <button
                    className="icon-button sidebar-toggle-button" // Added class for styling
                    aria-label={isCollapsed ? "Expandir Sidebar" : "Recolher Sidebar"}
                    onClick={onToggleSidebar}
                >
                    <FontAwesomeIcon icon={isCollapsed ? faBars : faArrowLeft} />
                </button>
            </div>
            <nav className="sidebar-nav">
                <ul>
                    <li>
                        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faTachometerAlt} title={isCollapsed ? "Dashboard" : ""} />
                            {!isCollapsed && <span>Dashboard</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/doors" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faDoorOpen} title={isCollapsed ? "Portas" : ""} />
                            {!isCollapsed && <span>Portas</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/users" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faUsers} title={isCollapsed ? "Usuários" : ""} />
                            {!isCollapsed && <span>Usuários</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/devices" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faMicrochip} title={isCollapsed ? "Dispositivos" : ""} />
                            {!isCollapsed && <span>Dispositivos</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/logs" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faClipboardList} title={isCollapsed ? "Logs de Acesso" : ""}/>
                            {!isCollapsed && <span>Logs de Acesso</span>}
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}>
                            <FontAwesomeIcon icon={faCog} title={isCollapsed ? "Configurações" : ""} />
                            {!isCollapsed && <span>Configurações</span>}
                        </NavLink>
                    </li>
                </ul>
            </nav>
            <div className="sidebar-footer">
                <a href="#" onClick={handleLogout} title={isCollapsed ? "Sair" : ""}>
                    <FontAwesomeIcon icon={faSignOutAlt} />
                    {!isCollapsed && <span>Sair</span>}
                </a>
            </div>
        </aside>
    );
}

export default Sidebar;
