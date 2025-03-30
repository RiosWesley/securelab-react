// src/pages/Settings.jsx
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faEye, faEyeSlash, faCopy, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
// Import other icons as needed for specific tabs


function Settings() {
    const [activeTab, setActiveTab] = useState('system-tab'); // Default tab

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
    };

    // TODO: Add state and handlers for form inputs and saving later
    // Example state for one form:
    const [orgInfo, setOrgInfo] = useState({
        name: "SecureLab RFID",
        address: "Av. Tecnologia, 1000",
        email: "contato@securelab.com",
        phone: "(11) 4000-0000"
    });
    const handleOrgInfoChange = (e) => {
        const { name, value } = e.target;
        setOrgInfo(prev => ({ ...prev, [name]: value }));
    };
    const saveOrgInfo = () => {
        console.log("Saving Org Info (simulated):", orgInfo);
        showNotification("Informações da organização salvas (simulado).", "success");
        // TODO: Save to Firebase '/settings/organization' or similar
    };


    return (
        <Layout>
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faCog} /> Configurações do Sistema</h1>
                {/* Add save all button? */}
            </div>

            {/* Tabs Navigation */}
            <div className="settings-tabs">
                <div className="tab-buttons">
                    {/* Map through tabs for cleaner code */}
                    {[
                        { id: 'system-tab', label: 'Sistema' },
                        { id: 'security-tab', label: 'Segurança' },
                        { id: 'devices-tab', label: 'Dispositivos' },
                        { id: 'integration-tab', label: 'Integração' },
                        { id: 'notification-tab', label: 'Notificações' },
                        { id: 'appearance-tab', label: 'Aparência' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content">

                {/* System Tab */}
                <div id="system-tab" className={`tab-pane ${activeTab === 'system-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Informações da Organização</h3></div>
                        <div className="card-body">
                            <form onSubmit={(e) => e.preventDefault()}>
                                <div className="form-group">
                                    <label htmlFor="org-name">Nome da Organização</label>
                                    <input type="text" id="org-name" name="name" className="form-control" value={orgInfo.name} onChange={handleOrgInfoChange} />
                                </div>
                                {/* Address, Email, Phone inputs similar to above */}
                                <div className="form-group">
                                    <label htmlFor="org-address">Endereço</label>
                                    <input type="text" id="org-address" name="address" className="form-control" value={orgInfo.address} onChange={handleOrgInfoChange}/>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="org-email">Email de Contato</label>
                                    <input type="email" id="org-email" name="email" className="form-control" value={orgInfo.email} onChange={handleOrgInfoChange}/>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="org-phone">Telefone</label>
                                    <input type="text" id="org-phone" name="phone" className="form-control" value={orgInfo.phone} onChange={handleOrgInfoChange}/>
                                </div>

                                <button type="button" className="btn btn-primary" onClick={saveOrgInfo}>Salvar Alterações</button>
                            </form>
                        </div>
                    </div>
                    {/* Regional Settings Card (similar structure) */}
                    {/* Email Settings Card (similar structure) */}
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configurações Regionais</h3></div>
                        <div className="card-body"> {/* TODO: Add state and handlers */} </div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configurações de Email</h3></div>
                        <div className="card-body"> {/* TODO: Add state and handlers */} </div>
                    </div>
                </div>

                {/* Security Tab */}
                <div id="security-tab" className={`tab-pane ${activeTab === 'security-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Políticas de Senha</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Sessão e Autenticação</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Logs e Auditoria</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                </div>

                {/* Devices Tab */}
                <div id="devices-tab" className={`tab-pane ${activeTab === 'devices-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configurações de Dispositivos RFID</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configuração de Firmware</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configuração de Fechaduras</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                </div>

                {/* Integration Tab */}
                <div id="integration-tab" className={`tab-pane ${activeTab === 'integration-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>API e Webhooks</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Integração com Sistemas Externos</h3></div>
                        <div className="card-body">{/* TODO: Content, including toggle switches */}</div>
                    </div>
                </div>

                {/* Notification Tab */}
                <div id="notification-tab" className={`tab-pane ${activeTab === 'notification-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Configurações de Alertas</h3></div>
                        <div className="card-body">{/* TODO: Content */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Canais de Notificação</h3></div>
                        <div className="card-body">{/* TODO: Content, including toggle switches */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Escalonamento de Alertas</h3></div>
                        <div className="card-body">{/* TODO: Content, including list management */}</div>
                    </div>
                </div>

                {/* Appearance Tab */}
                <div id="appearance-tab" className={`tab-pane ${activeTab === 'appearance-tab' ? 'active' : ''}`}>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Tema e Cores</h3></div>
                        <div className="card-body">{/* TODO: Content, including theme/color pickers */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Logotipo e Branding</h3></div>
                        <div className="card-body">{/* TODO: Content, including file upload */}</div>
                    </div>
                    <div className="card mb-4">
                        <div className="card-header"><h3>Layout da Interface</h3></div>
                        <div className="card-body">{/* TODO: Content, including layout previews */}</div>
                    </div>
                </div>

            </div>
        </Layout>
    );
}

export default Settings;