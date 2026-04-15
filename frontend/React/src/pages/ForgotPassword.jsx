import { useState } from "react";
import { Link } from "react-router-dom";
import "./ForgotPassword.css";

function Toast({ message, type, visible }) {
    return (
        <div className={`toast toast-${type} ${visible ? "toast-show" : ""}`}>
            <span className="toast-icon">{type === "success" ? "✓" : "✕"}</span>
            <span className="toast-message">{message}</span>
        </div>
    );
}

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [toast, setToast] = useState({
        visible: false,
        message: "",
        type: "success",
    });

    const showToast = (message, type = "success") => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch("https://libras-api-rough-rain-8952.fly.dev/api/v1/password/forgot", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message || "Email enviado com sucesso!", "success");
                setEmailSent(true);
            } else {
                showToast(
                    data.message || "Erro ao enviar email. Tente novamente.",
                    "error"
                );
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de conexão. Verifique sua internet.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-container">
            <Toast
                message={toast.message}
                type={toast.type}
                visible={toast.visible}
            />

            <div className="forgot-card">
                <div className="forgot-logo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-envelope-check-fill" viewBox="0 0 16 16">
                        <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.026A2 2 0 0 0 2 14h6.256A4.5 4.5 0 0 1 8 12.5a4.49 4.49 0 0 1 1.606-3.446l-.367-.225L8 9.586zM16 4.697v4.974A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-1.965.45l-.338-.207z" />
                        <path d="M16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m-1.993-1.679a.5.5 0 0 0-.686.172l-1.17 1.95-.547-.547a.5.5 0 0 0-.708.708l.774.773a.75.75 0 0 0 1.174-.144l1.335-2.226a.5.5 0 0 0-.172-.686" />
                    </svg>
                </div>

                {!emailSent ? (
                    <>
                        <h2>Esqueceu sua senha?</h2>
                        <p className="forgot-subtitle">
                            Digite seu email e enviaremos instruções para redefinir sua senha.
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="email">E-MAIL</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="Digite seu email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading}>
                                {loading ? "Enviando..." : "Enviar link de recuperação"}
                            </button>
                        </form>

                        <p className="forgot-footer-text">
                            <Link to="/login">Voltar para o login</Link>
                        </p>
                    </>
                ) : (
                    <div className="success-message">
                        <div className="success-icon">✉️</div>
                        <h2>Email enviado!</h2>
                        <p className="forgot-subtitle">
                            Enviamos um link de recuperação para <strong>{email}</strong>.
                            Verifique sua caixa de entrada e spam.
                        </p>
                        <p className="forgot-info">
                            O link expira em 1 hora por motivos de segurança.
                        </p>
                        <Link to="/login" className="back-button">
                            Voltar para o login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}