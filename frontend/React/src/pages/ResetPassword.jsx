import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../services/api";

const pageClass = "relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#5865f2] to-[#3b4cca] p-6 font-['Noto_Sans','Segoe_UI',sans-serif] before:absolute before:-top-[250px] before:-right-[100px] before:h-[500px] before:w-[500px] before:rounded-full before:bg-white/5 after:absolute after:-bottom-[200px] after:-left-[100px] after:h-[400px] after:w-[400px] after:rounded-full after:bg-white/[0.03]";
const cardClass = "relative z-[1] w-full max-w-[480px] rounded-lg bg-[#35363f] p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:p-8";
const labelClass = "mb-2 block text-left text-xs font-bold uppercase tracking-[0.5px] text-[#b9bbbe]";
const inputClass = "w-full rounded border border-[#202225] bg-[#202225] p-2.5 text-base text-[#dcddde] outline-none placeholder:text-[#72767d] focus:border-[#5865f2]";
const eyeButtonClass = "absolute right-2.5 top-[38px] flex items-center justify-center rounded p-1 text-[#b9bbbe] transition-colors hover:text-[#dcddde]";
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

const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const showToast = useCallback((message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }, []);

  const validateToken = useCallback(async () => {
    if (!token || !email) {
      showToast("Link inválido. Solicite um novo.", "error");
      setValidating(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/password/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ token, email }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setTokenValid(true);
      } else {
        showToast(data.message || "Token inválido ou expirado.", "error");
        setTokenValid(false);
      }
    } catch (error) {
      console.error(error);
      showToast("Erro ao validar token.", "error");
      setTokenValid(false);
    } finally {
      setValidating(false);
    }
  }, [email, showToast, token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast("As senhas não coincidem", "error");
      return;
    }

    if (password.length < 8) {
      showToast("A senha deve ter no mínimo 8 caracteres", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/password/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || "Senha alterada com sucesso!", "success");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        showToast(data.message || "Erro ao resetar senha. Tente novamente.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Erro de conexão. Verifique sua internet.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className={pageClass}>
        <div className={cardClass}>
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-[#b9bbbe] sm:text-base">Validando link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className={pageClass}>
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
        <div className={cardClass}>
          <div className="mb-4 text-4xl">❌</div>
          <h2 className="mb-2 text-2xl font-semibold text-white">Link Inválido</h2>
          <p className="mb-5 text-sm text-[#b9bbbe] sm:text-base">
            Este link de recuperação é inválido ou expirou. Por favor, solicite um novo link.
          </p>
          <Link to="/forgot-password" className="inline-flex rounded bg-[#5865f2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752c4]">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <div className={cardClass}>
        <div className="mx-auto mb-[18px] flex h-[60px] w-[60px] items-center justify-center text-[#5865f2]">
          <svg width="32" height="32" viewBox="0 0 71 55" fill="none">
            <path
              d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-white">Redefinir senha</h2>
        <p className="mb-5 text-sm text-[#b9bbbe] sm:text-base">Digite sua nova senha abaixo.</p>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-5 text-left">
            <label className={labelClass} htmlFor="password">NOVA SENHA</label>
            <input className={`${inputClass} pr-11`} id="password" type={showPassword ? "text" : "password"} placeholder="Digite sua nova senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="button" className={eyeButtonClass} onClick={() => setShowPassword((v) => !v)}>
              <EyeIcon open={showPassword} />
            </button>
          </div>

          <div className="relative mb-5 text-left">
            <label className={labelClass} htmlFor="confirmPassword">CONFIRMAR SENHA</label>
            <input className={`${inputClass} pr-11`} id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Confirme sua nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            <button type="button" className={eyeButtonClass} onClick={() => setShowConfirm((v) => !v)}>
              <EyeIcon open={showConfirm} />
            </button>
          </div>

          <button className={submitClass} type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Redefinir senha"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#b9bbbe]">
          <Link className={linkClass} to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
