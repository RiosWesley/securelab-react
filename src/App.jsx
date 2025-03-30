// src/App.jsx
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/firebaseConfig';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Doors = lazy(() => import('./pages/Doors'));
const Devices = lazy(() => import('./pages/Devices'));
const Logs = lazy(() => import('./pages/Logs'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Simple loading fallback component
function Loading() {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando...</div>;
}

// Component to protect routes
function ProtectedRoute({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            // Removed console logs for brevity
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return <Loading />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

// Helper component for initial redirect logic
// MOVED OUTSIDE the App function
function AuthRedirector() {
    const [user, setUser] = useState(auth.currentUser);
    // Initialize loading based on whether currentUser is immediately available
    const [loading, setLoading] = useState(!auth.currentUser);

    useEffect(() => {
        // Only set up the listener if the initial state is unknown (loading is true)
        if (loading) {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
                setLoading(false);
            });
            // Cleanup listener on component unmount
            return () => unsubscribe();
        }
        // If loading was false initially, no need to set up a listener
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]); // Depend on the loading state

    if (loading) {
        return <Loading />;
    }

    // Redirect based on the final user state
    return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}


// Main App Component
function App() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                <Route path="/doors" element={<ProtectedRoute><Doors /></ProtectedRoute>} />
                <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
                <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                {/* Default route - uses the helper component */}
                <Route
                    path="/"
                    element={<AuthRedirector />}
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
}

export default App;