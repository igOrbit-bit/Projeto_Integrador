import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, getAuthHeaders } from "../services/api";

const cardBaseClass = "group relative flex cursor-pointer flex-col items-start gap-4 overflow-hidden rounded-3xl border-0 p-6 pt-7 text-left shadow-[0_4px_0_var(--card-shadow),0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_0_var(--card-shadow),0_16px_32px_rgba(0,0,0,0.12)] active:translate-y-px active:shadow-[0_2px_0_var(--card-shadow),0_4px_12px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:rounded-3xl after:bg-white/15 after:opacity-0 after:transition-opacity hover:after:opacity-100";
const iconClass = "flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/35 text-[var(--card-text)] transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3";
const titleClass = "text-[1.15rem] font-extrabold leading-tight text-[var(--card-text)]";
const descClass = "text-[0.82rem] font-semibold leading-normal text-[var(--card-desc)]";
const RECENT_ROOMS_KEY = "recentRooms";
const MAX_RECENT_ROOMS = 8;

function loadRecentRooms() {
  try {
    const rooms = JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]");

    return Array.isArray(rooms) ? rooms : [];
  } catch {
    return [];
  }
}

function saveRecentRoom(code) {
  const normalizedCode = code.trim().toUpperCase();
  const nextRooms = [
    { code: normalizedCode, lastJoinedAt: new Date().toISOString() },
    ...loadRecentRooms().filter((room) => room.code !== normalizedCode),
  ].slice(0, MAX_RECENT_ROOMS);

  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(nextRooms));

  return nextRooms;
}

function formatRecentDate(value) {
  if (!value) return "Agora";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const IconQR = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
);

const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

const IconKeyboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </svg>
);

const IconHistory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

