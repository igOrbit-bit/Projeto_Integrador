import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../services/api";

const pageClass = "relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#5865f2] to-[#3b4cca] p-6 font-['Noto_Sans','Segoe_UI',sans-serif] before:absolute before:-top-[250px] before:-right-[100px] before:h-[500px] before:w-[500px] before:rounded-full before:bg-white/5 after:absolute after:-bottom-[200px] after:-left-[100px] after:h-[400px] after:w-[400px] after:rounded-full after:bg-white/[0.03]";
const cardClass = "relative z-[1] w-full max-w-[480px] rounded-lg bg-[#35363f] p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:p-8";
const labelClass = "mb-2 block text-left text-xs font-bold uppercase tracking-[0.5px] text-[#b9bbbe]";
const inputClass = "w-full rounded border border-[#202225] bg-[#202225] p-2.5 text-base text-[#dcddde] outline-none placeholder:text-[#72767d] focus:border-[#5865f2]";
const submitClass = "mt-2 w-full rounded bg-[#5865f2] p-3 text-base font-medium text-white transition-colors hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/password/forgot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || "Email enviado com sucesso!", "success");
        setEmailSent(true);
      } else {
        showToast(data.message || "Erro ao enviar email. Tente novamente.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Erro de conexão. Verifique sua internet.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={pageClass}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <div className={cardClass}>
        <div className="mx-auto mb-[18px] flex h-[60px] w-[60px] items-center justify-center text-[#5865f2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
            <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.026A2 2 0 0 0 2 14h6.256A4.5 4.5 0 0 1 8 12.5a4.49 4.49 0 0 1 1.606-3.446l-.367-.225L8 9.586zM16 4.697v4.974A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-1.965.45l-.338-.207z" />
            <path d="M16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m-1.993-1.679a.5.5 0 0 0-.686.172l-1.17 1.95-.547-.547a.5.5 0 0 0-.708.708l.774.773a.75.75 0 0 0 1.174-.144l1.335-2.226a.5.5 0 0 0-.172-.686" />
          </svg>
        </div>

        {!emailSent ? (
          <>
            <h2 className="mb-2 text-2xl font-semibold text-white">Esqueceu sua senha?</h2>
            <p className="mb-5 text-sm text-[#b9bbbe] sm:text-base">
              Digite seu email e enviaremos instruções para redefinir sua senha.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="relative mb-5">
                <label className={labelClass} htmlFor="email">E-MAIL</label>
                <input className={inputClass} id="email" type="email" placeholder="Digite seu email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <button className={submitClass} type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>

            <p className="mt-6 text-sm text-[#b9bbbe]">
              <Link className={linkClass} to="/login">Voltar para o login</Link>
            </p>
          </>
        ) : (
          <div>
            <div className="mb-4 text-4xl">✉️</div>
            <h2 className="mb-2 text-2xl font-semibold text-white">Email enviado!</h2>
            <p className="mb-4 text-sm text-[#b9bbbe] sm:text-base">
              Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
            </p>
            <p className="mb-5 text-sm text-[#b9bbbe]">O link expira em 1 hora por motivos de segurança.</p>
            <Link to="/login" className="inline-flex rounded bg-[#5865f2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752c4]">
              Voltar para o login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
