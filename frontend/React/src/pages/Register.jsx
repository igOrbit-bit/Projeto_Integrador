import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { registerUser } from "../services/api"
import "./Register.css"

export default function Register() {

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {

    e.preventDefault()

    if (password !== confirmPassword) {
      alert("As senhas não coincidem")
      return
    }

    setLoading(true)

    try {

      await registerUser(name, email, password, confirmPassword)

      alert("Cadastro realizado!")

      navigate("/login")

    } catch (error) {

      console.error(error)
      alert("Erro ao registrar")

    } finally {

      setLoading(false)

    }

  }

  return (
    <div className="register-container">

      <div className="register-card">

        <h2>Criar conta</h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e)=>setName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>

            {loading ? "Cadastrando..." : "Cadastrar"}

          </button>

        </form>

        {loading && <p className="loading-text">Criando conta...</p>}

        <p>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>

      </div>

    </div>
  )
}