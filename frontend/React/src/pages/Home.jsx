import { useNavigate } from "react-router-dom"
import "./Home.css"

export default function Home(){

  const navigate = useNavigate()

  const voltarLogin = () =>{
    navigate("/login")
  }

  return(

    <div className="home-container">

      <div className="home-card">

        <h1>Visible Speech</h1>

      

        <input
          type="text"
          placeholder="Digite aqui..."
        />

        <button className="send-btn">
          Enviar
        </button>

        <button
          className="back-btn"
          onClick={voltarLogin}
        >
          Voltar
        </button>

      </div>

    </div>

  )
}