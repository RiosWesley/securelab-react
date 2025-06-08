// src/pages/Logs.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClipboardList, faSyncAlt, faDownload, faFileCsv, faFilePdf, faFilter,
    // Icons used in the list rendering:
    faDoorOpen, faClock, faUser, // Assumed faUser might be needed, adjust if not
    faIdCard, faGlobe, faMobileAlt, faQuestion, // Method Icons
    faCheckCircle, faTimesCircle, faLock, faLockOpen // Action Icons (Add others if used)
} from '@fortawesome/free-solid-svg-icons';
import { ref, onValue, get, query, orderByChild, limitToLast, startAt, endAt, off } from 'firebase/database';
import { database } from '../firebase/firebaseConfig';
import { showNotification } from '../utils/notifications';
import { formatDateTime, getStatusClass, formatStatus } from '../utils/formatters'; // Assuming formatters handle action text
import '../styles/logs.css'; // Import log-specific styles

const PAGE_SIZE = 15; // Logs often have more entries per page

function Logs() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Filters State
    const [filters, setFilters] = useState({
        dateRange: 'last7days', // Default range
        action: '',
        method: '',
        user: '',
        door: '',
        startDate: '',
        startTime: '00:00',
        endDate: '',
        endTime: '23:59'
    });
    const [showCustomDates, setShowCustomDates] = useState(false);

    // --- Data Fetching & Filtering ---

    const loadLogs = useCallback(() => {
        setLoading(true);
        const logsRef = ref(database, 'access_logs');

        // Query para buscar os últimos 1000 logs
        const logQuery = query(logsRef, orderByChild('timestamp'), limitToLast(1000));

        // Usar onValue para atualização em tempo real
        const unsubscribe = onValue(logQuery, 
            (snapshot) => {
                const logsData = snapshot.val();
                let logsArray = [];
                if (logsData) {
                    logsArray = Object.entries(logsData).map(([id, log]) => ({ id, ...log }));
                }
                // Sort by timestamp descending (most recent first)
                logsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setLogs(logsArray);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading logs:", error);
                showNotification("Erro ao carregar logs: " + error.message, 'error');
                setLoading(false);
            }
        );

        // Retornar função de limpeza para o useEffect
        return unsubscribe;

    }, []); // Removido filters da dependência pois não afeta a query

    useEffect(() => {
        const unsubscribe = loadLogs();
        
        // Cleanup function para remover listener
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [loadLogs]);

    // Client-side filtering effect
    useEffect(() => {
        const { startDateTimestamp, endDateTimestamp } = calculateTimestamps(filters);
        const lowerUser = filters.user.toLowerCase();
        const lowerDoor = filters.door.toLowerCase();
        const lowerMethod = filters.method.toLowerCase();

        const result = logs.filter(log => {
            const logTimestamp = new Date(log.timestamp).getTime();

            // Date Filter
            if (logTimestamp < startDateTimestamp || logTimestamp > endDateTimestamp) return false;
            // Action Filter
            if (filters.action && log.action !== filters.action) return false;
            // Method Filter
            if (lowerMethod && (log.method?.toLowerCase() || '') !== lowerMethod) return false;
            // User Filter
            if (lowerUser && !(log.user_name?.toLowerCase() || '').includes(lowerUser)) return false;
            // Door Filter
            if (lowerDoor && !(log.door_name?.toLowerCase() || '').includes(lowerDoor)) return false;

            return true;
        });

        setFilteredLogs(result);
        setCurrentPage(1); // Reset page when filters change

    }, [logs, filters]); // Re-filter when logs or filters change


    // --- Helper to Calculate Timestamps ---
    const calculateTimestamps = (currentFilters) => {
        let start, end;
        const now = new Date();
        end = new Date(now); // End is usually now or end of today
        end.setHours(23, 59, 59, 999);

        switch (currentFilters.dateRange) {
            case 'today':
                start = new Date(now); start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
                end = new Date(start); end.setHours(23, 59, 59, 999); // End of yesterday
                break;
            case 'last7days':
                start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); // Includes today
                break;
            case 'last30days':
                start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); // Includes today
                break;
            case 'custom':
                const startDateStr = currentFilters.startDate || new Date(0).toISOString().split('T')[0]; // Default to epoch if empty
                const startTimeStr = currentFilters.startTime || '00:00';
                const endDateStr = currentFilters.endDate || new Date().toISOString().split('T')[0]; // Default to today if empty
                const endTimeStr = currentFilters.endTime || '23:59';
                try {
                    start = new Date(`${startDateStr}T${startTimeStr}:00`);
                    end = new Date(`${endDateStr}T${endTimeStr}:59`);
                    // Basic validation: end date should not be before start date
                    if (end < start) {
                        end = new Date(start); // Set end to start if invalid range
                        end.setHours(23, 59, 59, 999);
                        showNotification("Data final não pode ser anterior à data inicial.", "warning");
                    }
                } catch (e) {
                    console.error("Invalid custom date format", e);
                    start = new Date(0); // Fallback
                    end = new Date(); end.setHours(23, 59, 59, 999); // Fallback
                }
                break;
            default: // 'all' or invalid
                start = new Date(0); // Epoch
                break;
        }
        return { startDateTimestamp: start.getTime(), endDateTimestamp: end.getTime() };
    };


    // --- Event Handlers ---
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        const newFilters = { ...filters, [name]: value };

        if (name === 'dateRange') {
            setShowCustomDates(value === 'custom');
            if(value !== 'custom') {
                // Trigger reload/refilter immediately for non-custom ranges
                setFilters(newFilters); // Update state to trigger effect
                // loadLogs(); // Or just rely on the effect below
            } else {
                // Just update state for custom, wait for Apply button
                setFilters(newFilters);
            }
        } else {
            setFilters(newFilters);
        }
        // For instant filtering on select changes (except custom date range)
        // if(name !== 'startDate' && name !== 'startTime' && name !== 'endDate' && name !== 'endTime' && name !== 'dateRange') {
        //    applyFilters(); // Or rely on useEffect
        // }
    };

    // Handler for the Apply Filters button (mainly for custom date range)
    const applyFiltersManually = () => {
        // The useEffect hook already handles filtering when `filters` state changes.
        // This button primarily confirms the custom date range selection.
        console.log("Applying filters manually (likely confirming custom dates)");
        // Optionally force a reload if `loadLogs` depends on filters for querying
        // loadLogs();
    };


    const resetFilters = () => {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        setFilters({
            dateRange: 'last7days', action: '', method: '', user: '', door: '',
            startDate: sevenDaysAgoStr, startTime: '00:00', endDate: today, endTime: '23:59'
        });
        setShowCustomDates(false);
        // Reset select elements visually
        document.getElementById('date-range').value = 'last7days';
        document.getElementById('filter-action').value = '';
        document.getElementById('filter-method').value = '';
        document.getElementById('filter-user').value = '';
        document.getElementById('filter-door').value = '';
        // Reset custom date inputs
        document.getElementById('start-date').value = sevenDaysAgoStr;
        document.getElementById('start-time').value = '00:00';
        document.getElementById('end-date').value = today;
        document.getElementById('end-time').value = '23:59';
    };

    const handlePageChange = (page) => setCurrentPage(page);

    // Função de atualização manual (agora apenas mostra notificação já que está em tempo real)
    const handleManualRefresh = () => {
        showNotification("Os logs são atualizados automaticamente em tempo real.", "info");
    };

    const exportLogsHandler = (format) => {
        if (filteredLogs.length === 0) return showNotification('Não há logs para exportar', 'warning');
        showNotification(`Exportando ${filteredLogs.length} logs para ${format.toUpperCase()}...`, 'info');
        console.log(`TODO: Implement ${format} export for logs`);
        // Example CSV Export
        if(format === 'csv') {
            const headers = ["Data/Hora", "Usuário", "Porta", "Ação", "Método", "Motivo"];
            const rows = filteredLogs.map(log => [
                formatDateTime(log.timestamp),
                log.user_name || 'Desconhecido',
                log.door_name || 'Desconhecida',
                formatStatus(log.action), // Use formatter for action text
                log.method || 'N/A',
                log.reason || ''
            ]);
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().substring(0, 10);
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `securelab_logs_${timestamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
        } else {
            showNotification('Exportação PDF ainda não implementada.', 'warning');
        }
        setIsExportMenuOpen(false);
    };

    // Get Method Icon
    const getMethodIcon = (method) => {
        const methodLower = method?.toLowerCase() || '';
        switch (methodLower) {
            case 'rfid': return faIdCard;
            case 'web': return faGlobe;
            case 'app': return faMobileAlt;
            default: return faQuestion;
        }
    };


    // --- Pagination Calculation ---
    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredLogs.length);
    const currentLogsPage = filteredLogs.slice(startIndex, endIndex);


    return (
        <Layout>
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faClipboardList} /> Logs de Acesso</h1>
                <div className="page-actions d-flex gap-2"> {/* Use flex and gap */}
                    <button className="btn btn-outline-primary" onClick={handleManualRefresh}>
                        <FontAwesomeIcon icon={faSyncAlt} /> Atualizar
                    </button>
                    <div className="dropdown">
                        <button className="btn btn-primary" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>
                            <FontAwesomeIcon icon={faDownload} /> Exportar
                        </button>
                        {isExportMenuOpen && (
                            <div className="dropdown-menu show" style={{ right: 0, top: '100%'}}>
                                <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportLogsHandler('csv'); }}>
                                    <FontAwesomeIcon icon={faFileCsv} /> CSV
                                </a>
                                <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportLogsHandler('pdf'); }}>
                                    <FontAwesomeIcon icon={faFilePdf} /> PDF
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filters Card */}
            <div className="card mb-4">
                <div className="card-header">
                    <h3>Filtros</h3>
                    <div className="card-actions">
                        <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
                            <FontAwesomeIcon icon={faSyncAlt} /> Limpar Filtros
                        </button>
                    </div>
                </div>
                <div className="card-body">
                    <div className="row">
                        {/* Row 1 */}
                        <div className="col-md-4 mb-2">
                            <label htmlFor="date-range">Período</label>
                            <select id="date-range" name="dateRange" className="form-control" value={filters.dateRange} onChange={handleFilterChange}>
                                <option value="today">Hoje</option>
                                <option value="yesterday">Ontem</option>
                                <option value="last7days">Últimos 7 dias</option>
                                <option value="last30days">Últimos 30 dias</option>
                                {/* <option value="all">Todo o período</option> */}
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-action">Tipo de Ação</label>
                            <select id="filter-action" name="action" className="form-control" value={filters.action} onChange={handleFilterChange}>
                                <option value="">Todas as ações</option>
                                <option value="access_granted">Acesso Permitido</option>
                                <option value="access_denied">Acesso Negado</option>
                                <option value="door_locked">Porta Trancada</option>
                                <option value="door_unlocked">Porta Destrancada</option>
                                {/* Add other actions if they exist */}
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-method">Método</label>
                            <select id="filter-method" name="method" className="form-control" value={filters.method} onChange={handleFilterChange}>
                                <option value="">Todos</option>
                                <option value="rfid">RFID</option>
                                <option value="web">Web</option>
                                <option value="app">Aplicativo</option>
                                {/* Add other methods */}
                            </select>
                        </div>
                        {/* Row 2 */}
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-user">Usuário</label>
                            <input type="text" id="filter-user" name="user" className="form-control" placeholder="Nome ou parte do nome" value={filters.user} onChange={handleFilterChange}/>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-door">Porta</label>
                            <input type="text" id="filter-door" name="door" className="form-control" placeholder="Nome ou parte do nome" value={filters.door} onChange={handleFilterChange}/>
                        </div>
                        {/* Apply button needed mainly for custom date range */}
                        <div className="col-md-4 mb-2 d-flex align-items-end">
                            <button className="btn btn-primary w-100" onClick={applyFiltersManually} disabled={!showCustomDates && false /* Enable if needed for non-custom filters too */}>
                                <FontAwesomeIcon icon={faFilter} /> Aplicar Filtros
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Fields (conditional rendering) */}
                    {showCustomDates && (
                        <div className="custom-date-filters mt-3 pt-3 border-top"> {/* Added border */}
                            <div className="row">
                                <div className="col-md-3 mb-2">
                                    <label htmlFor="start-date">Data Inicial</label>
                                    <input type="date" id="start-date" name="startDate" className="form-control" value={filters.startDate} onChange={handleFilterChange} />
                                </div>
                                <div className="col-md-3 mb-2">
                                    <label htmlFor="start-time">Hora Inicial</label>
                                    <input type="time" id="start-time" name="startTime" className="form-control" value={filters.startTime} onChange={handleFilterChange}/>
                                </div>
                                <div className="col-md-3 mb-2">
                                    <label htmlFor="end-date">Data Final</label>
                                    <input type="date" id="end-date" name="endDate" className="form-control" value={filters.endDate} onChange={handleFilterChange}/>
                                </div>
                                <div className="col-md-3 mb-2">
                                    <label htmlFor="end-time">Hora Final</label>
                                    <input type="time" id="end-time" name="endTime" className="form-control" value={filters.endTime} onChange={handleFilterChange}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Logs List */}
            <div className="card">
                <div className="card-header">
                    <h3>Registros de Acesso</h3>
                    <div className="logs-count">
                        <span id="logs-count">{filteredLogs.length}</span> registros encontrados
                        <small className="text-muted ms-2">(Atualização em tempo real)</small>
                    </div>
                </div>
                <div className="card-body">
                    {/* Reusing activity-list structure/styles from logs.css */}
                    <ul className="activity-list logs-list" style={{ maxHeight: '70vh', overflowY: 'auto'}}> {/* Style from logs.css */}
                        {loading ? (
                            <li className="no-data">Carregando registros...</li>
                        ) : currentLogsPage.length > 0 ? (
                            currentLogsPage.map(log => (
                                <li key={log.id} className="d-flex">
                                    <div className={`activity-icon ${getStatusClass(log.action)}`}>
                                        {/* TODO: Map log.action to specific icons */}
                                        <FontAwesomeIcon icon={log.action === 'access_denied' ? faTimesCircle : log.action === 'door_locked' ? faLock : faCheckCircle} />
                                    </div>
                                    <div className="activity-info">
                                        <div className="activity-title">
                                            <span className="user-name">{log.user_name || 'Desconhecido'}</span>
                                            <span className={`action-badge action-${log.action || 'default'}`}>{formatStatus(log.action)}</span>
                                            {log.method && (
                                                <span className="activity-method">
                                                     <FontAwesomeIcon icon={getMethodIcon(log.method)} style={{ marginRight: '3px', fontSize: '0.7rem' }} />
                                                    {log.method}
                                                 </span>
                                            )}
                                        </div>
                                        <div className="activity-details">
                                            <span><FontAwesomeIcon icon={faDoorOpen} style={{ marginRight: '3px' }}/> {log.door_name || 'Desconhecida'}</span>
                                            <span className="activity-timestamp">
                                                 <FontAwesomeIcon icon={faClock} style={{ marginRight: '3px', color: 'var(--secondary-color)'}}/>
                                                {formatDateTime(log.timestamp)}
                                             </span>
                                        </div>
                                        {log.reason && <div className="activity-reason">Motivo: {log.reason}</div>}
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="no-data">Nenhum registro encontrado com os filtros aplicados.</li>
                        )}
                    </ul>

                    {/* Pagination */}
                    {!loading && filteredLogs.length > PAGE_SIZE && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={filteredLogs.length}
                            itemsPerPage={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>


        </Layout>
    );
}

export default Logs;