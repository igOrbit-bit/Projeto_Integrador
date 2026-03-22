import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { registerUser } from "../services/api"
import "./Register.css"

function Toast({ message, type, visible }) {
  return (
    <div className={`toast toast-${type} ${visible ? "toast-show" : ""}`}>
      <span className="toast-icon">{type === "success" ? "✓" : "✕"}</span>
      <span className="toast-message">{message}</span>
    </div>
  )
}

const EyeIcon = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export default function Register() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" })
  const navigate = useNavigate()

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      showToast("As senhas não coincidem", "error")
      return
    }
    setLoading(true)
    try {
      await registerUser(name, email, password, confirmPassword)
      showToast("Conta criada com sucesso!", "success")
      setTimeout(() => navigate("/login"), 1200)
    } catch (error) {
      console.error(error)
      showToast("Erro ao registrar. Tente novamente.", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <div className="register-card">
        <div className="register-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" class="bi bi-person-circle" viewBox="0 0 16 16">
            <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
            <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1" />
          </svg>
        </div>
        <h2>Crie sua conta</h2>
        <p className="register-subtitle">Sua conexão sem barreiras começa na Hue</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">NOME COMPLETO</label>
            <input
              id="name"
              type="text"
              placeholder="Digite seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
          <div className="input-group">
            <label htmlFor="password">SENHA</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <div className="input-group">
            <label htmlFor="confirmPassword">CONFIRMAR SENHA</label>
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirme sua senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
              <EyeIcon open={showConfirm} />
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Criando conta..." : "Continuar"}
          </button>
        </form>

        <p className="register-footer-text">
          <Link to="/login">Já tem uma conta?</Link>
        </p>
      </div>
    </div>
  )
}