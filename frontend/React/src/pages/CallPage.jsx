import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";

const LIVEKIT_URL = "wss://libras-2iiad817.livekit.cloud";

/* ================= Avatar ================= */
function Avatar({ name }) {
  const initial = name?.charAt(0).toUpperCase() || "?";

  return (
    <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
      {initial}
    </div>
  );
}

/* ================= Lista ================= */
function ParticipantsList() {
  const participants = useParticipants();

  return (
    <div className="flex flex-col gap-2">
      {participants.map((p) => (
        <div
          key={p.identity}
          className="
            flex items-center gap-3
            bg-zinc-800/80
            p-2 rounded-lg
            backdrop-blur
          "
        >
          <Avatar name={p.name} />

          <span
            className="
              text-sm text-white
              truncate
              w-full
            "
          >
            {p.name || "Sem nome"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ================= Página ================= */
export default function CallPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { token, roomCode } = location.state || {};

  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  if (!token || !roomCode) {
    return (
      <div className="p-10">
        <h2 className="text-xl font-bold">Erro</h2>
        <p>Você entrou na sala de forma inválida.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-4 py-2 bg-black text-white rounded"
        >
          Voltar para Home
        </button>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    navigate("/home");
  }

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm truncate max-w-[140px]">
            Sala: <strong>{roomCode}</strong>
          </span>

          <button
            onClick={handleCopy}
            className="text-xs bg-zinc-700 px-2 py-1 rounded"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className="text-xs bg-zinc-700 px-2 py-1 rounded"
        >
          Participantes
        </button>
      </div>

      {/* Sala */}
      <div className="flex-1 relative h-full">
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={token}
          connect={true}
          video={true}
          audio={true}
          onDisconnected={handleLeave}
          data-lk-theme="default"
          className="h-full"
        >
          {/* Vídeo */}
          <div className="h-full">
            <VideoConference />
          </div>

          {/* Overlay escuro */}
          {showParticipants && (
            <div
              onClick={() => setShowParticipants(false)}
              className="absolute inset-0 bg-black/50 z-10"
            />
          )}

          {/* Bottom Sheet */}
          <div
            className={`
              absolute left-0 right-0 bottom-0
              bg-zinc-900/95 text-white
              backdrop-blur-xl
              rounded-t-2xl
              p-4
              transition-all duration-300 ease-out
              max-h-[60vh]
              flex flex-col
              z-20
              ${showParticipants ? "translate-y-0" : "translate-y-full"}
            `}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">Participantes</h3>

              <button
                onClick={() => setShowParticipants(false)}
                className="text-xs text-zinc-400"
              >
                fechar
              </button>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto pr-1">
              <ParticipantsList />
            </div>
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}
