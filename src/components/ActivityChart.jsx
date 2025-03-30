import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { database } from '../firebase/firebaseConfig';
import { ref, query, orderByChild, get } from 'firebase/database';
import { showNotification } from '../utils/notifications';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isValid } from 'date-fns'; // Date manipulation

// Helper to generate distinct colors (can be improved)
const generateColor = (index, total) => {
    const hue = (index * (360 / (total + 1))) % 360;
    return `hsl(${hue}, 70%, 60%)`;
};

function ActivityChart() {
    const { isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allLogs, setAllLogs] = useState([]); // Store all fetched logs
    const [availableDoors, setAvailableDoors] = useState([]); // { id: string, name: string }[]
    const [selectedDoors, setSelectedDoors] = useState([]); // string[] (IDs)
    const [dateRange, setDateRange] = useState({
        start: format(startOfDay(subDays(new Date(), 6)), 'yyyy-MM-dd'), // Default: last 7 days
        end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    });

    // 1. Fetch all logs once on mount
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        const accessLogsRef = ref(database, 'access_logs');
        // Fetch all logs initially, filtering will happen client-side
        // Consider adding server-side filtering if dataset becomes very large
        const logQuery = query(accessLogsRef, orderByChild('timestamp'));

        get(logQuery)
            .then(snapshot => {
                if (!isMounted) return;
                const logsData = snapshot.val() || {};
                const logsArray = Object.values(logsData);
                setAllLogs(logsArray);

                // Extract unique doors
                const doorsMap = new Map();
                logsArray.forEach(log => {
                    if (log.door_id && !doorsMap.has(log.door_id)) {
                        doorsMap.set(log.door_id, log.door_name || `Porta ${log.door_id.substring(0, 4)}...`);
                    }
                });
                const uniqueDoors = Array.from(doorsMap.entries()).map(([id, name]) => ({ id, name }));
                setAvailableDoors(uniqueDoors);
                setSelectedDoors(uniqueDoors.map(d => d.id)); // Select all by default
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

        return () => { isMounted = false; };
    }, []); // Fetch only once

    // 2. Process data based on filters
    const processedData = useMemo(() => {
        if (!allLogs.length || !selectedDoors.length || !dateRange.start || !dateRange.end) {
            return [];
        }

        try {
            const startDate = startOfDay(new Date(dateRange.start + 'T00:00:00')); // Ensure correct timezone handling if needed
            const endDate = endOfDay(new Date(dateRange.end + 'T00:00:00'));

            if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
                console.warn("Invalid date range:", dateRange);
                setError("Intervalo de datas inválido.");
                return []; // Prevent processing with invalid dates
            } else {
                setError(null); // Clear previous date error if now valid
            }


            const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
            const dailyCounts = intervalDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayLabel = format(day, 'dd/MM');
                const counts = { dateLabel: dayLabel }; // Use formatted date for X-axis label

                selectedDoors.forEach(doorId => {
                    counts[doorId] = 0; // Initialize count for each selected door
                });

                return counts;
            });

            // Aggregate counts from logs
            allLogs.forEach(log => {
                if (!selectedDoors.includes(log.door_id)) return; // Skip if door not selected

                const logTimestamp = new Date(log.timestamp);
                if (logTimestamp >= startDate && logTimestamp <= endDate) {
                    const dateKey = format(logTimestamp, 'yyyy-MM-dd');
                    const dayIndex = intervalDays.findIndex(day => format(day, 'yyyy-MM-dd') === dateKey);

                    if (dayIndex !== -1 && (log.action === 'access_granted' || log.action === 'door_unlocked')) {
                        if (dailyCounts[dayIndex] && log.door_id in dailyCounts[dayIndex]) {
                             dailyCounts[dayIndex][log.door_id]++;
                        }
                    }
                }
            });

            return dailyCounts;

        } catch (err) {
            console.error("Error processing chart data:", err);
            setError("Erro ao processar dados para o gráfico.");
            return [];
        }

    }, [allLogs, selectedDoors, dateRange]);

    // 3. Handlers for filters
    const handleDateChange = useCallback((event) => {
        const { name, value } = event.target;
        setDateRange(prevRange => ({
            ...prevRange,
            [name]: value
        }));
    }, []);

    const handleDoorSelectionChange = useCallback((event) => {
        const doorId = event.target.value;
        const isChecked = event.target.checked;

        setSelectedDoors(prevSelected => {
            if (isChecked) {
                return [...prevSelected, doorId];
            } else {
                return prevSelected.filter(id => id !== doorId);
            }
        });
    }, []);

    const handleSelectAllDoors = useCallback(() => {
        setSelectedDoors(availableDoors.map(d => d.id));
    }, [availableDoors]);

    const handleDeselectAllDoors = useCallback(() => {
        setSelectedDoors([]);
    }, []);


    // 4. Theme-dependent styles
    const textColor = isDarkMode ? '#c9cdd4' : '#333';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const tooltipBackground = isDarkMode ? 'rgba(33, 39, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    const tooltipText = isDarkMode ? '#fff' : '#333';

    // 5. Render component
    return (
        <div className="chart-container card"> {/* Added card class */}
            <h3 className="chart-title">Atividade de Acesso por Porta</h3> {/* Added title */}

            {/* Filter Controls */}
            <div className="chart-filters">
                <div className="filter-group date-range-filter">
                    <label htmlFor="startDate">De:</label>
                    <input
                        type="date"
                        id="startDate"
                        name="start"
                        value={dateRange.start}
                        onChange={handleDateChange}
                        aria-label="Data de início"
                    />
                    <label htmlFor="endDate">Até:</label>
                    <input
                        type="date"
                        id="endDate"
                        name="end"
                        value={dateRange.end}
                        onChange={handleDateChange}
                        aria-label="Data de fim"
                    />
                </div>
                <div className="filter-group door-filter">
                    <label>Portas:</label>
                    <div className="door-options">
                         {availableDoors.length > 5 && ( /* Show select/deselect all for many doors */
                            <div className="door-select-all">
                                <button onClick={handleSelectAllDoors} className="btn btn-sm btn-outline">Selecionar Todas</button>
                                <button onClick={handleDeselectAllDoors} className="btn btn-sm btn-outline">Desselecionar Todas</button>
                            </div>
                         )}
                        {availableDoors.map(door => (
                            <div key={door.id} className="door-checkbox">
                                <input
                                    type="checkbox"
                                    id={`door-${door.id}`}
                                    value={door.id}
                                    checked={selectedDoors.includes(door.id)}
                                    onChange={handleDoorSelectionChange}
                                />
                                <label htmlFor={`door-${door.id}`}>{door.name}</label>
                            </div>
                        ))}
                         {availableDoors.length === 0 && !loading && <span>Nenhuma porta encontrada nos logs.</span>}
                    </div>
                </div>
            </div>

            {/* Loading and Error States */}
            {loading && <div className="loading-chart">Carregando dados do gráfico...</div>}
            {error && !loading && <div className="chart-error">{error}</div>}

            {/* Chart */}
            {!loading && !error && processedData.length === 0 && <div className="chart-no-data">Sem dados para exibir com os filtros selecionados.</div>}
            {!loading && !error && processedData.length > 0 && (
                <div className="chart-placeholder" style={{ height: '400px', width: '100%' }}> {/* Increased height */}
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={processedData}
                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }} // Adjusted margins
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="dateLabel" stroke={textColor} tick={{ fontSize: 12 }} />
                            <YAxis stroke={textColor} allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: tooltipBackground, borderColor: gridColor, borderRadius: '4px' }}
                                labelStyle={{ color: tooltipText, fontWeight: 'bold' }}
                                itemStyle={{ color: tooltipText }}
                                formatter={(value, name) => {
                                    const door = availableDoors.find(d => d.id === name);
                                    return [value, door ? door.name : name]; // Show door name in tooltip
                                }}
                                labelFormatter={(label) => `Dia: ${label}`} // Format tooltip title
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            {selectedDoors.map((doorId, index) => {
                                const door = availableDoors.find(d => d.id === doorId);
                                return (
                                    <Bar
                                        key={doorId}
                                        dataKey={doorId}
                                        stackId="a" // Stack bars
                                        name={door ? door.name : `Porta ${doorId.substring(0,4)}...`} // Use name for Legend
                                        fill={generateColor(index, selectedDoors.length)}
                                    />
                                );
                            })}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

export default ActivityChart;
