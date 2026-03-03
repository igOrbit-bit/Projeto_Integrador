import { useState } from "react";

function Login({ mudarTela }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    alert("Login realizado!");
  }

  return (
    <>
      <h1>Login</h1>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <input
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <input
            type="password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>

        <button type="submit">Entrar</button>
      </form>

      <p className="link" onClick={() => mudarTela("cadastro")}>
        Não tem conta? Criar agora
      </p>
    </>
  );
}

export default Login;