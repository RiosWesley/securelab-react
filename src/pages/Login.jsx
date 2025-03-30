// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig'; // Import auth instance
import '../styles/Login.css'; // We'll create this CSS file next

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User already logged in, redirecting to dashboard...");
                navigate('/dashboard'); // Redirect to dashboard if user is found
            }
        });
        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Firebase onAuthStateChanged will handle the redirect
            // navigate('/dashboard'); // No need to navigate here explicitly if using the effect above
        } catch (err) {
            console.error('Login Error:', err);
            setError('E-mail ou senha incorretos. Por favor, tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Por favor, informe seu e-mail para recuperar a senha.');
            return;
        }
        setError('');
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Um e-mail de recuperação de senha foi enviado para ' + email);
        } catch (err) {
            console.error('Forgot Password Error:', err);
            setError('Erro ao enviar e-mail de recuperação: ' + err.message);
        }
    };

    return (
        <div className="login-page-wrapper"> {/* Added wrapper */}
            <div className="login-container">
                <div className="login-header">
                    <div className="logo">
                        {/* Replace with FontAwesome React component later if desired */}
                        <i className="fas fa-shield-alt" style={{ fontSize: '2.5rem', color: 'var(--primary-color)', marginRight: '10px' }}></i>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary-color)'}}>SecureLab</span>
                    </div>
                    <h2>Sistema de Controle de Acesso</h2>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">E-mail</label>
                        <input
                            type="email"
                            id="email"
                            className="form-control"
                            placeholder="Seu e-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Senha</label>
                        <input
                            type="password"
                            id="password"
                            className="form-control"
                            placeholder="Sua senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? 'Entrando...' : (
                            <>
                                {/* Replace with FontAwesome React component later */}
                                <i className="fas fa-sign-in-alt" style={{marginRight: '8px'}}></i> Entrar
                            </>
                        )}
                    </button>
                </form>

                <div className="forgot-password">
                    <a href="#" onClick={handleForgotPassword}>Esqueceu sua senha?</a>
                </div>
            </div>
        </div>
    );
}

export default Login;