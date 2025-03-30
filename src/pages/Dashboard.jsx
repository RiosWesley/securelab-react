// src/pages/Dashboard.jsx

// Import React and hooks
import React, { useState, useEffect, useCallback } from 'react';

// Import Layout and other components/utils
import Layout from '../components/Layout';
import ActivityChart from '../components/ActivityChart'; // Assuming this exists and works now
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers, faDoorOpen, faMicrochip, faKey, faArrowUp, faArrowDown,
    faLock, faLockOpen, faSyncAlt, faExclamationTriangle // Added icons used in the component
} from '@fortawesome/free-solid-svg-icons';
import { ref, onValue, update, push, get, query, orderByChild, limitToLast, equalTo, off } from 'firebase/database'; // Added 'off'
import { database, auth } from '../firebase/firebaseConfig';
import { formatDateTime, getStatusClass, formatStatus } from '../utils/formatters';
import { showNotification } from '../utils/notifications';
import GeminiInsights from '../components/GeminiInsights'; // Import GeminiInsights

// Placeholder components if not fully implemented yet
function DevicePerformancePlaceholder() {
    return (
        <div className="benchmark-container" style={{ border: '1px dashed #ccc', padding: '20px', color: '#999', minHeight: '250px' }}>
            (Performance dos Dispositivos - Implementar)
            <h4 className="benchmark-title">Dispositivo Mais Sobrecarregado</h4>
            {/* Basic structure */}
            <div className="benchmark-metrics" style={{opacity: 0.5}}>
                <div className="benchmark-item"> <div className="benchmark-label"> CPU</div> <div className="benchmark-bar-container"> <div className="benchmark-bar" style={{width: '10%'}}></div> <div className="benchmark-value">10%</div> </div> </div>
                <div className="benchmark-item"> <div className="benchmark-label"> RAM</div> <div className="benchmark-bar-container"> <div className="benchmark-bar" style={{width: '30%'}}></div> <div className="benchmark-value">30%</div> </div> </div>
            </div>
        </div>
    );
}
function InsightsPlaceholder() {
    return (
        <div id="gemini-insights-container" style={{ border: '1px dashed #ccc', padding: '20px', color: '#999', height: '100%', minHeight: '250px' }}>
            (Painel de Insights Gemini - Implementar)
        </div>
    );
}