function QRScannerModal({ onClose, onResult }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState("Aponte a câmera para o QR Code da sala.");
  const [cameraSupported, setCameraSupported] = useState(true);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!("BarcodeDetector" in window)) {
        setCameraSupported(false);
        setStatus("Leitor automático indisponível neste navegador.");
        return;
      }

      try {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scan = async () => {
          if (!active || !videoRef.current) return;

          try {
            if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const codes = await detector.detect(videoRef.current);
              const rawValue = codes[0]?.rawValue?.trim();

              if (rawValue) {
                onResult(rawValue);
                return;
              }
            }
          } catch {
            setStatus("Não consegui ler ainda. Aproxime ou centralize o QR Code.");
          }

          rafRef.current = requestAnimationFrame(scan);
        };

        rafRef.current = requestAnimationFrame(scan);
      } catch (error) {
        console.error(error);
        setStatus("Não foi possível acessar a câmera.");
      }
    }

    startScanner();

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  const submitManualCode = () => {
    if (!manualCode.trim()) return;
    onResult(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1e1a14]">Escanear QR</h2>
          <button className="rounded-lg px-3 py-1 text-sm font-bold text-[#8b7355] hover:bg-[#f5f0e8]" onClick={onClose}>
            Fechar
          </button>
        </div>

        {cameraSupported && (
          <div className="overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          </div>
        )}

        <p className="mt-3 text-sm font-semibold text-[#8b7355]">{status}</p>

        <div className="mt-4 rounded-xl bg-[#f5f0e8] p-3">
          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#8b7355]">
            Código da sala
          </label>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-[#e5ddd0] px-3 py-2 font-mono uppercase outline-none focus:border-[#60a5fa]"
              placeholder="ABC123"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManualCode()}
            />
            <button className="rounded-lg bg-[#60a5fa] px-4 py-2 font-black text-[#1e3a5f]" onClick={submitManualCode}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentRoomsModal({ rooms, loading, onClose, onJoin, onClear }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1e1a14]">Salas Recentes</h2>
          <button className="rounded-lg px-3 py-1 text-sm font-bold text-[#8b7355] hover:bg-[#f5f0e8]" onClick={onClose}>
            Fechar
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-xl bg-[#f5f0e8] p-4 text-sm font-semibold text-[#8b7355]">
            Nenhuma sala recente ainda. Entre em uma sala para ela aparecer aqui.
          </div>
        ) : (
          <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
            {rooms.map((room) => (
              <button
                key={room.code}
                className="flex items-center justify-between rounded-xl border border-[#e5ddd0] bg-[#f5f0e8] p-3 text-left transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
                onClick={() => onJoin(room.code)}
              >
                <div>
                  <p className="font-mono text-lg font-black tracking-[2px] text-[#3b0764]">{room.code}</p>
                  <p className="text-xs font-bold text-[#8b7355]">Último acesso: {formatRecentDate(room.lastJoinedAt)}</p>
                </div>
                <span className="rounded-lg bg-[#c084fc] px-3 py-1 text-sm font-black text-[#3b0764]">
                  Entrar
                </span>
              </button>
            ))}
          </div>
        )}

        {rooms.length > 0 && (
          <button className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-100" onClick={onClear}>
            Limpar recentes
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recentRooms, setRecentRooms] = useState(() => loadRecentRooms());
  const [recentOpen, setRecentOpen] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/livekit/room`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Erro ao criar sala");

      const data = await res.json();
      await joinRoom(data.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!codeInput.trim()) return;
    setLoading(true);
    await joinRoom(codeInput.trim().toUpperCase());
    setLoading(false);
  }

  async function handleQrResult(value) {
    const code = value.trim().split("/").pop().toUpperCase();

    if (!code) return;

    setScannerOpen(false);
    setLoading(true);
    await joinRoom(code);
    setLoading(false);
  }

  async function handleRecentJoin(code) {
    setRecentOpen(false);
    setLoading(true);
    await joinRoom(code);
    setLoading(false);
  }

  function clearRecentRooms() {
    localStorage.removeItem(RECENT_ROOMS_KEY);
    setRecentRooms([]);
  }

  async function joinRoom(code) {
    const normalizedCode = code.trim().toUpperCase();
    try {
      const userName = localStorage.getItem("userName") || "Anônimo";

      const res = await fetch(`${API_BASE_URL}/livekit/token`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ code: normalizedCode, identity: userName }),
      });

      if (!res.ok) throw new Error("Código inválido ou sala não encontrada");

      const data = await res.json();

      navigate("/call", {
        state: {
          token: data.token,
          roomCode: normalizedCode,
        },
      });

      setRecentRooms(saveRecentRoom(normalizedCode));

      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f0e8] px-6 py-12 font-['Nunito',sans-serif]">
      {scannerOpen && <QRScannerModal onClose={() => setScannerOpen(false)} onResult={handleQrResult} />}
      {recentOpen && (
        <RecentRoomsModal
          rooms={recentRooms}
          loading={loading}
          onClose={() => setRecentOpen(false)}
          onJoin={handleRecentJoin}
          onClear={clearRecentRooms}
        />
      )}

      <div className="w-full max-w-[780px]">
        <header className="mb-9">
          <p className="mb-1.5 text-base font-semibold text-[#8b7355]">Olá, bem-vindo de volta 👋</p>
          <h1 className="text-[1.6rem] font-black leading-tight tracking-[-0.02em] text-[#1e1a14] sm:text-[2.2rem]">O que vamos fazer hoje?</h1>
        </header>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          <button
            className={`${cardBaseClass} [--card-bg:#4ade80] [--card-desc:#166534] [--card-shadow:#16a34a] [--card-text:#14532d] bg-[var(--card-bg)]`}
            onClick={handleCreate}
          >
            <div className={iconClass}><IconQR /></div>
            <div className="flex flex-col gap-1.5">
              <h3 className={titleClass}>Criar Sala</h3>
              <p className={descClass}>{loading ? "Criando..." : "Gere uma nova sala"}</p>
            </div>
          </button>

          <button
            className={`${cardBaseClass} [--card-bg:#60a5fa] [--card-desc:#1e40af] [--card-shadow:#2563eb] [--card-text:#1e3a5f] bg-[var(--card-bg)]`}
            onClick={() => {
              setError(null);
              setScannerOpen(true);
            }}
          >
            <div className={iconClass}><IconScan /></div>
            <div className="flex flex-col gap-1.5">
              <h3 className={titleClass}>Escanear QR</h3>
              <p className={descClass}>Entre pela câmera</p>
            </div>
          </button>

          <div className={`${cardBaseClass} cursor-default [--card-bg:#fb923c] [--card-desc:#9a3412] [--card-shadow:#ea580c] [--card-text:#431407] bg-[var(--card-bg)]`}>
            <div className={iconClass}><IconKeyboard /></div>
            <div className="flex w-full flex-col gap-1.5">
              <h3 className={titleClass}>Digitar Código</h3>
              <input
                className="mt-2 w-full rounded-lg border-0 px-2.5 py-2 outline-none"
                placeholder="Ex: ABC123"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button
                className="mt-2 w-full rounded-lg bg-white/80 p-2 font-bold text-[#431407] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                onClick={handleJoin}
                disabled={loading}
              >
                {loading ? "..." : "Entrar"}
              </button>
            </div>
          </div>

          <button
            className={`${cardBaseClass} [--card-bg:#c084fc] [--card-desc:#6b21a8] [--card-shadow:#9333ea] [--card-text:#3b0764] bg-[var(--card-bg)]`}
            onClick={() => {
              setError(null);
              setRecentOpen(true);
            }}
          >
            <div className={iconClass}><IconHistory /></div>
            <div className="flex flex-col gap-1.5">
              <h3 className={titleClass}>Salas Recentes</h3>
              <p className={descClass}>{recentRooms.length ? `${recentRooms.length} salva(s)` : "Nenhuma ainda"}</p>
            </div>
          </button>
        </div>

        {error && <p className="mt-4 text-red-600">{error}</p>}

        <div className="mt-7 flex justify-end">
          <button
            className="rounded-xl border-2 border-[#e5ddd0] bg-white px-6 py-2.5 text-sm font-bold text-[#8b7355] transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => navigate("/login")}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
