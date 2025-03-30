// src/utils/formatters.js

// src/utils/formatters.js

// Funções existentes...
export function formatDate(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date)) return 'Data inválida';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch (e) {
        return 'Data inválida';
    }
}

export function formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date)) return 'Data/hora inválida';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch(e) {
        return 'Data/hora inválida';
    }
}

export function getStatusClass(status) {
    const classMap = {
        'active': 'success',
        'inactive': 'secondary',
        'locked': 'success', // Ou 'danger'
        'unlocked': 'danger', // Ou 'success'
        'online': 'success',
        'offline': 'danger',
        'warning': 'warning',
        'access_granted': 'success',
        'access_denied': 'danger',
        'door_locked': 'warning', // Ou use a mesma classe de 'locked'
        'door_unlocked': 'info', // Ou use a mesma classe de 'unlocked'
    };
    return classMap[status] || 'secondary';
}

export function formatStatus(status) {
    const statusMap = {
        'active': 'Ativo',
        'inactive': 'Inativo',
        'locked': 'Trancada',
        'unlocked': 'Destrancada',
        'online': 'Online',
        'offline': 'Offline',
        'warning': 'Alerta',
        'access_granted': 'Acesso Permitido',
        'access_denied': 'Acesso Negado',
        'door_locked': 'Porta Trancada',
        'door_unlocked': 'Porta Destrancada'
    };
    // Substitui underscores por espaços e capitaliza se não encontrar no map
    return statusMap[status] || status?.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) || 'Desconhecido';
}


// --- ADICIONAR ESTA FUNÇÃO ---
/**
 * Traduz códigos de função/papel para texto legível.
 * @param {string} role - O código do papel (e.g., 'admin', 'user').
 * @returns {string} O nome traduzido do papel.
 */
export function translateRole(role) {
    const roleMap = {
        'admin': 'Administrador',
        'user': 'Usuário'
        // Adicione outros papéis se necessário
    };
    return roleMap[role] || role || 'Desconhecido'; // Retorna o próprio role ou 'Desconhecido' se não mapeado
}
// --- FIM DA FUNÇÃO ADICIONADA ---

// Adicione outras funções de common.js que você precise aqui e exporte-as
// Exemplo:
// export function capitalize(string) { ... }