function Dashboard() {
    // State declarations
    const [stats, setStats] = useState({
        activeUsers: 0, totalUsers: 0, doorsCount: 0, lockedDoors: 0, unlockedDoors: 0,
        onlineDevices: 0, totalDevices: 0, devicesPercentage: 0, todayAccess: 0, todayDenied: 0,
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [doorStatusList, setDoorStatusList] = useState([]);
    const [loading, setLoading] = useState(true); // Combined loading state

    // --- Data Fetching and Listeners ---
    useEffect(() => {
        setLoading(true);
        const listeners = []; // Array to store listener details for cleanup

        // --- Fetch Users ---
        const usersRef = ref(database, 'users');
        const usersCallback = (snapshot) => {
            const usersData = snapshot.val();
            if (usersData) {
                const userCount = Object.keys(usersData).length;
                const activeUsers = Object.values(usersData).filter(user => user.status === 'active').length;
                setStats(prev => ({ ...prev, activeUsers, totalUsers: userCount }));
            } else {
                setStats(prev => ({ ...prev, activeUsers: 0, totalUsers: 0 }));
            }
        };
        const usersErrorCallback = (error) => console.error("Error fetching users:", error);
        onValue(usersRef, usersCallback, usersErrorCallback); // Attach listener
        listeners.push({ ref: usersRef, callback: usersCallback }); // Store details

        // --- Fetch Doors ---
        const doorsRef = ref(database, 'doors');
        const doorsCallback = (snapshot) => {
            const doorsData = snapshot.val();
            const doorsArray = [];
            let locked = 0, unlocked = 0;
            if (doorsData) {
                Object.entries(doorsData).forEach(([id, door]) => {
                    doorsArray.push({ id, ...door });
                    if (door.status === 'locked') locked++; else unlocked++;
                });
                doorsArray.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            }
            setStats(prev => ({ ...prev, doorsCount: doorsArray.length, lockedDoors: locked, unlockedDoors: unlocked }));
            setDoorStatusList(doorsArray);
        };
        const doorsErrorCallback = (error) => console.error("Error fetching doors:", error);
        onValue(doorsRef, doorsCallback, doorsErrorCallback);
        listeners.push({ ref: doorsRef, callback: doorsCallback });

        // --- Fetch Devices ---
        const devicesRef = ref(database, 'devices');
        const devicesCallback = (snapshot) => {
            const devicesData = snapshot.val();
            let online = 0, total = 0, percentage = 0;
            if (devicesData) {
                total = Object.keys(devicesData).length;
                online = Object.values(devicesData).filter(d => d.status === 'online' || d.status === 'warning').length; // Include warning as online
                percentage = total > 0 ? Math.round((online / total) * 100) : 0;
            }
            setStats(prev => ({ ...prev, onlineDevices: online, totalDevices: total, devicesPercentage: percentage }));
        };
        const devicesErrorCallback = (error) => console.error("Error fetching devices:", error);
        onValue(devicesRef, devicesCallback, devicesErrorCallback);
        listeners.push({ ref: devicesRef, callback: devicesCallback });

        // --- Fetch Recent Activity (using get) ---
        const logsRef = ref(database, 'access_logs');
        let logsFetched = false; // Flag to set loading false only once
        get(query(logsRef, orderByChild('timestamp'), limitToLast(7)))
            .then((snapshot) => {
                const logsData = snapshot.val();
                const activity = [];
                let todayAccess = 0, todayDenied = 0;
                const todayStr = new Date().toISOString().split('T')[0];
                if (logsData) {
                    Object.entries(logsData).forEach(([id, log]) => {
                        activity.push({ id, ...log });
                        if (log.timestamp && log.timestamp.startsWith(todayStr)) {
                            todayAccess++;
                            if (log.action === 'access_denied') todayDenied++;
                        }
                    });
                    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }
                setStats(prev => ({ ...prev, todayAccess, todayDenied }));
                setRecentActivity(activity);
            })
            .catch(error => console.error("Error fetching logs:", error))
            .finally(() => {
                logsFetched = true;
                // Set loading to false only if all listeners have likely fired at least once
                // This is tricky with onValue; maybe just set loading false here for simplicity
                setLoading(false);
            });

        // --- Cleanup Function ---
        return () => {
            console.log("Cleaning up dashboard listeners...");
            listeners.forEach(listener => {
                // Use the imported 'off' function
                off(listener.ref, 'value', listener.callback);
                console.log(`Listener removed for ref path: ${listener.ref.toString()}`);
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // --- Action Handlers ---
    const toggleDoorLock = async (doorId, currentStatus) => {
        if (!doorId) return;
        const newStatus = currentStatus === 'locked' ? 'unlocked' : 'locked';
        const doorRef = ref(database, `doors/${doorId}`);
        const user = auth.currentUser;
        let doorName = doorStatusList.find(d => d.id === doorId)?.name || 'Porta';
        let userName = user?.displayName || user?.email || 'Sistema';

        if (user && !user.displayName && user.email) {
            const usersRef = ref(database, 'users');
            const userQuery = query(usersRef, orderByChild('email'), equalTo(user.email));
            try {
                const snapshot = await get(userQuery);
                if (snapshot.exists()) {
                    const userData = Object.values(snapshot.val())[0];
                    userName = userData?.name || userName;
                }
            } catch (err) { console.error("Error fetching username for log", err); }
        }

        // Indicate loading state for this specific action if needed (e.g., disable button)
        // setLoading(true); // Or a specific loading state for the button

        try {
            await update(doorRef, {
                status: newStatus,
                last_status_change: new Date().toISOString()
            });

            if (user) {
                const logData = {
                    user_id: user.uid, user_name: userName, door_id: doorId, door_name: doorName,
                    action: newStatus === 'locked' ? 'door_locked' : 'access_granted',
                    method: 'web', timestamp: new Date().toISOString()
                };
                await push(ref(database, 'access_logs'), logData);
            }
            showNotification(`Porta ${formatStatus(newStatus).toLowerCase()} com sucesso!`, 'success');
        } catch (error) {
            console.error("Error toggling door lock:", error);
            showNotification(`Erro ao ${newStatus === 'locked' ? 'trancar' : 'destrancar'} porta: ${error.message}`, 'error');
        } finally {
            // setLoading(false); // Reset loading state if used
        }
    };

    // --- Refresh Handlers ---
    const refreshActivity = () => {
        // setLoading(true); // Optionally show loading
        const logsRef = ref(database, 'access_logs');
        get(query(logsRef, orderByChild('timestamp'), limitToLast(7)))
            .then((snapshot) => {
                const logsData = snapshot.val();
                const activity = [];
                let todayAccess = 0, todayDenied = 0;
                const todayStr = new Date().toISOString().split('T')[0];
                if (logsData) {
                    Object.entries(logsData).forEach(([id, log]) => {
                        activity.push({ id, ...log });
                        if(log.timestamp && log.timestamp.startsWith(todayStr)) {
                            todayAccess++;
                            if (log.action === 'access_denied') todayDenied++;
                        }
                    });
                    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }
                setStats(prev => ({ ...prev, todayAccess, todayDenied }));
                setRecentActivity(activity);
                showNotification("Atividade recente atualizada.", "info");
            })
            .catch(error => {console.error("Error refreshing logs:", error); showNotification("Erro ao atualizar atividade.", "error");})
        // .finally(() => setLoading(false)); // Reset loading state
    };
    const refreshDoors = () => showNotification("Status das portas atualizado em tempo real.", "info");
    const refreshDeviceStats = () => showNotification("Status dos dispositivos atualizado em tempo real.", "info");


    // --- JSX Rendering ---
    return (
        <Layout>
            <div className="page-header">
                <h1>Dashboard</h1>
            </div>

            {loading && <div className="text-center p-5">Carregando dados do dashboard...</div>}

            {!loading && (
                <>
                    {/* Status Cards */}
                    <div className="card-grid">
                        {/* Users Card */}
                        <div className="status-card">
                            <div className="status-card-header">
                                <h3>Usuários</h3> <FontAwesomeIcon icon={faUsers} className="card-icon" />
                            </div>
                            <div className="status-card-body">
                                <div className="status-count">{stats.activeUsers}</div>
                                <div className="status-label">de {stats.totalUsers} usuários ativos</div>
                            </div>
                            <div className="status-card-footer">
                                <span className="status-trend positive"><FontAwesomeIcon icon={faArrowUp} /> {/* Trend data? */}</span>
                                <span className="status-period">desde mês passado</span>
                            </div>
                        </div>
                        {/* Doors Card */}
                        <div className="status-card">
                            <div className="status-card-header">
                                <h3>Portas</h3> <FontAwesomeIcon icon={faDoorOpen} className="card-icon" />
                            </div>
                            <div className="status-card-body">
                                <div className="status-count">{stats.doorsCount}</div>
                                <div className="status-label">Total de portas</div>
                            </div>
                            <div className="status-card-footer">
                                <div className="door-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> {/* Added styles for better spacing */}
                                    {/* Corrected dot/status logic based on CSS */}
                                    <span className="status-dot locked" style={{ backgroundColor: 'var(--success-color)' }}></span> {/* Example color */}
                                    <span style={{ marginRight: '5px' }}>{stats.lockedDoors} Trancadas</span>
                                    <span className="status-dot unlocked" style={{ backgroundColor: 'var(--danger-color)' }}></span> {/* Example color */}
                                    <span>{stats.unlockedDoors} Destrancadas</span>
                                </div>
                            </div>
                        </div>
                        {/* Devices Card */}
                        <div className="status-card">
                            <div className="status-card-header">
                                <h3>Dispositivos</h3> <FontAwesomeIcon icon={faMicrochip} className="card-icon" />
                            </div>
                            <div className="status-card-body">
                                <div className="status-count">{stats.onlineDevices}/{stats.totalDevices}</div>
                                <div className="status-label">Online</div>
                            </div>
                            <div className="status-card-footer">
                                <div className="progress-bar"><div className="progress" style={{ width: `${stats.devicesPercentage}%` }}></div></div>
                                <span>{stats.devicesPercentage}% online</span>
                            </div>
                        </div>
                        {/* Access Today Card */}
                        <div className="status-card">
                            <div className="status-card-header">
                                <h3>Acessos Hoje</h3> <FontAwesomeIcon icon={faKey} className="card-icon" />
                            </div>
                            <div className="status-card-body">
                                <div className="status-count">{stats.todayAccess}</div>
                                <div className="status-label">{stats.todayDenied} negados</div>
                            </div>
                            <div className="status-card-footer">
                                <span className="status-trend positive"><FontAwesomeIcon icon={faArrowUp} /> {/* Trend data? */}</span>
                                <span className="status-period">vs ontem</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart Row */}
                    <div className="chart-fullwidth">
                        <div className="card chart-card">
                            <div className="card-header">
                                <h3>Atividade Diária (Últimos 7 dias)</h3>
                            </div>
                            <div className="card-body">
                                <ActivityChart /> {/* Use the chart component */}
                            </div>
                        </div>
                    </div>

                    {/* Activity and Doors Row */}
                    <div className="card-row">
                        {/* Recent Activity */}
                        <div className="card activity-card">
                            <div className="card-header">
                                <h3>Atividade Recente</h3>
                                <div className="card-actions">
                                    <button className="icon-button" onClick={refreshActivity} title="Atualizar Atividade">
                                        <FontAwesomeIcon icon={faSyncAlt} />
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <ul className="activity-list">
                                    {recentActivity.length > 0 ? (
                                        recentActivity.map(log => (
                                            <li key={log.id}>
                                                <div className={`activity-icon ${getStatusClass(log.action)}`}>
                                                    <FontAwesomeIcon icon={
                                                        log.action === 'access_denied' ? faExclamationTriangle :
                                                            log.action === 'door_locked' ? faLock :
                                                                log.action === 'door_unlocked' ? faLockOpen :
                                                                    faKey // Default icon
                                                    } />
                                                </div>
                                                <div className="activity-info">
                                                    <div className="activity-title">
                                                        <span className="user-name">{log.user_name || 'Desconhecido'}</span>
                                                        <span className={`ml-2 ${getStatusClass(log.action)}-text`}>{formatStatus(log.action)}</span>
                                                    </div>
                                                    <div className="activity-details">
                                                        {log.door_name || 'Porta Desconhecida'} - {formatDateTime(log.timestamp)}
                                                    </div>
                                                    {log.reason && <div className="activity-reason">Motivo: {log.reason}</div>}
                                                </div>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="no-data">Nenhuma atividade recente</li>
                                    )}
                                </ul>
                                <div className="card-actions center">
                                    <a href="/logs" className="btn btn-link">Ver todos os logs</a>
                                </div>
                            </div>
                        </div>

                        {/* Door Status */}
                        <div className="card door-status-card">
                            <div className="card-header">
                                <h3>Status das Portas</h3>
                                <div className="card-actions">
                                    <button className="icon-button" onClick={refreshDoors} title="Atualizar Portas">
                                        <FontAwesomeIcon icon={faSyncAlt} />
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <ul className="door-list">
                                    {doorStatusList.length > 0 ? (
                                        doorStatusList.map(door => (
                                            <li key={door.id}>
                                                <div className="door-info">
                                                    <div className="door-name">{door.name || 'Sem Nome'}</div>
                                                    <div className="door-location">{door.location || '-'}</div>
                                                </div>
                                                <div className={`door-status ${door.status === 'locked' ? 'locked' : 'unlocked'}`}>
                                                    <FontAwesomeIcon icon={door.status === 'locked' ? faLock : faLockOpen} />
                                                    <span style={{ marginLeft: '5px' }}>{formatStatus(door.status)}</span>
                                                </div>
                                                <div className="door-action">
                                                    <button
                                                        className={`btn btn-sm ${door.status === 'locked' ? 'btn-success' : 'btn-danger'}`} // Green to unlock, Red to lock
                                                        onClick={() => toggleDoorLock(door.id, door.status)}
                                                    >
                                                        {door.status === 'locked' ? 'Destrancar' : 'Trancar'}
                                                    </button>
                                                </div>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="no-data">Nenhuma porta encontrada</li>
                                    )}
                                </ul>
                                <div className="card-actions center">
                                    <a href="/doors" className="btn btn-link">Gerenciar Portas</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Device Performance and Insights Row */}
                    <div className="card-row">
                        {/* Device Performance */}
                        <div className="card device-status-card">
                            <div className="card-header">
                                <h3>Performance dos Dispositivos</h3>
                                <div className="card-actions">
                                    <button className="icon-button" onClick={refreshDeviceStats} title="Atualizar Status Dispositivos">
                                        <FontAwesomeIcon icon={faSyncAlt} />
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <DevicePerformancePlaceholder /> {/* Placeholder */}
                                <div className="card-actions center">
                                    <a href="/devices" className="btn btn-link">Ver Dispositivos</a>
                                </div>
                            </div>
                        </div>

                        {/* Insights Card */}
                        <div className="card insights-card">
                            {/* Remove padding from card-body if GeminiInsights handles its own */}
                            <div className="card-body p-0">
                                <GeminiInsights /> {/* Use the actual component */}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}

export default Dashboard;
