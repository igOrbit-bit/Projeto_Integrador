import { useState, useContext } from "react"
import { useNavigate, Link } from "react-router-dom"
import { loginUser } from "../services/api"
import { AuthContext } from "../context/AuthContext"
import "./Login.css"

export default function Login() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const { login } = useContext(AuthContext)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {

    e.preventDefault()

    try {

      const response = await loginUser(email, password)

      login(response)

      navigate("/home") // 👈 VAI PARA HOME

    } catch (error) {
      console.error(error);
      alert("Erro ao registrar");

    }

  }

  return (
    <div className="login-container">

      <div className="login-card">

        <h2>Login</h2>

        <form onSubmit={handleSubmit}>

          <input
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />

          <button type="submit">Entrar</button>

        </form>

        <p>
          Não tem cadastro? <Link to="/register">Criar conta</Link>
        </p>

      </div>

    </div>
  )
}