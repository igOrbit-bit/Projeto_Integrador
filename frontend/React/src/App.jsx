import { useState } from "react";
import Login from "./Login";
import Cadastro from "./Cadastro";
import "./App.css";

function App() {
  const [tela, setTela] = useState("login");

  return (
    <div className="container">
      {tela === "login" ? (
        <Login mudarTela={setTela} />
      ) : (
        <Cadastro mudarTela={setTela} />
      )}
    </div>
  );
}

export default App;