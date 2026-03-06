import { useState } from "react"  
import { useNavigate, Link } from "react-router-dom"
import { loginUser } from "../services/api"
import "./Login.css"

export default function Login() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {

    e.preventDefault()

    setLoading(true)

    try {

      const data = await loginUser(email, password)

      console.log("Login realizado:", data)

      alert("Login realizado!")

      // redireciona para HOME
      navigate("/home")

    } catch (error) {

      console.error(error)
      alert("Email ou senha inválidos")

    } finally {

      setLoading(false)

    }

  }

  return (

    <div className="login-container">

      <div className="login-card">

        <h2>Entrar</h2>

        <form onSubmit={handleSubmit}>

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

          <button type="submit" disabled={loading}>

            {loading ? "Entrando..." : "Entrar"}

          </button>

        </form>

        <p>
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>

      </div>

    </div>

  )
}