// src/pages/Doors.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDoorOpen, faPlus, faSyncAlt, faEllipsisV, faFileCsv, faFilePdf, faEdit, faTrashAlt, faLock, faLockOpen, faSlidersH, faSearch } from '@fortawesome/free-solid-svg-icons';
import { ref, onValue, get, push, update, remove, query, orderByChild } from 'firebase/database';
import { database, auth } from '../firebase/firebaseConfig'; // Import auth if needed for logging
import { showNotification } from '../utils/notifications';
import { formatDateTime, getStatusClass, formatStatus } from '../utils/formatters';
import { debounce } from '../utils/helpers';

const PAGE_SIZE = 10;

function Doors() {
    const [doors, setDoors] = useState([]);
    const [filteredDoors, setFilteredDoors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isControlModalOpen, setIsControlModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [currentDoor, setCurrentDoor] = useState(null); // For add/edit/control/delete
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Form state for Add/Edit Modal
    const [formData, setFormData] = useState({ name: '', location: '', status: 'locked' });

    const loadDoors = useCallback(() => {
        setLoading(true);
        const doorsRef = ref(database, 'doors');
        onValue(doorsRef, (snapshot) => {
            const doorsData = snapshot.val();
            let doorsArray = [];
            if (doorsData) {
                doorsArray = Object.entries(doorsData).map(([id, door]) => ({ id, ...door }));
            }
            setDoors(doorsArray);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao carregar portas:', error);
            showNotification('Erro ao carregar portas: ' + error.message, 'error');
            setLoading(false);
        });
        // Use get for a single fetch:
        /*
        get(doorsRef).then(snapshot => { ... }).catch(error => { ... }).finally(() => setLoading(false));
        */
    }, []);

    useEffect(() => {
        loadDoors();
        // Cleanup for onValue listener:
        // return () => ref(database, 'doors').off();
    }, [loadDoors]);

    // Filtering and Searching Effect
    useEffect(() => {
        let result = [...doors];
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            result = result.filter(door =>
                (door.name?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (door.location?.toLowerCase() || '').includes(lowerSearchTerm)
            );
        }
        // Add more filters if needed (e.g., by status)

        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setFilteredDoors(result);
        setCurrentPage(1); // Reset page on filter change
    }, [doors, searchTerm]);

    // --- Event Handlers ---
    const handleSearchChange = (event) => setSearchTerm(event.target.value);
    const debouncedSearch = useCallback(debounce(handleSearchChange, 300), []);
    const handlePageChange = (page) => setCurrentPage(page);

    const openAddDoorModal = () => {
        setCurrentDoor(null);
        setFormData({ name: '', location: '', status: 'locked' }); // Reset form
        setIsAddEditModalOpen(true);
    };

    const openEditDoorModal = (door) => {
        setCurrentDoor(door);
        setFormData({ // Pre-fill
            name: door.name || '',
            location: door.location || '',
            status: door.status || 'locked' // Keep status for edit, or maybe hide it?
        });
        setIsAddEditModalOpen(true);
    };

    const openControlModal = (door) => {
        setCurrentDoor(door);
        setIsControlModalOpen(true);
    };

    const openConfirmDelete = (door) => {
        setCurrentDoor(door); // Store the door to be deleted
        setIsConfirmOpen(true);
    };

    const closeAddEditModal = () => setIsAddEditModalOpen(false);
    const closeControlModal = () => setIsControlModalOpen(false);
    const closeConfirmModal = () => setIsConfirmOpen(false);

    const handleFormInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveDoor = async () => {
        if (!formData.name.trim()) return showNotification('O nome da porta é obrigatório', 'error');
        if (!formData.location.trim()) return showNotification('A localização é obrigatória', 'error');

        const doorData = {
            name: formData.name.trim(),
            location: formData.location.trim(),
            // Only set initial status when adding, retain current status on edit
            ...( !currentDoor && { status: formData.status }),
            ...( !currentDoor && { last_status_change: new Date().toISOString()}) // Set timestamp only for new
        };

        setLoading(true); // Indicate saving

        try {
            if (currentDoor) { // Edit existing door
                await update(ref(database, `doors/${currentDoor.id}`), doorData);
                showNotification('Porta atualizada com sucesso!', 'success');
            } else { // Add new door
                await push(ref(database, 'doors'), doorData);
                showNotification('Porta adicionada com sucesso!', 'success');
            }
            closeAddEditModal();
            // loadDoors(); // Listener will update automatically if using onValue
        } catch (error) {
            console.error('Erro ao salvar porta:', error);
            showNotification('Erro ao salvar porta: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLock = async (action) => {
        if (!currentDoor) return;
        const newStatus = action === 'lock' ? 'locked' : 'unlocked';
        if (currentDoor.status === newStatus) {
            // Already in the desired state
            closeControlModal();
            return;
        }

        const doorRef = ref(database, `doors/${currentDoor.id}`);
        const user = auth.currentUser; // For logging
        let userName = user?.displayName || user?.email || 'Sistema';

        // Fetch current username if needed (like in dashboard toggle)
        // ... (async fetch username logic can be added here if not relying on displayName) ...

        setLoading(true); // Indicate processing

        try {
            await update(doorRef, {
                status: newStatus,
                last_status_change: new Date().toISOString()
            });

            // Log the action
            if (user) {
                const logData = {
                    user_id: user.uid,
                    user_name: userName,
                    door_id: currentDoor.id,
                    door_name: currentDoor.name || 'Porta',
                    action: newStatus === 'locked' ? 'door_locked' : 'access_granted', // Or 'door_unlocked' if preferred
                    method: 'web',
                    timestamp: new Date().toISOString()
                };
                await push(ref(database, 'access_logs'), logData);
            }

            showNotification(`Porta ${formatStatus(newStatus).toLowerCase()} com sucesso!`, 'success');
            closeControlModal();
            // loadDoors(); // Listener updates state

        } catch (error) {
            console.error(`Erro ao ${action} porta:`, error);
            showNotification(`Erro ao ${action} porta: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDoor = async () => {
        if (!currentDoor) return;
        setLoading(true);
        try {
            await remove(ref(database, `doors/${currentDoor.id}`));
            showNotification('Porta excluída com sucesso', 'success');
            closeConfirmModal();
            // loadDoors(); // Listener updates state
        } catch (error) {
            console.error('Erro ao excluir porta:', error);
            showNotification(`Erro ao excluir porta: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const exportDoors = (format) => {
        if (filteredDoors.length === 0) return showNotification('Não há portas para exportar', 'warning');
        showNotification(`Exportando ${filteredDoors.length} portas para ${format.toUpperCase()}...`, 'info');
        // TODO: Implement export logic (similar to users export)
        console.log(`TODO: Implement ${format} export for doors`);
        setIsExportMenuOpen(false); // Close menu
    };


    // --- Pagination Calculation ---
    const totalPages = Math.ceil(filteredDoors.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredDoors.length);
    const currentDoorsPage = filteredDoors.slice(startIndex, endIndex);

    return (
        <Layout>
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faDoorOpen} /> Gerenciamento de Portas</h1>
                <button className="btn btn-primary" onClick={openAddDoorModal}>
                    <FontAwesomeIcon icon={faPlus} /> Nova Porta
                </button>
            </div>

            {/* Search Bar (moved outside filters card for prominence?) */}
            <div className="mb-3">
                <div className="header-search" style={{ maxWidth: '400px' }}> {/* Reusing header style */}
                    <FontAwesomeIcon icon={faSearch} style={{ color: 'var(--secondary-color)', marginRight: '10px'}}/>
                    <input
                        type="text"
                        id="search-doors"
                        placeholder="Buscar por nome ou localização..."
                        onChange={handleSearchChange} // Direct or use debouncedSearch
                        style={{ background: 'none', border: 'none', outline: 'none', flex: 1, padding: '7px 0'}}
                    />
                </div>
            </div>

            {/* Doors Table */}
            <div className="card">
                <div className="card-header">
                    <h3>Lista de Portas ({filteredDoors.length})</h3>
                    <div className="card-actions">
                        <button className="icon-button" onClick={loadDoors} title="Atualizar Lista">
                            <FontAwesomeIcon icon={faSyncAlt} />
                        </button>
                        <div className="dropdown">
                            <button className="icon-button" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} title="Exportar">
                                <FontAwesomeIcon icon={faEllipsisV} />
                            </button>
                            {isExportMenuOpen && (
                                <div className="dropdown-menu show" style={{ right: 0, top: '100%'}}>
                                    <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportDoors('csv'); }}>
                                        <FontAwesomeIcon icon={faFileCsv} /> Exportar CSV
                                    </a>
                                    <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportDoors('pdf'); }}>
                                        <FontAwesomeIcon icon={faFilePdf} /> Exportar PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-hover">
                            <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Localização</th>
                                <th>Status</th>
                                <th>Última Atividade</th>
                                <th>Ações</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center">Carregando...</td></tr>
                            ) : currentDoorsPage.length > 0 ? (
                                currentDoorsPage.map(door => (
                                    <tr key={door.id}>
                                        <td>{door.name || 'Sem nome'}</td>
                                        <td>{door.location || '-'}</td>
                                        <td>
                                                <span className={`status-badge status-${door.status === 'locked' ? 'locked' : 'unlocked'}`}> {/* Use classes from components.css */}
                                                    <FontAwesomeIcon icon={door.status === 'locked' ? faLock : faLockOpen} style={{ marginRight: '5px' }} />
                                                    {formatStatus(door.status)}
                                                </span>
                                        </td>
                                        <td>{formatDateTime(door.last_status_change)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn action-btn-edit" onClick={() => openEditDoorModal(door)} title="Editar">
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button className="action-btn" onClick={() => openControlModal(door)} title="Controlar">
                                                    <FontAwesomeIcon icon={faSlidersH} />
                                                </button>
                                                <button className="action-btn action-btn-delete" onClick={() => openConfirmDelete(door)} title="Excluir">
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="text-center">Nenhuma porta encontrada.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {!loading && filteredDoors.length > PAGE_SIZE && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={filteredDoors.length}
                            itemsPerPage={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>

            {/* Add/Edit Door Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={closeAddEditModal}
                title={currentDoor ? 'Editar Porta' : 'Adicionar Nova Porta'}
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeAddEditModal}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveDoor} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </>
                }
            >
                <form id="doorForm" onSubmit={(e) => e.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="modal-door-name">Nome</label>
                        <input type="text" id="modal-door-name" name="name" className="form-control" value={formData.name} onChange={handleFormInputChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-door-location">Localização</label>
                        <input type="text" id="modal-door-location" name="location" className="form-control" value={formData.location} onChange={handleFormInputChange} required />
                    </div>
                    {/* Status only shown when adding */}
                    {!currentDoor && (
                        <div className="form-group">
                            <label htmlFor="modal-door-status">Status Inicial</label>
                            <select id="modal-door-status" name="status" className="form-control" value={formData.status} onChange={handleFormInputChange} required>
                                <option value="locked">Trancada</option>
                                <option value="unlocked">Destrancada</option>
                            </select>
                        </div>
                    )}
                </form>
            </Modal>

            {/* Control Door Modal */}
            <Modal
                isOpen={isControlModalOpen}
                onClose={closeControlModal}
                title={`Controlar Porta - ${currentDoor?.name || ''}`}
                footer={
                    <button className="btn btn-secondary" onClick={closeControlModal}>Fechar</button>
                }
            >
                <div className="door-control-info mb-3"> {/* Added margin */}
                    <p>Status Atual:
                        <span className={`ml-2 status-badge status-${currentDoor?.status === 'locked' ? 'locked' : 'unlocked'}`}> {/* Use classes */}
                            <FontAwesomeIcon icon={currentDoor?.status === 'locked' ? faLock : faLockOpen} style={{ marginRight: '5px' }}/>
                            {formatStatus(currentDoor?.status)}
                          </span>
                    </p>
                </div>
                <div className="door-control-actions d-flex justify-content-center gap-3"> {/* Use flex for centering */}
                    <button
                        className="btn btn-danger"
                        onClick={() => handleToggleLock('lock')}
                        disabled={loading || currentDoor?.status === 'locked'}
                    >
                        <FontAwesomeIcon icon={faLock} /> Trancar
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={() => handleToggleLock('unlock')}
                        disabled={loading || currentDoor?.status === 'unlocked'}
                    >
                        <FontAwesomeIcon icon={faLockOpen} /> Destrancar
                    </button>
                </div>
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal
                isOpen={isConfirmOpen}
                onClose={closeConfirmModal}
                title="Confirmar Exclusão"
                size="sm"
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeConfirmModal}>Cancelar</button>
                        <button className="btn btn-danger" onClick={handleDeleteDoor} disabled={loading}>
                            {loading ? 'Excluindo...' : 'Excluir'}
                        </button>
                    </>
                }
            >
                <p>Tem certeza que deseja excluir a porta "{currentDoor?.name}"?</p>
            </Modal>

        </Layout>
    );
}

export default Doors;