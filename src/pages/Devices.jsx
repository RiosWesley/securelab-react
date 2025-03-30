// src/pages/Devices.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMicrochip, faPlus, faSyncAlt, faEllipsisV, faFileCsv, faFilePdf, faDownload,
    faEdit, faRedoAlt, faCog, faStethoscope, faTrashAlt, faExclamationTriangle,
    faWifi, faTools, faBatteryQuarter, faSearch, faEye, faEyeSlash, faCopy
} from '@fortawesome/free-solid-svg-icons';
// Import icons for tabs if needed: faNetworkWired, faUserShield, faWrench etc.
import { ref, onValue, get, push, update, remove, query, orderByChild } from 'firebase/database';
import { database } from '../firebase/firebaseConfig';
import { showNotification } from '../utils/notifications';
import { formatDate, getStatusClass, formatStatus } from '../utils/formatters';
import { debounce } from '../utils/helpers';
import '../styles/devices.css'; // Import device-specific styles

const PAGE_SIZE = 10; // Or your preferred page size


function Devices() {
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [stats, setStats] = useState({ online: 0, outdated: 0, lowBattery: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ status: '', type: '', firmware: '' });

    // Modal States
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [currentDevice, setCurrentDevice] = useState(null); // For modals

    // Add/Edit Form State
    const [formData, setFormData] = useState({ name: '', typeCode: '', location: '', ip: '', mac: '', firmware: 'v2.3.1' });
    // Config Form State (simplified for now)
    const [configFormData, setConfigFormData] = useState({});
    const [activeConfigTab, setActiveConfigTab] = useState('general-tab');
    // Confirm Action State
    const [confirmActionDetails, setConfirmActionDetails] = useState({ title: '', message: '', onConfirm: null });

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);


    // --- Data Fetching & Stats Calculation ---
    const loadDevices = useCallback(() => {
        setLoading(true);
        const devicesRef = ref(database, 'devices');
        onValue(devicesRef, (snapshot) => {
            const data = snapshot.val();
            let devicesArray = [];
            if (data) {
                devicesArray = Object.entries(data).map(([id, device]) => ({ id, ...device }));
            }
            setDevices(devicesArray);

            // Recalculate stats based on devicesArray
            let onlineCount = 0;
            let outdatedCount = 0;
            let lowBatteryCount = 0;
            devicesArray.forEach(d => {
                // Assuming status 'online' or 'warning' means it's connected
                if (d.status === 'online' || d.status === 'warning') onlineCount++;
                // Assuming 'needsUpdate' field exists
                if (d.needsUpdate) outdatedCount++;
                // Assuming 'batteryLevel' field exists and is a number
                if (d.batteryLevel !== null && typeof d.batteryLevel === 'number' && d.batteryLevel < 20) lowBatteryCount++;
            });
            setStats({ online: onlineCount, outdated: outdatedCount, lowBattery: lowBatteryCount, total: devicesArray.length });

            setLoading(false);
        }, (error) => {
            console.error("Error loading devices:", error);
            showNotification("Error loading devices: " + error.message, 'error');
            setLoading(false);
        });
        // Return cleanup function for onValue
        return () => ref(database, 'devices').off();
    }, []);

    useEffect(() => {
        loadDevices();
    }, [loadDevices]);

    // Filtering Logic
    useEffect(() => {
        let result = [...devices];
        const lowerSearchTerm = searchTerm.toLowerCase();

        if (searchTerm) {
            result = result.filter(d =>
                (d.name?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (d.location?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (d.type?.toLowerCase() || '').includes(lowerSearchTerm)
            );
        }
        if (filters.status) {
            result = result.filter(d => d.status === filters.status);
        }
        if (filters.type) {
            result = result.filter(d => d.typeCode === filters.type);
        }
        if (filters.firmware) {
            if (filters.firmware === 'outdated') {
                result = result.filter(d => d.needsUpdate);
            } else {
                result = result.filter(d => d.firmware === filters.firmware);
            }
        }

        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setFilteredDevices(result);
        setCurrentPage(1);
    }, [devices, searchTerm, filters]);

    // --- Handlers ---
    const handleSearchChange = (e) => setSearchTerm(e.target.value);
    const debouncedSearch = useCallback(debounce(handleSearchChange, 300), []);
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    const resetFilters = () => {
        setSearchTerm('');
        setFilters({ status: '', type: '', firmware: '' });
        // Reset select elements visually
        document.getElementById('search-devices')?.setAttribute('value', ''); // Clear controlled input if needed
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-type').value = '';
        document.getElementById('filter-firmware').value = '';
    };
    const handlePageChange = (page) => setCurrentPage(page);

    // Add/Edit Modal
    const openAddDeviceModal = () => {
        setCurrentDevice(null);
        setFormData({ name: '', typeCode: '', location: '', ip: '', mac: '', firmware: 'v2.3.1' });
        setIsAddEditModalOpen(true);
    };
    const openEditDeviceModal = (device) => {
        setCurrentDevice(device);
        setFormData({
            name: device.name || '',
            typeCode: device.typeCode || '',
            location: device.location || '',
            ip: device.ip || '',
            mac: device.mac || '',
            firmware: device.firmware || 'v2.3.1'
        });
        setIsAddEditModalOpen(true);
    };
    const closeAddEditModal = () => setIsAddEditModalOpen(false);
    const handleAddEditFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSaveDevice = async () => { // Added async
        // TODO: Add validation
        console.log("Saving device:", formData, "Current:", currentDevice);
        showNotification(currentDevice ? "Dispositivo atualizado (simulado)" : "Dispositivo adicionado (simulado)", "success");
        // TODO: Integrate with Firebase update/push
        // Basic Validation
        if (!formData.name.trim()) return showNotification('O nome é obrigatório', 'error');
        if (!formData.typeCode) return showNotification('O tipo é obrigatório', 'error');
        if (!formData.location.trim()) return showNotification('A localização é obrigatória', 'error');
        // Optional: Add validation for IP/MAC format if needed

        const deviceData = {
            name: formData.name.trim(),
            typeCode: formData.typeCode,
            location: formData.location.trim(),
            ip: formData.ip?.trim() || null, // Store as null if empty
            mac: formData.mac?.trim() || null, // Store as null if empty
            firmware: formData.firmware,
            // Add default status/lastActivity only when creating
            ...( !currentDevice && { status: 'offline', lastActivity: new Date().toISOString(), needsUpdate: false } )
        };

        setLoading(true);
        try {
            if (currentDevice) { // --- Edit Device ---
                await update(ref(database, `devices/${currentDevice.id}`), deviceData);
                showNotification('Dispositivo atualizado com sucesso!', 'success');
            } else { // --- Add Device ---
                await push(ref(database, 'devices'), deviceData);
                showNotification('Dispositivo adicionado com sucesso!', 'success');
            }
            closeAddEditModal();
            // No need to call loadDevices() here, onValue listener will update the state
        } catch (error) {
            console.error('Erro ao salvar dispositivo:', error);
            showNotification('Erro ao salvar dispositivo: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Config Modal
    const openConfigModal = (device) => {
        setCurrentDevice(device);
        // TODO: Populate configFormData based on device data and config structure
        setConfigFormData({
            name: device.name,
            location: device.location,
            // ... other fields based on tabs ...
            ipConfig: 'dhcp', // default example
            wifiSsid: 'SecureLab-Network', // example
            apiToken: device.id ? `sk_${device.id.substring(0, 8)}...` : 'sk_...', // example
        });
        setActiveConfigTab('general-tab'); // Reset to first tab
        setIsConfigModalOpen(true);
    };
    const closeConfigModal = () => setIsConfigModalOpen(false);
    const handleConfigFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfigFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    const handleSaveConfig = async () => { // Added async
        if (!currentDevice) return;
        setLoading(true);
        try {
            // Save the configFormData under a 'config' key or merge directly
            // Example: Saving under a 'config' key
            await update(ref(database, `devices/${currentDevice.id}/config`), configFormData);
            // Or merge directly (careful not to overwrite top-level fields like name/location if they are in configFormData)
            // await update(ref(database, `devices/${currentDevice.id}`), configFormData);
            showNotification("Configurações salvas com sucesso!", "success");
            closeConfigModal();
            // Data will update via onValue listener
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            showNotification('Erro ao salvar configurações: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Confirm Modal & Actions
    const openConfirm = (title, message, onConfirm) => {
        setConfirmActionDetails({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };
    const closeConfirm = () => setIsConfirmOpen(false);
    const handleConfirm = () => {
        if (confirmActionDetails.onConfirm) {
            confirmActionDetails.onConfirm();
        }
        closeConfirm();
    };

    const handleRestartDevice = (device) => {
        openConfirm(
            'Reiniciar Dispositivo',
            `Tem certeza que deseja solicitar a reinicialização do dispositivo "${device.name}"?`,
            async () => {
                setLoading(true);
                try {
                    await update(ref(database, `devices/${device.id}`), { pending_action: 'restart', action_requested_at: new Date().toISOString() });
                    showNotification(`Solicitação de reinicialização para "${device.name}" enviada.`, "success");
                } catch (error) {
                    showNotification(`Erro ao solicitar reinicialização: ${error.message}`, "error");
                } finally {
                    setLoading(false);
                }
            }
        );
    };
    const handleFactoryReset = (device) => {
        openConfirm(
            'Restaurar Padrões de Fábrica',
            `ATENÇÃO: Solicitar restauração de fábrica para "${device.name}"? Todas as configurações podem ser perdidas.`,
            async () => {
                setLoading(true);
                try {
                    await update(ref(database, `devices/${device.id}`), { pending_action: 'factory_reset', action_requested_at: new Date().toISOString() });
                    showNotification(`Solicitação de restauração de fábrica para "${device.name}" enviada.`, "success");
                    closeConfigModal(); // Close config modal after requesting reset
                } catch (error) {
                    showNotification(`Erro ao solicitar restauração: ${error.message}`, "error");
                } finally {
                    setLoading(false);
                }
            }
        );
    };
    const handleDiagnostics = async (device) => { // Added async
        showNotification(`Solicitando diagnóstico para "${device.name}"...`, 'info');
        setLoading(true);
        try {
            await update(ref(database, `devices/${device.id}`), { pending_action: 'diagnostics', action_requested_at: new Date().toISOString() });
            showNotification(`Solicitação de diagnóstico para "${device.name}" enviada.`, "success");
            // Note: Actual results would need to be read from another path or pushed via device status updates.
        } catch (error) {
            showNotification(`Erro ao solicitar diagnóstico: ${error.message}`, "error");
        } finally {
            setLoading(false);
        }
    };


    // --- Render Logic ---
    const totalPages = Math.ceil(filteredDevices.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredDevices.length);
    const currentDevicesPage = filteredDevices.slice(startIndex, endIndex);

    // Simplified function to get type name
    const getDeviceTypeName = (typeCode) => {
        const map = { 'rfid-reader': 'Leitor RFID', 'controller': 'Controlador', 'gateway': 'Gateway IoT' };
        return map[typeCode] || typeCode || 'Desconhecido';
    }
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copiado para a área de transferência!', 'success');
        }).catch(err => {
            showNotification('Falha ao copiar: ' + err, 'error');
        });
    };


    return (
        <Layout>
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faMicrochip} /> Gerenciamento de Dispositivos</h1>
                <button className="btn btn-primary" onClick={openAddDeviceModal}>
                    <FontAwesomeIcon icon={faPlus} /> Novo Dispositivo
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <h3 className="mb-0">Filtros</h3>
                        <div className="header-search" style={{ minWidth: '250px', maxWidth: '400px', flexGrow: 1 }}>
                            <FontAwesomeIcon icon={faSearch} style={{ color: 'var(--secondary-color)', marginRight: '10px'}} />
                            <input
                                type="text"
                                id="search-devices"
                                placeholder="Buscar por nome, localização, tipo..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                style={{ background: 'none', border: 'none', outline: 'none', flex: 1, padding: '7px 0'}}
                            />
                        </div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
                            <FontAwesomeIcon icon={faSyncAlt} /> Limpar Filtros
                        </button>
                    </div>
                    <div className="row">
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-status">Status</label>
                            <select id="filter-status" name="status" className="form-control" value={filters.status} onChange={handleFilterChange}>
                                <option value="">Todos</option>
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="warning">Alerta</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-type">Tipo</label>
                            <select id="filter-type" name="type" className="form-control" value={filters.type} onChange={handleFilterChange}>
                                <option value="">Todos</option>
                                <option value="rfid-reader">Leitor RFID</option>
                                <option value="controller">Controlador</option>
                                <option value="gateway">Gateway IoT</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-firmware">Versão de Firmware</label>
                            <select id="filter-firmware" name="firmware" className="form-control" value={filters.firmware} onChange={handleFilterChange}>
                                <option value="">Todas</option>
                                <option value="v2.3.1">v2.3.1</option>
                                <option value="v2.2.5">v2.2.5</option>
                                <option value="outdated">Desatualizado</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="card-grid mb-4">
                <div className="status-card">
                    <div className="status-card-header">
                        <h3>Dispositivos Online</h3>
                        <FontAwesomeIcon icon={faWifi} className="card-icon" />
                    </div>
                    <div className="status-card-body">
                        <div className="status-count">{stats.online}</div>
                        <div className="status-label">de {stats.total} dispositivos</div>
                    </div>
                </div>
                <div className="status-card">
                    <div className="status-card-header">
                        <h3>Necessitam Atualização</h3>
                        <FontAwesomeIcon icon={faDownload} className="card-icon" />
                    </div>
                    <div className="status-card-body">
                        <div className="status-count">{stats.outdated}</div>
                        <div className="status-label">dispositivos desatualizados</div>
                    </div>
                </div>
                <div className="status-card">
                    <div className="status-card-header">
                        <h3>Última Manutenção</h3> {/* Example Static Card */}
                        <FontAwesomeIcon icon={faTools} className="card-icon" />
                    </div>
                    <div className="status-card-body">
                        <div className="status-count">15/02</div>
                        <div className="status-label">Há 26 dias</div>
                    </div>
                </div>
                <div className="status-card">
                    <div className="status-card-header">
                        <h3>Bateria Crítica</h3>
                        <FontAwesomeIcon icon={faBatteryQuarter} className="card-icon" />
                    </div>
                    <div className="status-card-body">
                        <div className="status-count">{stats.lowBattery}</div>
                        <div className="status-label">dispositivo(s)</div>
                    </div>
                </div>
            </div>


            {/* Devices Table */}
            <div className="card">
                <div className="card-header">
                    <h3>Lista de Dispositivos ({filteredDevices.length})</h3>
                    {/* Actions like refresh, export */}
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-hover">
                            <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Tipo</th>
                                <th>Localização</th>
                                <th>Status</th>
                                <th>Firmware</th>
                                <th>Última Atividade</th>
                                <th>Ações</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center">Carregando...</td></tr>
                            ) : currentDevicesPage.length > 0 ? (
                                currentDevicesPage.map(device => (
                                    <tr key={device.id}>
                                        <td>{device.name}</td>
                                        <td>{device.type || getDeviceTypeName(device.typeCode)}</td>
                                        <td>{device.location}</td>
                                        <td>
                                                <span className={`badge-status badge-${getStatusClass(device.status)}`}>
                                                    {device.statusMessage || formatStatus(device.status)}
                                                </span>
                                        </td>
                                        <td>
                                            {device.firmware}
                                            {device.needsUpdate && (
                                                <FontAwesomeIcon icon={faExclamationTriangle} className="text-warning ml-1" title="Atualização disponível" />
                                            )}
                                        </td>
                                        <td>{formatDate(device.lastActivity)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn action-btn-edit" onClick={() => openEditDeviceModal(device)} title="Editar">
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                {device.status === 'offline' ? (
                                                    <button className="action-btn" onClick={() => handleDiagnostics(device)} title="Diagnóstico">
                                                        <FontAwesomeIcon icon={faStethoscope} />
                                                    </button>
                                                ) : (
                                                    <button className="action-btn" onClick={() => handleRestartDevice(device)} title="Reiniciar">
                                                        <FontAwesomeIcon icon={faRedoAlt} />
                                                    </button>
                                                )}
                                                <button className="action-btn" onClick={() => openConfigModal(device)} title="Configurar">
                                                    <FontAwesomeIcon icon={faCog} />
                                                </button>
                                                {/* Consider adding delete here if needed */}
                                                {/* <button className="action-btn action-btn-delete" onClick={() => {/* open confirm delete * /}} title="Excluir">
                                                        <FontAwesomeIcon icon={faTrashAlt} />
                                                    </button> */}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="7" className="text-center">Nenhum dispositivo encontrado.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {!loading && filteredDevices.length > PAGE_SIZE && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={filteredDevices.length}
                            itemsPerPage={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>

            {/* Add/Edit Device Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={closeAddEditModal}
                title={currentDevice ? "Editar Dispositivo" : "Adicionar Novo Dispositivo"}
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeAddEditModal}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveDevice}>Salvar</button>
                    </>
                }
            >
                <form id="deviceForm" onSubmit={(e)=>e.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="form-deviceName">Nome</label>
                        <input type="text" id="form-deviceName" name="name" className="form-control" value={formData.name} onChange={handleAddEditFormChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="form-deviceType">Tipo</label>
                        <select id="form-deviceType" name="typeCode" className="form-control" value={formData.typeCode} onChange={handleAddEditFormChange} required>
                            <option value="">Selecione um tipo</option>
                            <option value="rfid-reader">Leitor RFID</option>
                            <option value="controller">Controlador</option>
                            <option value="gateway">Gateway IoT</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="form-deviceLocation">Localização</label>
                        <input type="text" id="form-deviceLocation" name="location" className="form-control" value={formData.location} onChange={handleAddEditFormChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="form-deviceIP">Endereço IP</label>
                        <input type="text" id="form-deviceIP" name="ip" className="form-control" value={formData.ip} onChange={handleAddEditFormChange} pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$" placeholder="192.168.1.100" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="form-deviceMAC">Endereço MAC</label>
                        <input type="text" id="form-deviceMAC" name="mac" className="form-control" value={formData.mac} onChange={handleAddEditFormChange} pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$" placeholder="00:11:22:33:44:55"/>
                    </div>
                    <div className="form-group">
                        <label htmlFor="form-deviceFirmware">Versão do Firmware</label>
                        <select id="form-deviceFirmware" name="firmware" className="form-control" value={formData.firmware} onChange={handleAddEditFormChange}>
                            <option value="v2.3.1">v2.3.1 (Mais recente)</option>
                            <option value="v2.2.5">v2.2.5</option>
                            <option value="v2.1.8">v2.1.8 (Legado)</option>
                        </select>
                    </div>
                </form>
            </Modal>

            {/* Config Device Modal */}
            <Modal
                isOpen={isConfigModalOpen}
                onClose={closeConfigModal}
                title={`Configurar ${currentDevice?.name || 'Dispositivo'}`}
                size="lg" // Use large modal for config
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeConfigModal}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveConfig}>Salvar Configurações</button>
                    </>
                }
            >
                {/* Tabs Navigation */}
                <div className="settings-tabs">
                    <div className="tab-buttons">
                        <button className={`tab-btn ${activeConfigTab === 'general-tab' ? 'active' : ''}`} onClick={() => setActiveConfigTab('general-tab')}>Geral</button>
                        <button className={`tab-btn ${activeConfigTab === 'network-tab' ? 'active' : ''}`} onClick={() => setActiveConfigTab('network-tab')}>Rede</button>
                        <button className={`tab-btn ${activeConfigTab === 'security-tab' ? 'active' : ''}`} onClick={() => setActiveConfigTab('security-tab')}>Segurança</button>
                        <button className={`tab-btn ${activeConfigTab === 'maintenance-tab' ? 'active' : ''}`} onClick={() => setActiveConfigTab('maintenance-tab')}>Manutenção</button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {/* General Tab */}
                    <div id="general-tab" className={`tab-pane ${activeConfigTab === 'general-tab' ? 'active' : ''}`}>
                        <div className="form-group">
                            <label htmlFor="config-device-name">Nome do Dispositivo</label>
                            <input type="text" id="config-device-name" name="name" className="form-control" value={configFormData.name || ''} onChange={handleConfigFormChange}/>
                        </div>
                        {/* Add other general fields from devices.html here */}
                    </div>
                    {/* Network Tab */}
                    <div id="network-tab" className={`tab-pane ${activeConfigTab === 'network-tab' ? 'active' : ''}`}>
                        {/* Example: IP Config */}
                        <div className="form-group">
                            <label>Configuração IP</label>
                            <div className="radio-group">
                                <label>
                                    <input type="radio" name="ipConfig" value="dhcp" checked={configFormData.ipConfig === 'dhcp'} onChange={handleConfigFormChange} /> DHCP (Automático)
                                </label>
                                <label>
                                    <input type="radio" name="ipConfig" value="static" checked={configFormData.ipConfig === 'static'} onChange={handleConfigFormChange}/> IP Estático
                                </label>
                            </div>
                        </div>
                        {configFormData.ipConfig === 'static' && (
                            <div id="static-ip-settings">
                                {/* Static IP Fields */}
                                <div className="form-group">
                                    <label htmlFor="static-ip">Endereço IP</label>
                                    <input type="text" id="static-ip" name="staticIp" className="form-control" value={configFormData.staticIp || ''} onChange={handleConfigFormChange} placeholder="192.168.1.100" />
                                </div>
                                {/* Subnet, Gateway, DNS */}
                            </div>
                        )}
                        {/* Add WiFi fields etc. */}
                    </div>
                    {/* Security Tab */}
                    <div id="security-tab" className={`tab-pane ${activeConfigTab === 'security-tab' ? 'active' : ''}`}>
                        {/* Example: API Token */}
                        <div className="form-group">
                            <label htmlFor="api-token">Token de API</label>
                            <div className="input-group">
                                <input type="text" id="api-token" className="form-control" value={configFormData.apiToken || ''} readOnly />
                                <div className="input-group-append">
                                    <button className="btn btn-outline-secondary" type="button" onClick={() => copyToClipboard(configFormData.apiToken || '')}>
                                        <FontAwesomeIcon icon={faCopy} />
                                    </button>
                                    <button className="btn btn-outline-primary" type="button" onClick={() => {/* TODO: Implement token regeneration confirmation */}}>
                                        <FontAwesomeIcon icon={faSyncAlt} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Add other security fields */}
                    </div>
                    {/* Maintenance Tab */}
                    <div id="maintenance-tab" className={`tab-pane ${activeConfigTab === 'maintenance-tab' ? 'active' : ''}`}>
                        <div className="form-group">
                            <label>Ações de Manutenção</label>
                            <div className="maintenance-actions">
                                {currentDevice?.status !== 'offline' && (
                                    <button className="btn btn-outline-primary mb-2 w-100" onClick={() => handleRestartDevice(currentDevice)}>
                                        <FontAwesomeIcon icon={faRedoAlt} /> Reiniciar Dispositivo
                                    </button>
                                )}
                                <button className="btn btn-outline-primary mb-2 w-100" onClick={() => handleFactoryReset(currentDevice)}>
                                    <FontAwesomeIcon icon={faTrashAlt} /> Restaurar Padrões
                                </button>
                                {currentDevice?.status === 'offline' && (
                                    <button className="btn btn-outline-primary mb-2 w-100" onClick={() => handleDiagnostics(currentDevice)}>
                                        <FontAwesomeIcon icon={faStethoscope} /> Executar Diagnóstico
                                    </button>
                                )}
                                {/* Add other maintenance actions */}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>


            {/* Confirm Action Modal */}
            <Modal
                isOpen={isConfirmOpen}
                onClose={closeConfirm}
                title={confirmActionDetails.title}
                size="sm"
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeConfirm}>Cancelar</button>
                        <button className="btn btn-danger" onClick={handleConfirm}>Confirmar</button>
                    </>
                }
            >
                <p>{confirmActionDetails.message}</p>
            </Modal>


        </Layout>
    );
}

export default Devices;
