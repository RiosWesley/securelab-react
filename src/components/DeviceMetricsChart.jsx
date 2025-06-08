import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase/firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faMicrochip, faMemory, faWifi, faThermometerHalf, 
    faSyncAlt, faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';
import '../styles/device-metrics.css';

function DeviceMetricsChart({ deviceId, deviceName }) {
    const [metrics, setMetrics] = useState({
        cpu_usage: 0,
        ram_usage_percent: 0,
        firebase_latency_ms: 0,
        temperature_chip_c: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!deviceId) return;

        setLoading(true);
        setError(null);

        const deviceRef = ref(database, `devices/${deviceId}`);
        
        const handleData = (snapshot) => {
            const deviceData = snapshot.val();
            if (deviceData) {
                setMetrics({
                    cpu_usage: deviceData.cpu_usage || 0,
                    ram_usage_percent: deviceData.ram_usage_percent || 0,
                    firebase_latency_ms: deviceData.firebase_latency_ms || 0,
                    temperature_chip_c: deviceData.temperature_chip_c || 0
                });
                setLastUpdate(new Date());
                setError(null);
            } else {
                setError('Dados do dispositivo não encontrados');
            }
            setLoading(false);
        };

        const handleError = (error) => {
            console.error('Erro ao buscar métricas do dispositivo:', error);
            setError('Erro ao carregar dados do dispositivo');
            setLoading(false);
        };

        onValue(deviceRef, handleData, handleError);

        return () => {
            off(deviceRef, 'value', handleData);
        };
    }, [deviceId]);

    useEffect(() => {
        if (chartRef.current && !loading && !error) {
            // Destroy existing chart
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            
            chartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['CPU', 'RAM', 'Latência', 'Temperatura'],
                    datasets: [{
                        data: [
                            metrics.cpu_usage,
                            metrics.ram_usage_percent,
                            Math.min(metrics.firebase_latency_ms / 10, 100), // Normalizar latência para %
                            Math.min(metrics.temperature_chip_c * 2, 100) // Normalizar temperatura para %
                        ],
                        backgroundColor: [
                            '#FF6384', // CPU - Vermelho
                            '#36A2EB', // RAM - Azul
                            '#FFCE56', // Latência - Amarelo
                            '#4BC0C0'  // Temperatura - Verde água
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label;
                                    const value = context.raw;
                                    switch(label) {
                                        case 'CPU':
                                            return `CPU: ${metrics.cpu_usage}%`;
                                        case 'RAM':
                                            return `RAM: ${metrics.ram_usage_percent}%`;
                                        case 'Latência':
                                            return `Latência: ${metrics.firebase_latency_ms}ms`;
                                        case 'Temperatura':
                                            return `Temperatura: ${metrics.temperature_chip_c}°C`;
                                        default:
                                            return `${label}: ${value}`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [metrics, loading, error]);

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
                return 'primary';
        }
    };

    if (loading) {
        return (
            <div className="device-metrics-loading">
                <div className="text-center p-4">
                    <FontAwesomeIcon icon={faSyncAlt} spin size="2x" className="mb-3" />
                    <p>Carregando métricas do dispositivo...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="device-metrics-error">
                <div className="text-center p-4">
                    <FontAwesomeIcon icon={faExclamationTriangle} size="2x" className="mb-3 text-warning" />
                    <p className="text-danger">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="device-metrics-container">
            {/* Header similar to other cards */}
            <div className="device-metrics-header">
                <div className="d-flex justify-content-between align-items-center">
                    <h4>Métricas de Performance</h4>
                    {lastUpdate && (
                        <small className="text-muted">
                            Atualizado: {lastUpdate.toLocaleTimeString()}
                        </small>
                    )}
                </div>
            </div>

            {/* Stats Cards Row - Similar to dashboard cards */}
            <div className="metrics-summary-cards mb-4">
                <div className="metric-summary-card">
                    <div className="metric-summary-header">
                        <FontAwesomeIcon icon={faMicrochip} className="metric-icon" />
                        <span className="metric-name">CPU</span>
                    </div>
                    <div className="metric-summary-value">
                        <span className={`metric-value ${getStatusColor('cpu', metrics.cpu_usage)}`}>
                            {metrics.cpu_usage}%
                        </span>
                    </div>
                </div>

                <div className="metric-summary-card">
                    <div className="metric-summary-header">
                        <FontAwesomeIcon icon={faMemory} className="metric-icon" />
                        <span className="metric-name">RAM</span>
                    </div>
                    <div className="metric-summary-value">
                        <span className={`metric-value ${getStatusColor('ram', metrics.ram_usage_percent)}`}>
                            {metrics.ram_usage_percent}%
                        </span>
                    </div>
                </div>

                <div className="metric-summary-card">
                    <div className="metric-summary-header">
                        <FontAwesomeIcon icon={faWifi} className="metric-icon" />
                        <span className="metric-name">Latência</span>
                    </div>
                    <div className="metric-summary-value">
                        <span className={`metric-value ${getStatusColor('latency', metrics.firebase_latency_ms)}`}>
                            {metrics.firebase_latency_ms}ms
                        </span>
                    </div>
                </div>

                <div className="metric-summary-card">
                    <div className="metric-summary-header">
                        <FontAwesomeIcon icon={faThermometerHalf} className="metric-icon" />
                        <span className="metric-name">Temperatura</span>
                    </div>
                    <div className="metric-summary-value">
                        <span className={`metric-value ${getStatusColor('temperature', metrics.temperature_chip_c)}`}>
                            {metrics.temperature_chip_c}°C
                        </span>
                    </div>
                </div>
            </div>

            <div className="row">
                {/* Performance Chart */}
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h3>Visão Geral</h3>
                        </div>
                        <div className="card-body">
                            <div className="chart-container" style={{ height: '250px', position: 'relative' }}>
                                <canvas ref={chartRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Metrics */}
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h3>Detalhes das Métricas</h3>
                        </div>
                        <div className="card-body">
                            <div className="benchmark-metrics">
                                {/* CPU Performance Bar */}
                                <div className="benchmark-item">
                                    <div className="benchmark-label">
                                        <FontAwesomeIcon icon={faMicrochip} />
                                        <span>CPU</span>
                                    </div>
                                    <div className="benchmark-bar-container">
                                        <div 
                                            className={`benchmark-bar ${getStatusColor('cpu', metrics.cpu_usage)}`}
                                            style={{ width: `${metrics.cpu_usage}%` }}
                                        ></div>
                                    </div>
                                    <div className="benchmark-value">{metrics.cpu_usage}%</div>
                                </div>

                                {/* RAM Performance Bar */}
                                <div className="benchmark-item">
                                    <div className="benchmark-label">
                                        <FontAwesomeIcon icon={faMemory} />
                                        <span>RAM</span>
                                    </div>
                                    <div className="benchmark-bar-container">
                                        <div 
                                            className={`benchmark-bar ${getStatusColor('ram', metrics.ram_usage_percent)}`}
                                            style={{ width: `${metrics.ram_usage_percent}%` }}
                                        ></div>
                                    </div>
                                    <div className="benchmark-value">{metrics.ram_usage_percent}%</div>
                                </div>

                                {/* Temperature Bar */}
                                <div className="benchmark-item">
                                    <div className="benchmark-label">
                                        <FontAwesomeIcon icon={faThermometerHalf} />
                                        <span>Temp.</span>
                                    </div>
                                    <div className="benchmark-bar-container">
                                        <div 
                                            className={`benchmark-bar ${getStatusColor('temperature', metrics.temperature_chip_c)}`}
                                            style={{ width: `${Math.min(metrics.temperature_chip_c, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="benchmark-value">{metrics.temperature_chip_c}°C</div>
                                </div>

                                {/* Latency Indicator */}
                                <div className="metric-info-item">
                                    <div className="metric-info-label">
                                        <FontAwesomeIcon icon={faWifi} />
                                        <span>Latência Firebase</span>
                                    </div>
                                    <div className="metric-info-value">
                                        <span className={`status-badge ${getStatusColor('latency', metrics.firebase_latency_ms)}`}>
                                            {metrics.firebase_latency_ms}ms
                                        </span>
                                        <small className="metric-status">
                                            {metrics.firebase_latency_ms < 200 ? 'Excelente' :
                                             metrics.firebase_latency_ms < 300 ? 'Boa' :
                                             metrics.firebase_latency_ms < 500 ? 'Aceitável' : 'Lenta'}
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DeviceMetricsChart; 