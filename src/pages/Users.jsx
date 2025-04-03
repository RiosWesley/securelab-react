// src/pages/Users.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal'; // Import the reusable Modal
import Pagination from '../components/Pagination'; // Create this component later
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faPlus, faSyncAlt, faEllipsisV, faFileCsv, faFilePdf, faEdit, faTrashAlt, faEye, faEyeSlash, faSearch } from '@fortawesome/free-solid-svg-icons';
import { ref, onValue, get, push, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Import auth functions
import { database, auth } from '../firebase/firebaseConfig';
import { showNotification } from '../utils/notifications';
import { formatDate, getStatusClass, formatStatus, translateRole } from '../utils/formatters';
import { debounce } from '../utils/helpers'; // Create this helper file later

// Constants
const PAGE_SIZE = 10;

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
        name: '', email: '', department: '', role: '', status: 'active', password: ''
    });

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
                (user.department?.toLowerCase() || '').includes(lowerSearchTerm)
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
        setFormData({ name: '', email: '', department: '', role: '', status: 'active', password: '' }); // Reset form data
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
            password: '' // Password is not edited here directly
        });
        setIsPasswordVisible(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null); // Clear editing user on close
        setFormData({ name: '', email: '', department: '', role: '', status: 'active', password: '' }); // Reset form
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

        const userData = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(), // Store email lowercase
            department: formData.department,
            role: formData.role,
            status: formData.status,
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
            const headers = ["Nome", "Email", "Departamento", "Função", "Status", "Criado em"];
            const rows = filteredUsers.map(u => [
                u.name, u.email, u.department || '-', translateRole(u.role), formatStatus(u.status), formatDate(u.created_at)
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
                                placeholder="Buscar por nome, email, depto..."
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
                                <th>Ações</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center">Carregando...</td></tr>
                            ) : currentUsersPage.length > 0 ? (
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
                                        <td>
                                            <div className="action-buttons">
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
                            ) : (
                                <tr><td colSpan="7" className="text-center">Nenhum usuário encontrado com os filtros aplicados.</td></tr>
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
                                        <p className="card-text mb-2">
                                            <strong>Criado em:</strong> {formatDate(user.created_at)}
                                        </p>
                                        <div className="action-buttons justify-content-end"> {/* Align buttons right */}
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
                            itemsPerPage={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>

            {/* Add/Edit User Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={currentUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeModal}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveUser} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </>
                }
            >
                {/* User Form Content */}
                <form id="user-form" onSubmit={(e) => e.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="modal-user-name">Nome Completo</label>
                        <input type="text" id="modal-user-name" name="name" className="form-control" value={formData.name} onChange={handleFormInputChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-user-email">Email</label>
                        <input type="email" id="modal-user-email" name="email" className="form-control" value={formData.email} onChange={handleFormInputChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-user-department">Departamento</label>
                        <select id="modal-user-department" name="department" className="form-control" value={formData.department} onChange={handleFormInputChange} required>
                            <option value="">Selecione...</option>
                            <option value="TI">TI</option>
                            <option value="Pesquisa">Pesquisa</option>
                            <option value="Laboratório">Laboratório</option>
                            <option value="Administração">Administração</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-user-role">Função</label>
                        <select id="modal-user-role" name="role" className="form-control" value={formData.role} onChange={handleFormInputChange} required>
                            <option value="">Selecione...</option>
                            <option value="admin">Administrador</option>
                            <option value="user">Usuário</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-user-status">Status</label>
                        <select id="modal-user-status" name="status" className="form-control" value={formData.status} onChange={handleFormInputChange} required>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                    {/* Password field only for adding new user */}
                    {!currentUser && (
                        <div className="form-group" id="password-group">
                            <label htmlFor="modal-user-password">Senha Inicial</label>
                            <div className="password-input">
                                <input
                                    type={isPasswordVisible ? 'text' : 'password'}
                                    id="modal-user-password"
                                    name="password"
                                    className="form-control"
                                    value={formData.password}
                                    onChange={handleFormInputChange}
                                    required={!currentUser} /* Required only when adding */
                                />
                                <button type="button" className="password-toggle" onClick={() => setIsPasswordVisible(!isPasswordVisible)}>
                                    <FontAwesomeIcon icon={isPasswordVisible ? faEyeSlash : faEye} />
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal
                isOpen={isConfirmOpen}
                onClose={closeConfirmModal}
                title="Confirmar Exclusão"
                size="sm" // Use small size for confirmation
                footer={
                    <>
                        <button className="btn btn-outline-secondary" onClick={closeConfirmModal}>Cancelar</button>
                        <button className="btn btn-danger" onClick={handleDeleteUser} disabled={loading}>
                            {loading ? 'Excluindo...' : 'Excluir'}
                        </button>
                    </>
                }
            >
                <p>Tem certeza que deseja excluir o usuário "{userToDelete?.name}"? Esta ação não pode ser desfeita.</p>
                <p><small>(Nota: A conta de autenticação associada não será excluída.)</small></p>
            </Modal>

        </Layout>
    );
}

export default Users;
