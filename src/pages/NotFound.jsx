// src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
    return (
        <div style={styles.container}>
            <h1 style={styles.header}>404</h1>
            <h2 style={styles.subHeader}>Página Não Encontrada</h2>
            <p style={styles.text}>
                A página que você está procurando não existe ou foi movida.
            </p>
            <Link to="/dashboard" style={styles.link}>
                Voltar para o Dashboard
            </Link>
            {/* Or link to login if preferred */}
            {/* <Link to="/login" style={styles.link}>
        Ir para Login
      </Link> */}
        </div>
    );
}

// Basic inline styles for demonstration
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh', // Use viewport height
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '20px',
        color: '#333' // Default text color
    },
    header: {
        fontSize: '6rem',
        fontWeight: 'bold',
        color: '#dc3545', // Danger color
        margin: '0',
    },
    subHeader: {
        fontSize: '1.5rem',
        margin: '10px 0 20px',
        color: '#6c757d', // Secondary color
    },
    text: {
        fontSize: '1rem',
        marginBottom: '30px',
        maxWidth: '400px',
    },
    link: {
        display: 'inline-block',
        padding: '10px 20px',
        backgroundColor: '#007bff', // Primary color
        color: 'white',
        textDecoration: 'none',
        borderRadius: '5px',
        transition: 'background-color 0.2s',
    },
    linkHover: { // Style applied on hover in a real CSS file
        backgroundColor: '#0056b3',
    },
};


// Add dark mode styles if needed (e.g., using inline style based on theme context, or via global CSS)
// Example:
// const { isDarkMode } = useTheme();
// styles.container.color = isDarkMode ? '#f0f2f5' : '#333';
// styles.subHeader.color = isDarkMode ? '#a7acb1' : '#6c757d';
// styles.link.backgroundColor = isDarkMode ? '#5d7bf7' : '#007bff';


export default NotFound;