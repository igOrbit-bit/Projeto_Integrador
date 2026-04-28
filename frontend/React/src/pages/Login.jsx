import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../services/api";

const authPageClass = "relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#5865f2] to-[#3b4cca] p-6 font-['Noto_Sans','Segoe_UI',sans-serif] before:absolute before:-top-[250px] before:-right-[100px] before:h-[500px] before:w-[500px] before:rounded-full before:bg-white/5 after:absolute after:-bottom-[200px] after:-left-[100px] after:h-[400px] after:w-[400px] after:rounded-full after:bg-white/[0.03]";
const authCardClass = "relative z-[1] w-full max-w-[480px] rounded-lg bg-[#35363f] p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:p-8";
const inputGroupClass = "relative mb-5 text-left";
const labelClass = "mb-2 block text-xs font-bold uppercase tracking-[0.5px] text-[#b9bbbe]";
const inputClass = "w-full rounded border border-[#202225] bg-[#202225] p-2.5 text-base font-normal text-[#dcddde] outline-none placeholder:text-[#72767d] focus:border-[#5865f2]";
const eyeButtonClass = "absolute right-2.5 top-[38px] flex items-center justify-center rounded p-1 text-[#b9bbbe] transition-colors hover:text-[#dcddde]";
const submitClass = "mt-5 w-full rounded bg-[#5865f2] p-3 text-base font-medium text-white transition-colors hover:bg-[#4752c4] active:bg-[#3c45a5] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#5865f2]";
const linkClass = "font-normal text-[#00aff4] no-underline hover:underline hover:opacity-80";

function Toast({ message, type, visible }) {
  return (
    <div
      className={`fixed left-1/2 top-7 z-[999] flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-lg px-6 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0"
      } ${type === "success" ? "bg-[#3ba55d]" : "bg-[#ed4245]"}`}
    >
      <span className="text-base font-bold">{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
    </div>
  );
}

const EyeIcon = ({ open }) =>
  open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const navigate = useNavigate();

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      showToast("Login realizado com sucesso!", "success");

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userName", data.user.name);

      setTimeout(() => navigate("/home"), 1200);
    } catch (error) {
      console.error(error);
      showToast("Email ou senha inválidos", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={authPageClass}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <div className={authCardClass}>
        <div className="mx-auto mb-[18px] flex h-[60px] w-[60px] items-center justify-center text-[#5865f2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13 2.5a1.5 1.5 0 0 1 3 0v11a1.5 1.5 0 0 1-3 0zm-1 .724c-2.067.95-4.539 1.481-7 1.656v6.237a25 25 0 0 1 1.088.085c2.053.204 4.038.668 5.912 1.56zm-8 7.841V4.934c-.68.027-1.399.043-2.008.053A2.02 2.02 0 0 0 0 7v2c0 1.106.896 1.996 1.994 2.009l.496.008a64 64 0 0 1 1.51.048m1.39 1.081q.428.032.85.078l.253 1.69a1 1 0 0 1-.983 1.187h-.548a1 1 0 0 1-.916-.599l-1.314-2.48a66 66 0 0 1 1.692.064q.491.026.966.06" />
          </svg>
        </div>
        <h2 className="mb-2 text-center text-2xl font-semibold tracking-[-0.02em] text-white">HueTech</h2>
        <p className="mb-5 text-center text-sm font-normal text-[#b9bbbe] sm:text-base">Dois mundos, uma só conexão.</p>

        <form onSubmit={handleSubmit}>
          <div className={inputGroupClass}>
            <label className={labelClass} htmlFor="email">E-MAIL</label>
            <input
              className={inputClass}
              id="email"
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={inputGroupClass}>
            <label className={labelClass} htmlFor="password">SENHA</label>
            <input
              className={`${inputClass} pr-11`}
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className={eyeButtonClass} onClick={() => setShowPassword((v) => !v)}>
              <EyeIcon open={showPassword} />
            </button>
            <Link to="/forgot-password" className={`mt-1 block text-sm ${linkClass}`}>
              Esqueceu a senha?
            </Link>
          </div>
          <button className={submitClass} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-2 text-sm font-normal text-[#b9bbbe]">
          Precisa de uma conta? <Link className={linkClass} to="/register">Registre-se</Link>
        </p>
      </div>
    </div>
  );
}
