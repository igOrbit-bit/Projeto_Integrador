import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Home.css";

const BASE_URL = "https://libras-api-rough-rain-8952.fly.dev/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

const IconQR = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
);

const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

const IconKeyboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </svg>
);

const IconHistory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export default function Home() {
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/livekit/room`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Erro ao criar sala");

      const data = await res.json();
      await joinRoom(data.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!codeInput.trim()) return;
    setLoading(true);
    await joinRoom(codeInput.trim().toUpperCase());
    setLoading(false);
  }

  async function joinRoom(code) {
    try {
      // Pega o nome salvo no login
      const userName = localStorage.getItem("userName") || "Anônimo";

      const res = await fetch(`${BASE_URL}/livekit/token`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ code, identity: userName }), // ← passa o nome
      });

      if (!res.ok) throw new Error("Código inválido ou sala não encontrada");

      const data = await res.json();

      navigate("/call", {
        state: {
          token: data.token,
          roomCode: code,
        },
      });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="home-container">
      <div className="home-wrapper">
        <header className="home-header">
          <p className="home-greeting">Olá, bem-vindo de volta 👋</p>
          <h1 className="home-title">O que vamos fazer hoje?</h1>
        </header>

        <div className="home-grid">
          {/* Criar sala */}
          <button className="action-card card-green" onClick={handleCreate}>
            <div className="action-icon">
              <IconQR />
            </div>
            <div className="action-content">
              <h3 className="action-title">Criar Sala</h3>
              <p className="action-desc">
                {loading ? "Criando..." : "Gere uma nova sala"}
              </p>
            </div>
          </button>

          {/* Escanear (placeholder) */}
          <button className="action-card card-blue">
            <div className="action-icon">
              <IconScan />
            </div>
            <div className="action-content">
              <h3 className="action-title">Escanear QR</h3>
              <p className="action-desc">Em breve</p>
            </div>
          </button>

          {/* Digitar código */}
          <div
            className="card-orange"
            style={{ cursor: "default" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div className="action-icon">
              <IconKeyboard />
            </div>

            <div className="action-content">
              <h3 className="action-title">Digitar Código</h3>

              <input
                placeholder="Ex: ABC123"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  outline: "none",
                  width: "100%",
                }}
              />

              <button
                onClick={handleJoin}
                disabled={loading}
                style={{
                  marginTop: 8,
                  padding: "8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                {loading ? "..." : "Entrar"}
              </button>
            </div>
          </div>

          {/* Histórico (placeholder) */}
          <button className="action-card card-purple">
            <div className="action-icon">
              <IconHistory />
            </div>
            <div className="action-content">
              <h3 className="action-title">Salas Recentes</h3>
              <p className="action-desc">Em breve</p>
            </div>
          </button>
        </div>

        {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

        <div className="home-footer">
          <button className="logout-btn" onClick={() => navigate("/login")}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}