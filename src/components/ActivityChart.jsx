// src/components/ActivityChart.jsx
import React, { useEffect, useRef, useState } from 'react';
// --- MODIFIED IMPORT ---
import { Chart, registerables } from 'chart.js'; // Import specific items
import { useTheme } from '../context/ThemeContext';
import { database } from '../firebase/firebaseConfig';
import { ref, query, orderByChild, startAt, get } from 'firebase/database';
import { showNotification } from '../utils/notifications';

// --- REGISTER CHART.JS COMPONENTS ---
// Do this once when the module loads
Chart.register(...registerables);

// Helper functions (keep them as they were)
function hslToHex(h, s, l) { /* ... (copy from activity-chart.js) ... */
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c/2;
    let r, g, b;
    if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
    else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
    else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
    else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
    else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function adjustColorBrightness(hexColor, percent) { /* ... (copy from activity-chart.js) ... */
    if (!hexColor || !hexColor.startsWith('#')) return hexColor; // Basic validation
    let r = parseInt(hexColor.substr(1, 2), 16);
    let g = parseInt(hexColor.substr(3, 2), 16);
    let b = parseInt(hexColor.substr(5, 2), 16);
    r = Math.min(255, Math.max(0, r + (r * percent / 100)));
    g = Math.min(255, Math.max(0, g + (g * percent / 100)));
    b = Math.min(255, Math.max(0, b + (b * percent / 100)));
    r = Math.round(r).toString(16).padStart(2, '0');
    g = Math.round(g).toString(16).padStart(2, '0');
    b = Math.round(b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function generateDoorColors(count) { /* ... (copy from activity-chart.js) ... */
    const predefinedColors = ['#4a6cf7','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c','#34495e','#d35400','#27ae60','#8e44ad'];
    if (count <= predefinedColors.length) return predefinedColors.slice(0, count);
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * (360 / count)) % 360;
        colors.push(hslToHex(hue, 65, 65));
    }
    return colors;
}
function processActivityData(accessLogs) { /* ... (copy from activity-chart.js) ... */
    const doorInfo = {}; const logsArray = Object.values(accessLogs);
    const days = []; const labels = []; const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today); date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0]; days.push(dateKey);
        const dateLabel = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`; labels.push(dateLabel);
    }
    const doorCounts = {}; const doorIds = new Set();
    logsArray.forEach(log => {
        if (log.action === 'access_granted' || log.action === 'door_unlocked') {
            const date = new Date(log.timestamp); const dateKey = date.toISOString().split('T')[0];
            if (days.includes(dateKey)) {
                if (log.door_id && log.door_name) doorInfo[log.door_id] = { name: log.door_name, id: log.door_id };
                doorIds.add(log.door_id);
                if (!doorCounts[log.door_id]) { doorCounts[log.door_id] = {}; days.forEach(day => { doorCounts[log.door_id][day] = 0; }); }
                if (doorCounts[log.door_id] && dateKey in doorCounts[log.door_id]) { // Added check
                    doorCounts[log.door_id][dateKey]++;
                }
            }
        }
    });
    // If doorInfo is empty after processing logs, we might need a fallback
    // to fetch door names from the 'doors' node, but processActivityData
    // should primarily rely on the data passed into it (the logs).
    // Fetching door names separately can be done before calling createOrUpdateChart if needed.
    return { labels, days, doorCounts, doorInfo, doorIds: Array.from(doorIds) };
}


function ActivityChart() {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const { isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch and process data, then create/update chart
    useEffect(() => {
        let isMounted = true; // Flag to prevent updates on unmounted component
        setLoading(true);
        setError(null);
        const accessLogsRef = ref(database, 'access_logs');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();

        const logQuery = query(accessLogsRef, orderByChild('timestamp'), startAt(sevenDaysAgoStr));

        get(logQuery)
            .then(snapshot => {
                if (!isMounted) return; // Don't update if unmounted
                const accessLogs = snapshot.val() || {};
                const processedData = processActivityData(accessLogs);

                if (chartRef.current) {
                    createOrUpdateChart(processedData);
                } else {
                    console.warn("Chart canvas ref not ready when data arrived.");
                    // Maybe store data and try again in another effect or timeout?
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.error("Error fetching chart data:", err);
                setError("Erro ao carregar dados do gráfico.");
                showNotification("Erro ao carregar dados do gráfico: " + err.message, 'error');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        // Cleanup function
        return () => {
            isMounted = false; // Set flag on unmount
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
                console.log("Chart instance destroyed on unmount.");
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Fetch data only once on mount

    // Function to create or update the chart (keep as is)
    const createOrUpdateChart = (data) => {
        // ... (logic from previous step, including theme options) ...
        if (!chartRef.current) return;
        const ctx = chartRef.current.getContext('2d');

        if (data.doorIds.length === 0) {
            setError("Sem dados de atividade para exibir.");
            if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; }
            return;
        } else {
            setError(null);
        }

        const doorColors = generateDoorColors(data.doorIds.length);
        const datasets = data.doorIds.map((doorId, index) => {
            const doorData = data.days.map(day => data.doorCounts[doorId]?.[day] || 0);
            const doorName = data.doorInfo[doorId]?.name || `Porta ${doorId.substring(0, 4)}...`;
            return {
                label: doorName, data: doorData,
                backgroundColor: doorColors[index % doorColors.length],
                borderColor: adjustColorBrightness(doorColors[index % doorColors.length], -20),
                borderWidth: 1,
            };
        });

        const textColor = isDarkMode ? '#c9cdd4' : '#333';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const tooltipBackgroundColor = isDarkMode ? 'rgba(33, 39, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        const tooltipTextColor = isDarkMode ? '#fff' : '#333';

        const chartConfig = { /* ... (keep the config object as before) ... */
            type: 'bar',
            data: { labels: data.labels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: false },
                    legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: {
                        callbacks: {
                            title: (context) => `Dia ${context[0].label}`,
                            label: (context) => `${context.dataset.label}: ${context.raw} acessos`
                        },
                        backgroundColor: tooltipBackgroundColor, titleColor: tooltipTextColor, bodyColor: tooltipTextColor,
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', borderWidth: 1
                    }
                },
                scales: {
                    x: { stacked: true, title: { display: true, text: 'Dia', color: textColor }, grid: { display: false }, ticks: { color: textColor } },
                    y: { stacked: true, title: { display: true, text: 'Número de acessos', color: textColor }, beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
                }
            }
        };

        if (chartInstanceRef.current) {
            // Update existing chart data and options
            chartInstanceRef.current.data.labels = data.labels;
            chartInstanceRef.current.data.datasets = datasets;
            // Update theme options directly
            chartInstanceRef.current.options.plugins.legend.labels.color = textColor;
            // ... (update all other theme-dependent options) ...
            chartInstanceRef.current.options.scales.x.title.color = textColor;
            chartInstanceRef.current.options.scales.x.ticks.color = textColor;
            chartInstanceRef.current.options.scales.y.title.color = textColor;
            chartInstanceRef.current.options.scales.y.ticks.color = textColor;
            chartInstanceRef.current.options.scales.y.grid.color = gridColor;

            chartInstanceRef.current.update();
            console.log("Chart updated.");
        } else {
            // Create new chart instance
            chartInstanceRef.current = new Chart(ctx, chartConfig);
            console.log("Chart created.");
        }
    };

    // Effect to update chart options when theme changes (keep as is)
    useEffect(() => {
        if (chartInstanceRef.current) {
            // ... (logic to update chart options based on isDarkMode) ...
            const textColor = isDarkMode ? '#c9cdd4' : '#333';
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            // ... update more options ...
            chartInstanceRef.current.options.plugins.legend.labels.color = textColor;
            // ... etc ...
            chartInstanceRef.current.options.scales.x.title.color = textColor;
            chartInstanceRef.current.options.scales.x.ticks.color = textColor;
            chartInstanceRef.current.options.scales.y.title.color = textColor;
            chartInstanceRef.current.options.scales.y.ticks.color = textColor;
            chartInstanceRef.current.options.scales.y.grid.color = gridColor;

            chartInstanceRef.current.update();
            console.log("Chart theme updated:", isDarkMode ? "Dark" : "Light");
        }
    }, [isDarkMode]);


    // Render logic (keep as is)
    return (
        <div className="chart-placeholder" style={{ position: 'relative', height: '350px', width: '100%' }}>
            {/* ... loading and error display ... */}
            {loading && <div className="loading-chart">Loading...</div>}
            {error && !loading && <div className="chart-error">{error}</div>}
            <canvas ref={chartRef} style={{ display: loading || error ? 'none' : 'block' }}></canvas>
        </div>
    );
}

export default ActivityChart;