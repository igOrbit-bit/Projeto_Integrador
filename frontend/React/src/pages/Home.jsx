import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Home() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div>
      <h1>Bem-vindo, {user?.name}</h1>
      <p>Email: {user?.email}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}