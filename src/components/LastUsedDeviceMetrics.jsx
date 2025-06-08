import React, { useState, useEffect } from 'react';
import { ref, onValue, off, get, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../firebase/firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faMicrochip, faMemory, faWifi, faThermometerHalf, 
    faSyncAlt, faExclamationTriangle, faChartLine
} from '@fortawesome/free-solid-svg-icons';
import DeviceMetricsChart from './DeviceMetricsChart';
import Modal from './Modal';
import '../styles/device-metrics.css';

function LastUsedDeviceMetrics() {
    const [lastUsedDevice, setLastUsedDevice] = useState(null);
    const [deviceMetrics, setDeviceMetrics] = useState({
        cpu_usage: 0,
        ram_usage_percent: 0,
        firebase_latency_ms: 0,
        temperature_chip_c: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        let deviceUnsubscribe = null;
        let logsUnsubscribe = null;

        const setupDeviceListener = (deviceId, lastLogTimestamp) => {
            const deviceRef = ref(database, `devices/${deviceId}`);
            
            const handleDeviceData = (deviceSnapshot) => {
                const deviceData = deviceSnapshot.val();
                console.log('Device data received:', deviceData); // Debug log
                console.log('Device ID:', deviceId); // Debug log
                console.log('Available device properties:', Object.keys(deviceData || {})); // Debug log
                console.log('Raw metric values:', {
                    cpu_usage: deviceData.cpu_usage,
                    ram_usage_percent: deviceData.ram_usage_percent,
                    firebase_latency_ms: deviceData.firebase_latency_ms,
                    temperature_chip_c: deviceData.temperature_chip_c
                }); // Debug log
                
                if (deviceData) {
                    setLastUsedDevice({
                        id: deviceId,
                        ...deviceData,
                        lastAccess: lastLogTimestamp
                    });
                    
                    const metrics = {
                        cpu_usage: parseFloat(deviceData.cpu_usage) || 0,
                        ram_usage_percent: parseFloat(deviceData.ram_usage_percent) || 0,
                        firebase_latency_ms: parseInt(deviceData.firebase_latency_ms) || 0,
                        temperature_chip_c: parseFloat(deviceData.temperature_chip_c) || 0
                    };
                    
                    console.log('Extracted metrics (after parsing):', metrics); // Debug log
                    console.log('Setting device metrics with:', metrics); // Debug log
                    setDeviceMetrics(metrics);
                    setLastUpdate(new Date());
                    setError(null);
                } else {
                    setError('Dispositivo não encontrado');
                }
                setLoading(false);
            };

            // Configurar listener para atualizações em tempo real das métricas
            deviceUnsubscribe = onValue(deviceRef, handleDeviceData, (error) => {
                console.error('Erro ao buscar dispositivo:', error);
                setError('Erro ao carregar dados do dispositivo');
                setLoading(false);
            });
        };

        // Listener para logs de acesso (para detectar mudanças no último dispositivo utilizado)
        const logsRef = ref(database, 'access_logs');
        logsUnsubscribe = onValue(query(logsRef, orderByChild('timestamp'), limitToLast(1)), (snapshot) => {
            const logsData = snapshot.val();
            console.log('Logs data received:', logsData); // Debug log
            
            if (logsData) {
                const lastLog = Object.values(logsData)[0];
                console.log('Last log:', lastLog); // Debug log
                
                const deviceId = lastLog.door_id || lastLog.device_id;
                console.log('Extracted device ID:', deviceId); // Debug log
                
                if (deviceId) {
                    // Se mudou o dispositivo, cancelar listener anterior
                    if (deviceUnsubscribe) {
                        deviceUnsubscribe();
                    }
                    
                    // Configurar novo listener para o dispositivo mais recente
                    setupDeviceListener(deviceId, lastLog.timestamp);
                } else {
                    console.log('No device ID found in log'); // Debug log
                    setError('Nenhum dispositivo encontrado nos logs');
                    setLoading(false);
                }
            } else {
                console.log('No logs data found'); // Debug log
                // Fallback: tentar buscar o primeiro dispositivo disponível como exemplo
                const devicesRef = ref(database, 'devices');
                get(devicesRef).then((devicesSnapshot) => {
                    const devicesData = devicesSnapshot.val();
                    console.log('Fallback - All devices:', devicesData); // Debug log
                    
                    if (devicesData) {
                        const firstDeviceId = Object.keys(devicesData)[0];
                        console.log('Fallback - Using first device:', firstDeviceId); // Debug log
                        setupDeviceListener(firstDeviceId, new Date().toISOString());
                    } else {
                        setError('Nenhum dispositivo encontrado no sistema');
                        setLoading(false);
                    }
                }).catch((error) => {
                    console.error('Error fetching devices as fallback:', error);
                    setError('Erro ao carregar dispositivos');
                    setLoading(false);
                });
            }
        }, (error) => {
            console.error('Erro ao buscar logs:', error);
            setError('Erro ao carregar logs de atividade');
            setLoading(false);
        });

        // Cleanup function
        return () => {
            if (deviceUnsubscribe) {
                deviceUnsubscribe();
            }
            if (logsUnsubscribe) {
                logsUnsubscribe();
            }
        };
    }, []);

    const getStatusColor = (metric, value) => {
        switch(metric) {
            case 'cpu':
                return value > 80 ? 'danger' : value > 60 ? 'warning' : 'success';
            case 'ram':
                return value > 85 ? 'danger' : value > 70 ? 'warning' : 'success';
            case 'latency':
                return value > 500 ? 'danger' : value > 300 ? 'warning' : 'success';
            case 'temperature':
                return value > 70 ? 'danger' : value > 50 ? 'warning' : 'success';
            default:
                return 'success';
        }
    };

    const openMetricsModal = () => {
        setIsMetricsModalOpen(true);
    };

    const closeMetricsModal = () => {
        setIsMetricsModalOpen(false);
    };

    const formatLastAccess = (timestamp) => {
        if (!timestamp) return 'Não disponível';
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Agora mesmo';
        if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
        return date.toLocaleDateString('pt-BR');
    };

    const formatMetricValue = (value, unit, type = '') => {
        if (value === null || value === undefined) return 'N/A';
        if (value === 0 && type) return `0${unit} (sem dados)`;
        return `${value}${unit}`;
    };

    const hasValidMetrics = deviceMetrics.cpu_usage > 0 || 
                           deviceMetrics.ram_usage_percent > 0 || 
                           deviceMetrics.firebase_latency_ms > 0 || 
                           deviceMetrics.temperature_chip_c > 0;

    // Debug log for current deviceMetrics state
    console.log('Current deviceMetrics state:', deviceMetrics);
    console.log('Has valid metrics:', hasValidMetrics);

    if (loading) {
        return (
            <div className="card device-status-card-v2">
                <div className="card-header">
                    <h3>Último Dispositivo Utilizado</h3>
                </div>
                <div className="card-body">
                    <div className="text-center p-4">
                        <FontAwesomeIcon icon={faSyncAlt} spin size="2x" className="mb-3" />
                        <p>Carregando...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card device-status-card-v2">
                <div className="card-header">
                    <h3>Último Dispositivo Utilizado</h3>
                </div>
                <div className="card-body">
                    <div className="text-center p-4">
                        <FontAwesomeIcon icon={faExclamationTriangle} size="2x" className="mb-3 text-warning" />
                        <p className="text-danger">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="card device-status-card-v2">
                <div className="card-header">
                    <div>
                        <h3>Último Dispositivo Utilizado</h3>
                        {lastUpdate && (
                            <small className="text-muted">
                                Métricas atualizadas: {lastUpdate.toLocaleTimeString()}
                            </small>
                        )}
                    </div>
                    <div className="card-actions">
                        <button 
                            className="icon-button" 
                            onClick={openMetricsModal} 
                            title="Ver Métricas Detalhadas"
                        >
                            <FontAwesomeIcon icon={faChartLine} />
                        </button>
                    </div>
                </div>

                {/* Device Info */}
                <div className="device-summary-stats">
                    <div className="stat-item">
                        <span className="stat-value">{lastUsedDevice?.name || 'N/A'}</span>
                        <span className="stat-label">Nome</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{lastUsedDevice?.location || 'N/A'}</span>
                        <span className="stat-label">Localização</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{formatLastAccess(lastUsedDevice?.lastAccess)}</span>
                        <span className="stat-label">Último Acesso</span>
                    </div>
                </div>

                {/* Performance Metrics */}
                <div className="performance-section">
                    <h4 className="performance-title">MÉTRICAS DE PERFORMANCE</h4>
                    {!hasValidMetrics && (
                        <div className="alert alert-info" style={{ fontSize: '0.85rem', padding: '8px 12px', marginBottom: '15px' }}>
                            ⚠️ Aguardando dados de métricas do dispositivo...
                        </div>
                    )}
                    <div className="benchmark-metrics">
                        {/* CPU Performance Bar */}
                        <div className="benchmark-item">
                            <div className="benchmark-label">
                                <FontAwesomeIcon icon={faMicrochip} />
                                <span>CPU</span>
                            </div>
                            <div className="benchmark-bar-container">
                                <div 
                                    className={`benchmark-bar ${getStatusColor('cpu', deviceMetrics.cpu_usage)}`}
                                    style={{ width: `${deviceMetrics.cpu_usage}%` }}
                                >
                                    <span className="benchmark-bar-value">{formatMetricValue(deviceMetrics.cpu_usage, '%')}</span>
                                </div>
                            </div>
                        </div>

                        {/* RAM Performance Bar */}
                        <div className="benchmark-item">
                            <div className="benchmark-label">
                                <FontAwesomeIcon icon={faMemory} />
                                <span>RAM</span>
                            </div>
                            <div className="benchmark-bar-container">
                                <div 
                                    className={`benchmark-bar ${getStatusColor('ram', deviceMetrics.ram_usage_percent)}`}
                                    style={{ width: `${deviceMetrics.ram_usage_percent}%` }}
                                >
                                    <span className="benchmark-bar-value">{formatMetricValue(deviceMetrics.ram_usage_percent, '%')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Temperature Bar */}
                        <div className="benchmark-item">
                            <div className="benchmark-label">
                                <FontAwesomeIcon icon={faThermometerHalf} />
                                <span>Temp.</span>
                            </div>
                            <div className="benchmark-bar-container">
                                <div 
                                    className={`benchmark-bar ${getStatusColor('temperature', deviceMetrics.temperature_chip_c)}`}
                                    style={{ width: `${Math.min(deviceMetrics.temperature_chip_c, 100)}%` }}
                                >
                                    <span className="benchmark-bar-value">{formatMetricValue(deviceMetrics.temperature_chip_c, '°C')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Latency Info */}
                        <div className="benchmark-item">
                            <div className="benchmark-label">
                                <FontAwesomeIcon icon={faWifi} />
                                <span>Latência</span>
                            </div>
                            <div className="latency-value-wrapper">
                                <span className={`status-badge ${getStatusColor('latency', deviceMetrics.firebase_latency_ms)}`}>
                                    {formatMetricValue(deviceMetrics.firebase_latency_ms, 'ms', 'latency')}
                                </span>
                                <small className="metric-status">
                                    {deviceMetrics.firebase_latency_ms < 200 ? 'Excelente' :
                                    deviceMetrics.firebase_latency_ms < 300 ? 'Boa' :
                                    deviceMetrics.firebase_latency_ms < 500 ? 'Aceitável' : 'Lenta'}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Métricas Detalhadas */}
            <Modal
                isOpen={isMetricsModalOpen}
                onClose={closeMetricsModal}
                title={`Métricas Detalhadas - ${lastUsedDevice?.name || 'Dispositivo'}`}
                size="xl"
                footer={
                    <>
                        <button className="btn btn-primary" onClick={closeMetricsModal}>Fechar</button>
                    </>
                }
            >
                {lastUsedDevice && (
                    <DeviceMetricsChart 
                        deviceId={lastUsedDevice.id} 
                        deviceName={lastUsedDevice.name} 
                    />
                )}
            </Modal>
        </>
    );
}

export default LastUsedDeviceMetrics; 