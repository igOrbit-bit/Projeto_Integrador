import { useNavigate } from "react-router-dom"
import "./Home.css"

const IconQR = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
    <rect x="3" y="16" width="5" height="5" rx="1"/>
    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
    <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/>
    <path d="M21 12v.01"/><path d="M12 21v-1"/>
  </svg>
)

const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>
)

const IconKeyboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
)

const IconHistory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
  </svg>
)

const actions = [
  { icon: IconQR,       title: "Criar Sala",      description: "Gere um QR Code para sua sala.",        color: "card-green"  },
  { icon: IconScan,     title: "Escanear QR",      description: "Aponte a câmera para entrar na sala.",  color: "card-blue"   },
  { icon: IconKeyboard, title: "Digitar Código",   description: "Digite o código de 6 dígitos.",         color: "card-orange" },
  { icon: IconHistory,  title: "Salas Recentes",   description: "Acesse suas últimas salas.",            color: "card-purple" },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-container">
      <div className="home-wrapper">

        <header className="home-header">
          <p className="home-greeting">Olá, bem-vindo de volta 👋</p>
          <h1 className="home-title">O que vamos fazer hoje?</h1>
        </header>

        <div className="home-grid">
          {actions.map((action, i) => (
            <button
              key={action.title}
              className={`action-card ${action.color}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="action-icon"><action.icon /></div>
              <div className="action-content">
                <h3 className="action-title">{action.title}</h3>
                <p className="action-desc">{action.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="home-footer">
          <button className="logout-btn" onClick={() => navigate("/login")}>
            Sair
          </button>
        </div>

      </div>
    </div>
  )
}