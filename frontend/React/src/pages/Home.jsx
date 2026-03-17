import { useNavigate } from "react-router-dom"
import "./Home.css"

const actions = [
  {
    icon: "🖥️",
    title: "Criar Sala (QR Code)",
    description: "Crie um novo espaço e gere um QR Code instantaneamente.",
    color: "#6366f1",
  },
  {
    icon: "📷",
    title: "Escanear QR",
    description: "Aponte a câmera para um QR Code e entre na sala.",
    color: "#06b6d4",
  },
  {
    icon: "⌨️",
    title: "Digitar Código",
    description: "Insira o código de 6 dígitos para acessar uma sala.",
    color: "#a855f7",
  },
  {
    icon: "🕐",
    title: "Salas Recentes",
    description: "Veja e acesse rapidamente suas últimas salas.",
    color: "#10b981",
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-container">
      <div className="home-wrapper">

        <header className="home-header">
          <p className="home-greeting">👋 Bem-vindo de volta</p>
          <h1 className="home-title">
            O que vamos <span>fazer hoje?</span>
          </h1>
        </header>

        <hr className="home-divider" />

        <div className="home-grid">
          {actions.map((action, i) => (
            <button
              key={action.title}
              className="action-card"
              style={{ "--accent": action.color, animationDelay: `${i * 0.09}s` }}
            >
              <div className="action-icon">{action.icon}</div>
              <div className="action-content">
                <h3 className="action-title">{action.title}</h3>
                <p className="action-desc">{action.description}</p>
              </div>
              <div className="action-arrow">→</div>
            </button>
          ))}
        </div>

        <div className="home-footer">
          <button className="logout-btn" onClick={() => navigate("/login")}>
            ← Sair
          </button>
        </div>

      </div>
    </div>
  )
}
