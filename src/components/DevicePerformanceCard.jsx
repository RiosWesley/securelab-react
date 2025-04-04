import React, { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase/firebaseConfig';
// import { formatDateTime } from '../utils/formatters'; // Not needed for this layout
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Use icons closer to the example image
import { faMicrochip, faMemory, faThermometerHalf, faTachometerAlt, faSyncAlt, faHdd } from '@fortawesome/free-solid-svg-icons'; // faTachometerAlt for latency, faSyncAlt for refresh, faHdd for generic device/firmware?
import '../styles/dashboard.css';

const DevicePerformanceCard = () => {
  const [hottestDevice, setHottestDevice] = useState(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, offline: 0, total: 0, latestFirmware: 'N/A' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Removed getStatusColor as it's not used in the new layout's badge style directly

  // Function to determine bar color based on usage percentage
  const getUsageBarColor = (usage) => {
    // Adjust thresholds based on example image colors if needed
    if (usage >= 85) return 'critical'; // Red
    if (usage >= 60) return 'warning'; // Orange/Yellow
    return 'normal'; // Blue/Green
  };

  // Function to determine temperature bar color
  const getTemperatureBarColor = (temp) => {
    if (temp >= 60) return 'critical';
    if (temp >= 45) return 'warning';
    return 'normal';
  };

  // Function to determine latency bar color based on specific thresholds
  const getLatencyBarColor = (latency) => {
    const numericLatency = parseFloat(latency);
    if (isNaN(numericLatency)) return 'normal'; // Default if value is not a number

    if (numericLatency > 130) return 'critical'; // Bad latency (Red)
    if (numericLatency >= 81) return 'warning'; // Acceptable latency (Yellow/Orange)
    return 'normal';
  };

  // Fetch data and calculate stats
  useEffect(() => {
    setLoading(true);
    setError(null);
    const devicesRef = ref(database, 'devices');

    const listener = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      let currentHottestDevice = null;
      let maxCpu = -1;
      let onlineCount = 0;
      let offlineCount = 0;
      let totalCount = 0;
      let latestFw = 'N/A'; // Simple approach: just take the last one seen
      const allDevices = [];

      if (data) {
        Object.entries(data).forEach(([id, deviceData]) => {
          allDevices.push({ id, ...deviceData }); // Collect all devices
          totalCount++;
          if (deviceData.status?.toLowerCase() === 'online') {
            onlineCount++;
          } else {
            offlineCount++;
          }
          if (deviceData.firmware_version) { // Update latest firmware if present
              latestFw = deviceData.firmware_version;
          }

          // Find device with highest CPU
          const cpuUsage = parseFloat(deviceData.cpu_usage);
          if (!isNaN(cpuUsage) && cpuUsage > maxCpu) {
            maxCpu = cpuUsage;
            currentHottestDevice = { id, ...deviceData };
          }
        });
      }

      setDeviceStats({ online: onlineCount, offline: offlineCount, total: totalCount, latestFirmware: latestFw });
      setHottestDevice(currentHottestDevice);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching device data:", error);
      setError("Falha ao carregar dados dos dispositivos.");
      setLoading(false);
    });

    return () => off(devicesRef, 'value', listener);
  }, []);

  // Helper to render the performance bars like in the image
  const renderPerfBar = (icon, label, value, unit, barColorFunc) => {
    const numericValue = parseFloat(value) || 0;
    // For Temp/Latency, we need a way to map value to a 0-100 scale for the bar width
    // This is arbitrary without knowing the max possible values. Let's assume max Temp=100, max Latency=300ms
    let percentage = 0;
    if (label === 'CPU' || label === 'RAM') {
        percentage = Math.max(0, Math.min(100, numericValue));
    } else if (label === 'Temp.') {
        percentage = Math.max(0, Math.min(100, (numericValue / 100) * 100)); // Assuming max 100C
    } else if (label === 'Latência') {
        percentage = Math.max(0, Math.min(100, (numericValue / 300) * 100)); // Assuming max 300ms
    }

    const colorClass = barColorFunc(numericValue); // Get color based on actual value
    const itemClass = `perf-item-${label.toLowerCase().replace('.', '').replace('ê', 'e')}`; // e.g., perf-item-cpu, perf-item-latency

    return (
      // Add the specific item class here
      <div className={`perf-item ${itemClass}`}>
        <div className="perf-label">
          <FontAwesomeIcon icon={icon} />
          <span>{label}</span>
        </div>
        <div className="perf-bar-container">
          <div className={`perf-bar ${colorClass}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <div className="perf-value">{value ?? 'N/A'}{unit}</div>
      </div>
    );
  };

  // Refresh handler (optional, but good practice)
  const handleRefresh = () => {
      // Re-trigger useEffect? Or implement a direct fetch function
      // For simplicity, we'll just note it's possible.
      console.log("Refresh triggered (implementation needed if required)");
  };


  return (
    <div className="card device-status-card-v2"> {/* New class for specific styling */}
        {/* Top Header */}
        <div className="card-header">
            <h3>Status dos Dispositivos</h3>
        </div>

        {/* Summary Stats */}
        <div className="device-summary-stats">
            <div className="stat-item">
                <span className="stat-value">{deviceStats.online}/{deviceStats.total}</span>
                <span className="stat-label">Online</span>
            </div>
            <div className="stat-item">
                <span className="stat-value">{deviceStats.offline}</span>
                <span className="stat-label">Offline</span>
            </div>
            <div className="stat-item">
                <span className="stat-value">{deviceStats.latestFirmware}</span>
                <span className="stat-label">Firmware</span>
            </div>
        </div>

        {/* Performance Section */}
        <div className="performance-section">
            <h4>Performance do Dispositivo mais Sobrecarregado</h4>
            {loading && <div className="loading-indicator small">Carregando...</div>}
            {error && <div className="error-message small">{error}</div>}
            {!loading && !error && hottestDevice && (
                <div className="perf-metrics">
                    {renderPerfBar(faMicrochip, 'CPU', hottestDevice.cpu_usage, '%', getUsageBarColor)}
                    {renderPerfBar(faMemory, 'RAM', hottestDevice.ram_usage, '%', getUsageBarColor)}
                    {renderPerfBar(faThermometerHalf, 'Temp.', hottestDevice.temperature, '°C', getTemperatureBarColor)}
                    {renderPerfBar(faTachometerAlt, 'Latência', hottestDevice.latency, 'ms', getLatencyBarColor)}
                </div>
            )}
             {!loading && !error && !hottestDevice && (
                <div className="no-data small">Nenhum dispositivo encontrado.</div>
            )}
        </div>

        {/* Hottest Device Highlight Box */}
        {!loading && !error && hottestDevice && (
            <div className="hotspot-highlight">
                <span className="hotspot-label">Dispositivo mais sobrecarregado:</span>
                <div className="hotspot-details">
                    <span className="hotspot-name">{hottestDevice.name || 'Desconhecido'}</span>
                    <span className="hotspot-usage">
                        CPU: {hottestDevice.cpu_usage ?? 'N/A'}% | RAM: {hottestDevice.ram_usage ?? 'N/A'}%
                    </span>
                </div>
            </div>
        )}

        {/* Footer Link - REMOVED as it should exist in the parent Dashboard component */}
        {/* <div className="card-actions center" style={{ marginTop: 'auto', paddingTop: '15px' }}>
            <a href="/devices" className="btn btn-link">Ver Dispositivos</a>
        </div> */}
    </div>
  );
};

export default DevicePerformanceCard;
