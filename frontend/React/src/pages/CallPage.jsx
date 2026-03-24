import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useDataChannel,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import echo from "../echo";

const LIVEKIT_URL = "wss://libras-2iiad817.livekit.cloud";
const CHAT_TOPIC = "chat-message";

const SILENCE_THRESHOLD = 0.006;
const SILENCE_DURATION  = 600;
const MAX_DURATION      = 4000;
const MIN_BLOB_BYTES    = 800;

const API_URL = import.meta.env.VITE_API_URL;

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken")}` };
}

/* ================= TTS ================= */
function speak(text, settings = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR";
  utt.rate = settings.rate ?? 1.0;
  utt.pitch = settings.pitch ?? 1.0;
  utt.volume = settings.volume ?? 1.0;
  if (settings.voiceURI) {
    const v = window.speechSynthesis.getVoices().find(v => v.voiceURI === settings.voiceURI);
    if (v) utt.voice = v;
  }
  window.speechSynthesis.speak(utt);
}

/* ================= Envia áudio ================= */
async function sendAudio(blob, mimeType, participantName, roomCode) {
  if (!blob || blob.size < MIN_BLOB_BYTES) return;
  const ext = mimeType.includes("ogg") ? "ogg" : "webm";
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  await axios.post(`${API_URL}/api/v1/transcribe`,
    { audio: base64, audio_ext: ext, participant_name: participantName, room_code: roomCode },
    { headers: authHeaders() }
  );
}

/* ================= Transcrição com detecção de silêncio ================= */
function AudioTranscriber({ roomCode, userName, onSpeakingChange }) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!localParticipant) return;
    const getName = () => userName || localParticipant.name || localParticipant.identity || "Usuário";

    let active = true, mediaRecorder = null, chunks = [], silenceTimer = null;
    let maxTimer = null, audioCtx = null, analyser = null, rafId = null;
    let stream = null, isRecording = false;

    const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const flush = () => {
      if (!isRecording || !mediaRecorder) return;
      clearTimeout(silenceTimer); clearTimeout(maxTimer);
      silenceTimer = null; maxTimer = null;
      if (mediaRecorder.state === "recording") mediaRecorder.stop();
    };

    const startRecording = () => {
      if (!active || !stream) return;
      chunks = []; isRecording = true;
      onSpeakingChange?.(true);
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        isRecording = false;
        onSpeakingChange?.(false);
        if (!active) return;
        const blob = new Blob(chunks, { type: mimeType });
        await sendAudio(blob, mimeType, getName(), roomCode);
      };
      mediaRecorder.start();
      maxTimer = setTimeout(() => { if (isRecording) flush(); }, MAX_DURATION);
    };

    const analyseLoop = () => {
      if (!active || !analyser) return;
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
      if (rms > SILENCE_THRESHOLD) {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        if (!isRecording) startRecording();
      } else {
        if (isRecording && !silenceTimer) silenceTimer = setTimeout(flush, SILENCE_DURATION);
      }
      rafId = requestAnimationFrame(analyseLoop);
    };

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000, channelCount: 1 },
    }).then((s) => {
      if (!active) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      rafId = requestAnimationFrame(analyseLoop);
    });

    return () => {
      active = false;
      clearTimeout(silenceTimer); clearTimeout(maxTimer);
      cancelAnimationFrame(rafId);
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      stream?.getTracks().forEach(t => t.stop());
      audioCtx?.close();
    };
  }, [localParticipant, roomCode, userName]);

  return null;
}

