import { useState, useContext } from "react";
import { registerUser } from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "./Register.css";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const data = await registerUser(
        name,
        email,
        password,
        passwordConfirmation
      );

      login(data);
      navigate("/home");
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <form onSubmit={handleRegister}>
          <h2>Criar Conta</h2>

          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirmar Senha"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />

          <button type="submit">Cadastrar</button>

          <p>
            Já tem conta?{" "}
            <Link to="/">Fazer login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}