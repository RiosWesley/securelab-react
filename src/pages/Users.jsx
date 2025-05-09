// src/pages/Users.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal'; // Import the reusable Modal
import Pagination from '../components/Pagination'; // Create this component later
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faPlus, faSyncAlt, faEllipsisV, faFileCsv, faFilePdf, faEdit, faTrashAlt, faEye, faEyeSlash, faSearch, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { ref, onValue, get, push, update, remove, query, orderByChild, equalTo, set } from 'firebase/database';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Import auth functions
import { database, auth } from '../firebase/firebaseConfig';
import { showNotification } from '../utils/notifications';
import { formatDate, getStatusClass, formatStatus, translateRole } from '../utils/formatters';
import { debounce } from '../utils/helpers'; // Create this helper file later

// Constants
const PAGE_SIZE = 10;
const MODAL_DOORS_PAGE_SIZE = 10; // Page size for the authorized doors modal

function Users() {
    const [users, setUsers] = useState([]); // All users from DB
    const [filteredUsers, setFilteredUsers] = useState([]); // Users after filtering/searching
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ department: '', role: '', status: '' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // User being edited, or null for add
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false); // State for export dropdown

    // Form State (could be a separate useReducer/custom hook later)
    const [formData, setFormData] = useState({
        name: '', email: '', department: '', role: '', status: 'active', password: '', rfidTagId: '' // Added rfidTagId
    });

    // States for Authorized Doors Modal
    const [isAuthorizedDoorsModalOpen, setIsAuthorizedDoorsModalOpen] = useState(false);
    const [currentUserForDoors, setCurrentUserForDoors] = useState(null); // User whose doors are being managed
    const [allDoorsListForModal, setAllDoorsListForModal] = useState([]); // Stores { ...door, isAuthorized: boolean }
    const [loadingModalDoors, setLoadingModalDoors] = useState(false);
    const [modalDoorsSearchTerm, setModalDoorsSearchTerm] = useState('');
    const [modalDoorsCurrentPage, setModalDoorsCurrentPage] = useState(1);
    const [allDevicesData, setAllDevicesData] = useState({}); // To store all devices data once

    // --- Data Fetching and Filtering ---

    const loadUsers = useCallback(() => {
        setLoading(true);
        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val();
            let usersArray = [];
            if (usersData) {
                usersArray = Object.entries(usersData).map(([id, user]) => ({ id, ...user }));
            }
            setUsers(usersArray);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao carregar usuários:', error);
            showNotification('Erro ao carregar usuários: ' + error.message, 'error');
            setLoading(false);
        });
        // Note: onValue keeps listening. For just one fetch, use get(usersRef)
    }, []);

    useEffect(() => {
        loadUsers();
        // If using onValue, cleanup listener on unmount:
        // return () => ref(database, 'users').off();
    }, [loadUsers]); // Run once on mount

    // Effect to apply filters whenever users, searchTerm, or filters change
    useEffect(() => {
        let result = [...users];

        // Apply search
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            result = result.filter(user =>
                (user.name?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (user.email?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (user.department?.toLowerCase() || '').includes(lowerSearchTerm) ||
                (user.rfidTagId?.toLowerCase() || '').includes(lowerSearchTerm) // Added RFID to search
            );
        }

        // Apply filters
        if (filters.department) {
            result = result.filter(user => user.department === filters.department);
        }
        if (filters.role) {
            result = result.filter(user => user.role === filters.role);
        }
        if (filters.status) {
            result = result.filter(user => user.status === filters.status);
        }

        // Sort result
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setFilteredUsers(result);
        setCurrentPage(1); // Reset to first page on filter change
    }, [users, searchTerm, filters]);


    // --- Event Handlers ---

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };
    // Debounced version for performance
    const debouncedSearch = useCallback(debounce(handleSearchChange, 300), []);


    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setSearchTerm('');
        setFilters({ department: '', role: '', status: '' });
        // Also reset the select elements visually if needed
        document.getElementById('search-users').value = '';
        document.getElementById('filter-department').value = '';
        document.getElementById('filter-role').value = '';
        document.getElementById('filter-status').value = '';
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const openAddUserModal = () => {
        setCurrentUser(null); // Ensure it's add mode
        setFormData({ name: '', email: '', department: '', role: '', status: 'active', password: '', rfidTagId: '' }); // Reset form data including rfidTagId
        setIsPasswordVisible(false); // Reset password visibility
        setIsModalOpen(true);
    };

    const openEditUserModal = (user) => {
        setCurrentUser(user);
        setFormData({ // Pre-fill form
            name: user.name || '',
            email: user.email || '',
            department: user.department || '',
            role: user.role || '',
            status: user.status || 'active',
            password: '', // Password is not edited here directly
            rfidTagId: user.rfidTagId || '' // Pre-fill rfidTagId
        });
        setIsPasswordVisible(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null); // Clear editing user on close
        setFormData({ name: '', email: '', department: '', role: '', status: 'active', password: '', rfidTagId: '' }); // Reset form including rfidTagId
    };

    const handleFormInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveUser = async () => {
        // Basic Validation
        if (!formData.name.trim()) return showNotification('O nome é obrigatório', 'error');
        if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) return showNotification('Email inválido', 'error');
        if (!formData.department) return showNotification('Selecione um departamento', 'error');
        if (!formData.role) return showNotification('Selecione uma função', 'error');
        // Optional: Add validation for rfidTagId format if needed

        const userData = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(), // Store email lowercase
            department: formData.department,
            role: formData.role,
            status: formData.status,
            rfidTagId: formData.rfidTagId.trim() // Include rfidTagId
        };

        setLoading(true); // Indicate saving

        if (currentUser) { // --- Edit User ---
            // Check if email is being changed and if it already exists (excluding current user)
            if (userData.email !== currentUser.email) {
                const emailQuery = query(ref(database, 'users'), orderByChild('email'), equalTo(userData.email));
                const snapshot = await get(emailQuery);
                if (snapshot.exists()) {
                    showNotification('Este e-mail já está em uso por outro usuário.', 'error');
                    setLoading(false);
                    return;
                }
                // Note: Updating email in Firebase Auth is a sensitive operation,
                // often requiring re-authentication. We'll skip it for this example
                // and only update the database record.
                console.warn("Email change detected, but Auth email update is not implemented in this example.");
            }

             // Check if rfidTagId is being changed and if it already exists (excluding current user)
             if (userData.rfidTagId && userData.rfidTagId !== (currentUser.rfidTagId || '')) {
                const rfidQuery = query(ref(database, 'users'), orderByChild('rfidTagId'), equalTo(userData.rfidTagId));
                const snapshot = await get(rfidQuery);
                if (snapshot.exists()) {
                    showNotification('Este ID de RFID já está associado a outro usuário.', 'error');
                    setLoading(false);
                    return;
                }
            }


            try {
                await update(ref(database, `users/${currentUser.id}`), userData);
                // Maybe update displayName in Auth if needed, but requires care
                showNotification('Usuário atualizado com sucesso', 'success');
                closeModal();
                // loadUsers(); // Data reloads via onValue listener if used
            } catch (error) {
                console.error('Erro ao atualizar usuário:', error);
                showNotification('Erro ao atualizar usuário: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }

        } else { // --- Add User ---
            if (!formData.password || formData.password.length < 6) {
                setLoading(false);
                return showNotification('A senha inicial deve ter pelo menos 6 caracteres', 'error');
            }
            // Check if email exists
            const emailQuery = query(ref(database, 'users'), orderByChild('email'), equalTo(userData.email));
            try {
                const snapshot = await get(emailQuery);
                if (snapshot.exists()) {
                    showNotification('Este e-mail já está em uso', 'error');
                    setLoading(false);
                    return;
                }

                 // Check if rfidTagId exists for a new user
                 if (userData.rfidTagId) {
                    const rfidQuery = query(ref(database, 'users'), orderByChild('rfidTagId'), equalTo(userData.rfidTagId));
                    const rfidSnapshot = await get(rfidQuery);
                    if (rfidSnapshot.exists()) {
                        showNotification('Este ID de RFID já está associado a outro usuário.', 'error');
                        setLoading(false);
                        return;
                    }
                }


                // 1. Create user in Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, userData.email, formData.password);
                const newUser = userCredential.user;

                // 2. (Optional but good) Update Auth profile display name
                await updateProfile(newUser, { displayName: userData.name });

                // 3. Add user data to Realtime Database
                userData.created_at = new Date().toISOString();
                userData.auth_uid = newUser.uid; // Link DB record to Auth user
                const newUserRef = push(ref(database, 'users')); // Generate unique ID
                await update(ref(database, `users/${newUserRef.key}`), userData); // Use generated key

                showNotification('Usuário criado com sucesso!', 'success');
                closeModal();
                // loadUsers(); // Data reloads via onValue listener if used

            } catch (error) {
                console.error('Erro ao criar usuário:', error);
                // Handle specific auth errors like 'auth/email-already-in-use' if needed
                if (error.code === 'auth/email-already-in-use') {
                    showNotification('Erro: O e-mail fornecido já está em uso por outra conta.', 'error');
                } else {
                    showNotification('Erro ao criar usuário: ' + error.message, 'error');
                }
            } finally {
                setLoading(false);
            }
        }
    };


    const openConfirmDelete = (user) => {
        setUserToDelete(user);
        setIsConfirmOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmOpen(false);
        setUserToDelete(null);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setLoading(true);
        try {
            // Note: Deleting from Realtime Database ONLY.
            // Deleting from Firebase Auth is more complex and requires backend logic or admin SDK
            // as it's a privileged operation. We'll just remove the DB record here.
            await remove(ref(database, `users/${userToDelete.id}`));
            showNotification('Usuário excluído com sucesso (somente do banco de dados)', 'success');
            closeConfirmModal();
            // loadUsers(); // Data reloads via onValue listener
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            showNotification('Erro ao excluir usuário: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const exportUsers = (format) => {
        if (filteredUsers.length === 0) {
            return showNotification('Não há usuários para exportar', 'warning');
        }
        showNotification(`Exportando ${filteredUsers.length} usuários para ${format.toUpperCase()}...`, 'info');
        // Implement actual export logic (CSV or PDF generation) here
        console.log(`TODO: Implement ${format} export`);
        if (format === 'csv') {
            // Basic CSV Example
            const headers = ["Nome", "Email", "Departamento", "Função", "Status", "Criado em", "ID RFID"]; // Added ID RFID header
            const rows = filteredUsers.map(u => [
                u.name, u.email, u.department || '-', translateRole(u.role), formatStatus(u.status), formatDate(u.created_at), u.rfidTagId || '-' // Added rfidTagId
            ]);
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().substring(0, 10);
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `securelab_usuarios_${timestamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
        } else {
            showNotification('Exportação PDF ainda não implementada.', 'warning');
        }
        setIsExportMenuOpen(false); // Close menu after action
    };

    // --- Pagination Calculation ---
    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredUsers.length);
    const currentUsersPage = filteredUsers.slice(startIndex, endIndex);

    // --- Authorized Doors Modal Logic ---

    const fetchDataForAuthorizedDoorsModal = async (user) => {
        if (!user) return;
        setLoadingModalDoors(true);
        try {
            const doorsRef = ref(database, 'doors');
            const devicesRef = ref(database, 'devices');

            const [doorsSnapshot, devicesSnapshot] = await Promise.all([
                get(doorsRef),
                get(devicesRef)
            ]);

            const doorsData = doorsSnapshot.val() || {};
            const localDevicesData = devicesSnapshot.val() || {}; // Use local var to avoid stale state issues in map
            setAllDevicesData(localDevicesData); // Store for potential future use if needed outside this immediate scope

            const doorsArray = Object.entries(doorsData).map(([id, door]) => ({ id, ...door }));

            const processedDoorsList = doorsArray.map(door => {
                let isAuthorized = false;
                // Ensure user.id is valid before using it in the path
                if (user && user.id && door.device && localDevicesData[door.device] && localDevicesData[door.device].authorized_tags) {
                    isAuthorized = localDevicesData[door.device].authorized_tags[user.id] === true;
                }
                return { ...door, isAuthorized };
            });
            
            processedDoorsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAllDoorsListForModal(processedDoorsList);

        } catch (error) {
            console.error("Erro ao carregar dados para o modal de portas autorizadas:", error);
            showNotification("Erro ao carregar dados das portas: " + error.message, 'error');
            setAllDoorsListForModal([]);
        } finally {
            setLoadingModalDoors(false);
        }
    };

    const openAuthorizedDoorsModal = (user) => {
        setCurrentUserForDoors(user);
        setIsAuthorizedDoorsModalOpen(true);
        setModalDoorsSearchTerm('');
        setModalDoorsCurrentPage(1);
        fetchDataForAuthorizedDoorsModal(user); 
    };

    const closeAuthorizedDoorsModal = () => {
        setIsAuthorizedDoorsModalOpen(false);
        setCurrentUserForDoors(null);
        setAllDoorsListForModal([]);
        setAllDevicesData({}); // Clear stored devices data
        setModalDoorsSearchTerm('');
        setModalDoorsCurrentPage(1); 
    };

    const handleToggleDoorAuthorization = async (door, isCurrentlyAuthorized) => {
        if (!currentUserForDoors || !currentUserForDoors.id || !door.id) { // Added check for currentUserForDoors.id
            showNotification("Usuário ou porta inválida.", 'error');
            return;
        }
        if (!door.device) {
            showNotification(`A porta "${door.name}" não está associada a nenhum dispositivo. Não é possível alterar a autorização.`, 'warning');
            return;
        }

        setLoadingModalDoors(true); 

        const userId = currentUserForDoors.id;
        const deviceId = door.device;
        const authPath = `devices/${deviceId}/authorized_tags/${userId}`;

        try {
            if (isCurrentlyAuthorized) {
                await set(ref(database, authPath), false); // Explicitly set to false
                showNotification(`Acesso do usuário ${currentUserForDoors.name} à porta ${door.name} removido.`, 'success');
            } else {
                await set(ref(database, authPath), true);
                showNotification(`Usuário ${currentUserForDoors.name} autorizado para a porta ${door.name}.`, 'success');
            }
            // Refresh data in the modal by updating the specific door's authorization status locally
            setAllDoorsListForModal(prevList => 
                prevList.map(d => d.id === door.id ? { ...d, isAuthorized: !isCurrentlyAuthorized } : d)
            );

        } catch (error) {
            console.error("Erro ao alternar autorização da porta:", error);
            showNotification("Erro ao atualizar autorização: " + error.message, 'error');
        } finally {
            setLoadingModalDoors(false);
        }
    };

    // Search and Pagination for Authorized Doors Modal
    const handleModalDoorsSearchChange = (event) => {
        setModalDoorsSearchTerm(event.target.value);
        setModalDoorsCurrentPage(1);
    };

    const handleModalDoorsPageChange = (page) => {
        setModalDoorsCurrentPage(page);
    };

    const filteredModalDoors = allDoorsListForModal.filter(door => {
        if (!modalDoorsSearchTerm) return true;
        const lowerSearch = modalDoorsSearchTerm.toLowerCase();
        return (
            (door.name?.toLowerCase() || '').includes(lowerSearch) ||
            (door.location?.toLowerCase() || '').includes(lowerSearch)
        );
    });

    const modalDoorsTotalPages = Math.ceil(filteredModalDoors.length / MODAL_DOORS_PAGE_SIZE);
    const modalDoorsStartIndex = (modalDoorsCurrentPage - 1) * MODAL_DOORS_PAGE_SIZE;
    const modalDoorsEndIndex = Math.min(modalDoorsStartIndex + MODAL_DOORS_PAGE_SIZE, filteredModalDoors.length);
    const currentModalDoorsPageItems = filteredModalDoors.slice(modalDoorsStartIndex, modalDoorsEndIndex);

    return (
        <Layout>
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faUsers} /> Gerenciamento de Usuários</h1>
                <button className="btn btn-primary" onClick={openAddUserModal}>
                    <FontAwesomeIcon icon={faPlus} /> Novo Usuário
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"> {/* Added flex-wrap and gap */}
                        <h3 className="mb-0">Filtros</h3>
                        {/* Search Input within Filters Card */}
                        <div className="header-search" style={{ minWidth: '250px', maxWidth: '400px', flexGrow: 1 }}>
                            <FontAwesomeIcon icon={faSearch} style={{ color: 'var(--secondary-color)', marginRight: '10px'}} />
                            <input
                                type="text"
                                id="search-users"
                                placeholder="Buscar por nome, email, depto, RFID..." // Updated placeholder
                                onChange={handleSearchChange} // Direct change for immediate feedback or use debouncedSearch
                                style={{ background: 'none', border: 'none', outline: 'none', flex: 1, padding: '7px 0'}}
                            />
                        </div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters}> {/* Changed to secondary */}
                            <FontAwesomeIcon icon={faSyncAlt} /> Limpar Filtros
                        </button>
                    </div>
                    <div className="row">
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-department">Departamento</label>
                            <select id="filter-department" name="department" className="form-control" value={filters.department} onChange={handleFilterChange}>
                                <option value="">Todos</option>
                                <option value="TI">TI</option>
                                <option value="Pesquisa">Pesquisa</option>
                                <option value="Laboratório">Laboratório</option>
                                <option value="Administração">Administração</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-role">Função</label>
                            <select id="filter-role" name="role" className="form-control" value={filters.role} onChange={handleFilterChange}>
                                <option value="">Todas</option>
                                <option value="admin">Administrador</option>
                                <option value="user">Usuário</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-2">
                            <label htmlFor="filter-status">Status</label>
                            <select id="filter-status" name="status" className="form-control" value={filters.status} onChange={handleFilterChange}>
                                <option value="">Todos</option>
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="card-header">
                    <h3>Lista de Usuários ({filteredUsers.length})</h3>
                    <div className="card-actions">
                        <button className="icon-button" onClick={loadUsers} title="Atualizar Lista">
                            <FontAwesomeIcon icon={faSyncAlt} />
                        </button>
                        <div className="dropdown">
                            <button className="icon-button" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} title="Exportar">
                                <FontAwesomeIcon icon={faEllipsisV} />
                            </button>
                            {/* Use conditional rendering for dropdown */}
                            {isExportMenuOpen && (
                                <div className="dropdown-menu show" style={{ right: 0, top: '100%'}}> {/* Added show class and basic positioning */}
                                    <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportUsers('csv'); }}>
                                        <FontAwesomeIcon icon={faFileCsv} /> Exportar CSV
                                    </a>
                                    <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); exportUsers('pdf'); }}>
                                        <FontAwesomeIcon icon={faFilePdf} /> Exportar PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {/* Desktop Table View */}
                    <div className="table-responsive d-none d-md-block"> {/* Hide on screens smaller than md (768px) */}
                        <table className="table table-hover">
                            <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Departamento</th>
                                <th>Função</th>
                                <th>Status</th>
                                <th>Criado em</th>
                                <th>ID RFID</th> {/* Added RFID column header */}
                                <th>Ações</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading && (
                                <tr><td colSpan="8" className="text-center">Carregando...</td></tr>
                            )}
                            {!loading && currentUsersPage.length > 0 && (
                                currentUsersPage.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>{user.department || '-'}</td>
                                        <td>{translateRole(user.role)}</td>
                                        <td>
                                                <span className={`badge-status badge-${getStatusClass(user.status)}`}>
                                                    {formatStatus(user.status)}
                                                </span>
                                        </td>
                                        <td>{formatDate(user.created_at)}</td>
                                        <td>{user.rfidTagId || '-'}</td> {/* Display rfidTagId */}
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn action-btn-info" onClick={() => openAuthorizedDoorsModal(user)} title="Gerenciar Acesso às Portas">
                                                    <FontAwesomeIcon icon={faDoorOpen} />
                                                </button>
                                                <button className="action-btn action-btn-edit" onClick={() => openEditUserModal(user)} title="Editar">
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button className="action-btn action-btn-delete" onClick={() => openConfirmDelete(user)} title="Excluir">
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {!loading && currentUsersPage.length === 0 && (
                                <tr><td colSpan="8" className="text-center">Nenhum usuário encontrado com os filtros aplicados.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="users-card-list d-md-none"> {/* Show only on screens smaller than md (768px) */}
                        {loading ? (
                            <p className="text-center">Carregando...</p>
                        ) : currentUsersPage.length > 0 ? (
                            currentUsersPage.map(user => (
                                <div key={user.id} className="user-card card mb-3">
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <h5 className="card-title mb-0">{user.name}</h5>
                                            <span className={`badge-status badge-${getStatusClass(user.status)}`}>
                                                {formatStatus(user.status)}
                                            </span>
                                        </div>
                                        <p className="card-text mb-1">
                                            <strong>Email:</strong> {user.email}
                                        </p>
                                        <p className="card-text mb-1">
                                            <strong>Depto:</strong> {user.department || '-'}
                                        </p>
                                        <p className="card-text mb-1">
                                            <strong>Função:</strong> {translateRole(user.role)}
                                        </p>
                                         <p className="card-text mb-1"> {/* Added RFID to mobile card */}
                                            <strong>ID RFID:</strong> {user.rfidTagId || '-'}
                                        </p>
                                        <p className="card-text mb-2">
                                            <strong>Criado em:</strong> {formatDate(user.created_at)}
                                        </p>
                                        <div className="action-buttons justify-content-end"> {/* Align buttons right */}
                                            <button className="action-btn action-btn-info" onClick={() => openAuthorizedDoorsModal(user)} title="Gerenciar Acesso às Portas">
                                                <FontAwesomeIcon icon={faDoorOpen} />
                                            </button>
                                            <button className="action-btn action-btn-edit" onClick={() => openEditUserModal(user)} title="Editar">
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button className="action-btn action-btn-delete" onClick={() => openConfirmDelete(user)} title="Excluir">
                                                <FontAwesomeIcon icon={faTrashAlt} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center">Nenhum usuário encontrado com os filtros aplicados.</p>
                        )}
                    </div>

                    {/* Pagination (Common for both views) */}
                    {!loading && filteredUsers.length > PAGE_SIZE && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={filteredUsers.length}
                            itemsPerPage={PAGE_SIZE} // Added itemsPerPage prop
                        />
                    )}
                </div>
            </div>

            {/* Add/Edit User Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={currentUser ? 'Editar Usuário' : 'Novo Usuário'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal} disabled={loading}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveUser} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </>
                }
            >
                <form onSubmit={(e) => { e.preventDefault(); handleSaveUser(); }}>
                    <div className="form-group">
                        <label htmlFor="name">Nome</label>
                        <input
                            type="text"
                            className="form-control"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleFormInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            className="form-control"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleFormInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="department">Departamento</label>
                        <select
                            className="form-control"
                            id="department"
                            name="department"
                            value={formData.department}
                            onChange={handleFormInputChange}
                            required
                        >
                            <option value="">Selecione...</option>
                            <option value="TI">TI</option>
                            <option value="Pesquisa">Pesquisa</option>
                            <option value="Laboratório">Laboratório</option>
                            <option value="Administração">Administração</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="role">Função</label>
                        <select
                            className="form-control"
                            id="role"
                            name="role"
                            value={formData.role}
                            onChange={handleFormInputChange}
                            required
                        >
                            <option value="">Selecione...</option>
                            <option value="admin">Administrador</option>
                            <option value="user">Usuário</option>
                        </select>
                    </div>
                     <div className="form-group"> {/* Added RFID input field */}
                        <label htmlFor="rfidTagId">ID do Cartão RFID</label>
                        <input
                            type="text"
                            className="form-control"
                            id="rfidTagId"
                            name="rfidTagId"
                            value={formData.rfidTagId}
                            onChange={handleFormInputChange}
                            placeholder="Ex: 08 FA 6A 2D"
                        />
                         <small className="form-text text-muted">Opcional. Associe um cartão RFID a este usuário.</small>
                    </div>
                    <div className="form-group">
                        <label htmlFor="status">Status</label>
                        <select
                            className="form-control"
                            id="status"
                            name="status"
                            value={formData.status}
                            onChange={handleFormInputChange}
                            required
                        >
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                    {!currentUser && ( // Only show password field for new users
                        <div className="form-group">
                            <label htmlFor="password">Senha Inicial</label>
                            <div className="input-group">
                                <input
                                    type={isPasswordVisible ? 'text' : 'password'}
                                    className="form-control"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleFormInputChange}
                                    required={!currentUser} // Required only for new users
                                    minLength="6"
                                />
                                <div className="input-group-append">
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                    >
                                        <FontAwesomeIcon icon={isPasswordVisible ? faEyeSlash : faEye} />
                                    </button>
                                </div>
                            </div>
                            <small className="form-text text-muted">Mínimo de 6 caracteres.</small>
                        </div>
                    )}
                </form>
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal
                isOpen={isConfirmOpen}
                onClose={closeConfirmModal}
                title="Confirmar Exclusão"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeConfirmModal} disabled={loading}>Cancelar</button>
                        <button className="btn btn-danger" onClick={handleDeleteUser} disabled={loading}>
                            {loading ? 'Excluindo...' : 'Excluir'}
                        </button>
                    </>
                }
            >
                <p>Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?</p>
                <small className="form-text text-danger">Esta ação removerá o registro do usuário do banco de dados, mas não da autenticação do Firebase. A exclusão completa requer passos adicionais.</small>
            </Modal>

            {/* Authorized Doors Modal */}
            <Modal
                isOpen={isAuthorizedDoorsModalOpen}
                onClose={closeAuthorizedDoorsModal}
                title={`Gerenciar Acesso às Portas - ${currentUserForDoors?.name || ''}`}
                size="xl"
                footer={
                    <button className="btn btn-secondary" onClick={closeAuthorizedDoorsModal}>Fechar</button>
                }
            >
                <div className="mb-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nome ou localização da porta..."
                        value={modalDoorsSearchTerm}
                        onChange={handleModalDoorsSearchChange}
                    />
                </div>
                {loadingModalDoors ? (
                    <p className="text-center">Carregando portas...</p>
                ) : currentModalDoorsPageItems.length > 0 ? (
                    <>
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Nome da Porta</th>
                                        <th>Localização</th>
                                        <th className="text-center">Autorizado</th>
                                        <th className="text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentModalDoorsPageItems.map(door => (
                                        <tr key={door.id}>
                                            <td>{door.name || 'Sem nome'}</td>
                                            <td>{door.location || '-'}</td>
                                            <td className="text-center">
                                                {door.device ? (
                                                    <span className={`badge ${door.isAuthorized ? 'bg-success' : 'bg-danger'}`}>
                                                        {door.isAuthorized ? 'Sim' : 'Não'}
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary">N/A</span>
                                                )}
                                            </td>
                                            <td className="text-center">
                                                {door.device ? (
                                                    <button
                                                        className={`btn btn-sm ${door.isAuthorized ? 'btn-danger' : 'btn-success'}`}
                                                        onClick={() => handleToggleDoorAuthorization(door, door.isAuthorized)}
                                                        disabled={loadingModalDoors} // Or a more specific loading state for the row/button
                                                        title={door.isAuthorized ? 'Remover Acesso' : 'Conceder Acesso'}
                                                    >
                                                        {door.isAuthorized ? 'Desautorizar' : 'Autorizar'}
                                                    </button>
                                                ) : (
                                                    <small className="text-muted">Sem dispositivo</small>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredModalDoors.length > MODAL_DOORS_PAGE_SIZE && (
                            <Pagination
                                currentPage={modalDoorsCurrentPage}
                                totalPages={modalDoorsTotalPages}
                                onPageChange={handleModalDoorsPageChange}
                                totalItems={filteredModalDoors.length}
                                itemsPerPage={MODAL_DOORS_PAGE_SIZE}
                            />
                        )}
                    </>
                ) : (
                    <p className="text-center">
                        {modalDoorsSearchTerm 
                            ? 'Nenhuma porta encontrada com o termo buscado.'
                            : (allDoorsListForModal.length === 0 && !loadingModalDoors) 
                                ? 'Nenhuma porta cadastrada no sistema.'
                                : 'Nenhuma porta corresponde aos critérios ou este usuário não tem acesso configurável no momento.'
                        }
                    </p>
                )}
            </Modal>
        </Layout>
    );
}

export default Users;