/* ================= Modal QR Code ================= */
function QRModal({ roomCode, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Compartilhar Sala</h3>
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <QRCodeSVG value={roomCode} size={180} />
        </div>
        <div style={{ background: "#27272a", borderRadius: 8, padding: "8px 20px", fontFamily: "monospace", fontSize: 20, color: "#fff", letterSpacing: 4, fontWeight: 700 }}>
          {roomCode}
        </div>
        <button onClick={onClose} style={{ padding: "8px 24px", background: "#ea580c", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

/* ================= Modal TTS ================= */
function TTSModal({ settings, onChange, onClose }) {
  const [voices, setVoices] = useState([]);
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("pt")));
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 16, padding: 28, width: 320, display: "flex", flexDirection: "column", gap: 20 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>🔊 Configurações de Voz</h3>
        <div>
          <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 6 }}>VOZ</label>
          <select value={local.voiceURI || ""} onChange={e => setLocal(p => ({ ...p, voiceURI: e.target.value }))}
            style={{ width: "100%", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}>
            <option value="">Padrão do sistema</option>
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 6 }}>VELOCIDADE — {local.rate?.toFixed(1)}x</label>
          <input type="range" min="0.5" max="2" step="0.1" value={local.rate ?? 1} onChange={e => setLocal(p => ({ ...p, rate: parseFloat(e.target.value) }))} style={{ width: "100%", accentColor: "#ea580c" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 6 }}>TOM — {local.pitch?.toFixed(1)}</label>
          <input type="range" min="0.5" max="2" step="0.1" value={local.pitch ?? 1} onChange={e => setLocal(p => ({ ...p, pitch: parseFloat(e.target.value) }))} style={{ width: "100%", accentColor: "#ea580c" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => speak("Olá, esta é uma voz de teste!", local)} style={{ flex: 1, padding: "9px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" }}>🔈 Testar</button>
          <button onClick={() => { onChange(local); onClose(); }} style={{ flex: 1, padding: "9px", background: "#ea580c", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ================= Chat Unificado com histórico ================= */
function UnifiedChat({ roomCode, userName, onClose, isMobile, ttsSettings, onUnread }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);
  const { localParticipant } = useLocalParticipant();
  const displayName = userName || localParticipant?.name || "Você";
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/v1/transcriptions/${roomCode}`, { headers: authHeaders() });
        const history = (res.data.messages || []).map(m => ({
          id: `hist-${m.id}`,
          name: m.participant_name,
          text: m.message,
          type: m.type,
          time: m.time,
          isLocal: m.participant_name === displayName,
          isHistory: true,
        }));
        setMessages(history);
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [roomCode]);

  useEffect(() => {
    if (!loadingHistory && isFirstLoad.current) {
      isFirstLoad.current = false;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    }
  }, [loadingHistory]);

  useEffect(() => {
    if (!isFirstLoad.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { send } = useDataChannel(CHAT_TOPIC, (msg) => {
    try {
      const decoded = JSON.parse(new TextDecoder().decode(msg.payload));
      if (decoded.identity !== localParticipant?.identity) speak(decoded.text, ttsSettings);
      setMessages((prev) => [...prev, {
        id: Date.now() + Math.random(), name: decoded.name, text: decoded.text, type: "chat",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        isLocal: decoded.identity === localParticipant?.identity,
      }]);
      onUnread?.();
    } catch (_) {}
  });

  useEffect(() => {
    const channel = echo.channel(`room.${roomCode}`);
    channel.listen(".transcription.received", (e) => {
      setMessages((prev) => [...prev, {
        id: Date.now() + Math.random(), name: e.participantName, text: e.transcript,
        type: "transcription",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        isLocal: false,
      }]);
      onUnread?.();
    });
    return () => echo.leaveChannel(`room.${roomCode}`);
  }, [roomCode]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !send) return;
    const text = inputText.trim();
    const payload = { name: displayName, identity: localParticipant?.identity, text };
    send(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
    axios.post(`${API_URL}/api/v1/chat-message`,
      { room_code: roomCode, participant_name: displayName, message: text },
      { headers: authHeaders() }
    ).catch(console.error);
    setMessages((prev) => [...prev, {
      id: Date.now(), name: displayName, text, type: "chat",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isLocal: true,
    }]);
    setInputText("");
  }, [inputText, send, localParticipant, displayName, roomCode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#111", borderLeft: isMobile ? "none" : "1px solid #27272a" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #27272a", fontSize: 13, fontWeight: 600, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>💬 Chat & Transcrições</span>
        {isMobile && <button onClick={onClose} style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: 18, cursor: "pointer" }}>✕</button>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {loadingHistory ? (
          <p style={{ fontSize: 12, color: "#52525b", textAlign: "center", marginTop: 16 }}>Carregando histórico...</p>
        ) : (
          <>
            {messages.length === 0 && (
              <p style={{ fontSize: 12, color: "#52525b", textAlign: "center", marginTop: 16 }}>As mensagens e transcrições aparecerão aqui...</p>
            )}
            {messages.some(m => m.isHistory) && messages.some(m => !m.isHistory) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#27272a" }} />
                <span style={{ fontSize: 10, color: "#52525b", whiteSpace: "nowrap" }}>mensagens anteriores</span>
                <div style={{ flex: 1, height: 1, background: "#27272a" }} />
              </div>
            )}
            {messages.map((msg, i) => {
              const isFirstNew = !msg.isHistory && (i === 0 || messages[i - 1]?.isHistory);
              return (
                <div key={msg.id}>
                  {isFirstNew && messages.some(m => m.isHistory) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "#3f3f46" }} />
                      <span style={{ fontSize: 10, color: "#71717a", whiteSpace: "nowrap" }}>agora</span>
                      <div style={{ flex: 1, height: 1, background: "#3f3f46" }} />
                    </div>
                  )}
                  <div style={{
                    background: msg.type === "transcription" ? "#1c1c2e" : msg.isLocal ? "#1a2e1a" : "#1e1e1e",
                    border: `1px solid ${msg.type === "transcription" ? "#3730a3" : msg.isLocal ? "#166534" : "#27272a"}`,
                    borderRadius: 10, padding: "8px 12px",
                    opacity: msg.isHistory ? 0.75 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: msg.type === "transcription" ? "#818cf8" : msg.isLocal ? "#4ade80" : "#fb923c" }}>
                        {msg.type === "transcription" ? "🎙️ " : "💬 "}{msg.name}
                      </span>
                      <span style={{ fontSize: 10, color: "#52525b" }}>{msg.time}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#e4e4e7", lineHeight: 1.4 }}>{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #27272a", display: "flex", gap: 8, flexShrink: 0 }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem..."
          style={{ flex: 1, background: "#27272a", border: "1px solid #3f3f46", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}
        />
        <button onClick={handleSend} disabled={!inputText.trim()} style={{
          padding: "8px 14px", border: "none", borderRadius: 8,
          background: inputText.trim() ? "#ea580c" : "#27272a",
          color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: inputText.trim() ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}>
          Enviar
        </button>
      </div>
    </div>
  );
}

/* ================= Layout de Vídeo ================= */
function VideoLayout({ speakingLocal }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <GridLayout tracks={tracks} style={{ height: "100%" }}>
          <ParticipantTile />
        </GridLayout>
        {speakingLocal && (
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(99,102,241,0.9)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", backdropFilter: "blur(8px)", zIndex: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1s infinite" }} />
            Transcrevendo...
          </div>
        )}
      </div>
      <div style={{ background: "#18181b", flexShrink: 0 }}>
        <ControlBar controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }} />
      </div>
    </div>
  );
}

/* ================= Lista de Participantes ================= */
function ParticipantsList({ onClose, isMobile }) {
  const participants = useParticipants();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#111", borderLeft: isMobile ? "none" : "1px solid #27272a" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #27272a", fontSize: 13, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span>👥 Participantes</span>
        {isMobile && <button onClick={onClose} style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: 18, cursor: "pointer" }}>✕</button>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {participants.map((p) => (
          <div key={p.identity} style={{ display: "flex", alignItems: "center", gap: 10, background: "#27272a", padding: "8px 12px", borderRadius: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
              {(p.name || "?").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name || "Sem nome"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Hook mobile ================= */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

/* ================= Página Principal ================= */
export default function CallPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, roomCode } = location.state || {};
  const userName = localStorage.getItem("userName") || "";
  const isMobile = useIsMobile();

  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showTTS, setShowTTS] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [speakingLocal, setSpeakingLocal] = useState(false);
  const [ttsSettings, setTtsSettings] = useState({ rate: 1.0, pitch: 1.0, volume: 1.0, voiceURI: "" });

  useEffect(() => { if (showChat) setUnreadCount(0); }, [showChat]);

  // ── Apaga histórico ao sair ──────────────────────────────────────────────
  const handleDisconnected = useCallback(() => {
    axios.delete(`${API_URL}/api/v1/transcriptions/${roomCode}`, { headers: authHeaders() })
      .catch(console.error);
    navigate("/home");
  }, [roomCode, navigate]);

  if (!token || !roomCode) {
    return (
      <div style={{ padding: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Erro</h2>
        <p>Você entrou na sala de forma inválida.</p>
        <button onClick={() => navigate("/")} style={{ marginTop: 16, padding: "8px 16px", background: "#000", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#09090b", overflow: "hidden" }}>
      {showQR && <QRModal roomCode={roomCode} onClose={() => setShowQR(false)} />}
      {showTTS && <TTSModal settings={ttsSettings} onChange={setTtsSettings} onClose={() => setShowTTS(false)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#18181b", borderBottom: "1px solid #27272a", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#e4e4e7" }}>Sala: <strong>{roomCode}</strong></span>
          <button onClick={() => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            style={{ fontSize: 11, background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, padding: "3px 8px", color: "#a1a1aa", cursor: "pointer" }}>
            {copied ? "✓" : "Copiar"}
          </button>
          <button onClick={() => setShowQR(true)}
            style={{ fontSize: 11, background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, padding: "3px 8px", color: "#a1a1aa", cursor: "pointer" }}>
            📷 QR
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowTTS(true)}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "#27272a", color: "#a1a1aa" }}>
            🔊
          </button>
          <button onClick={() => { setShowChat(!showChat); setShowParticipants(false); setUnreadCount(0); }}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: showChat ? "#ea580c" : "#27272a", color: "#fff", fontWeight: showChat ? 700 : 400, transition: "background 0.15s", position: "relative" }}>
            💬 Chat
            {unreadCount > 0 && !showChat && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: showParticipants ? "#ea580c" : "#27272a", color: "#fff", fontWeight: showParticipants ? 700 : 400, transition: "background 0.15s" }}>
            👥
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={token}
          connect={true}
          video={true}
          audio={true}
          onDisconnected={handleDisconnected}
          data-lk-theme="default"
          style={{ flex: 1, display: "flex", overflow: "hidden" }}
        >
          <RoomAudioRenderer />
          <AudioTranscriber roomCode={roomCode} userName={userName} onSpeakingChange={setSpeakingLocal} />

          <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
            <VideoLayout speakingLocal={speakingLocal} />
          </div>

          {!isMobile && showChat && (
            <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <UnifiedChat roomCode={roomCode} userName={userName} onClose={() => setShowChat(false)} isMobile={false} ttsSettings={ttsSettings} onUnread={() => !showChat && setUnreadCount(c => c + 1)} />
            </div>
          )}
          {!isMobile && showParticipants && (
            <div style={{ width: 260, flexShrink: 0 }}>
              <ParticipantsList onClose={() => setShowParticipants(false)} isMobile={false} />
            </div>
          )}

          {isMobile && (showChat || showParticipants) && (
            <>
              <div onClick={() => { setShowChat(false); setShowParticipants(false); }}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 20 }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%", zIndex: 30, borderRadius: "16px 16px 0 0", overflow: "hidden", animation: "slideUp 0.25s ease" }}>
                {showChat && <UnifiedChat roomCode={roomCode} userName={userName} onClose={() => setShowChat(false)} isMobile={true} ttsSettings={ttsSettings} onUnread={() => !showChat && setUnreadCount(c => c + 1)} />}
                {showParticipants && <ParticipantsList onClose={() => setShowParticipants(false)} isMobile={true} />}
              </div>
            </>
          )}
        </LiveKitRoom>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
      `}</style>
    </div>
  );
}