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
import { API_BASE_URL, getAuthHeaders } from "../services/api";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://libras-2iiad817.livekit.cloud";
const CHAT_TOPIC = "chat-message";
const TRANSCRIPTION_FALLBACK_EVENT = "transcription:received";
const CHAT_SYNC_INTERVAL_MS = 2500;

const SILENCE_THRESHOLD = 0.006;
const SILENCE_DURATION  = 850;
const MAX_DURATION      = 6000;
const MIN_BLOB_BYTES    = 1800;
const MIN_DURATION_MS   = 900;

function appendUniqueMessage(previousMessages, nextMessage) {
  if (nextMessage?.serverId && previousMessages.some((message) => message.serverId === nextMessage.serverId)) {
    return previousMessages;
  }

  return [...previousMessages, nextMessage];
}

function normalizeServerMessage(message, displayName, isHistory = false) {
  return {
    id: `srv-${message.id}`,
    serverId: message.id,
    name: message.participant_name,
    text: message.message,
    type: message.type,
    time: message.time,
    isLocal: message.participant_name === displayName,
    isHistory,
  };
}

function sameMessageContent(left, right) {
  return left.type === right.type
    && left.name === right.name
    && left.text === right.text
    && left.time === right.time;
}

function mergeServerMessages(previousMessages, serverMessages) {
  const previousByServerId = new Map(
    previousMessages
      .filter((message) => message.serverId)
      .map((message) => [message.serverId, message])
  );
  const nextServerIds = new Set(serverMessages.map((message) => message.serverId).filter(Boolean));

  const withoutReplacedMessages = previousMessages.filter((message) => {
    if (message.serverId && nextServerIds.has(message.serverId)) {
      return false;
    }

    return !serverMessages.some((serverMessage) => !message.serverId && sameMessageContent(message, serverMessage));
  });

  const syncedServerMessages = serverMessages.map((message) => {
    const previousMessage = previousByServerId.get(message.serverId);

    return previousMessage
      ? { ...message, isHistory: previousMessage.isHistory }
      : message;
  });

  return [...withoutReplacedMessages, ...syncedServerMessages];
}

/* ================= TTS ================= */
function normalizeVoiceLang(lang = "") {
  return lang.toLowerCase().replace("_", "-");
}

function getPortugueseVoices() {
  const availableVoices = window.speechSynthesis?.getVoices?.() || [];
  const brazilianVoices = availableVoices.filter(v => normalizeVoiceLang(v.lang) === "pt-br");
  const portugueseVoices = availableVoices.filter(v => normalizeVoiceLang(v.lang).startsWith("pt"));

  return brazilianVoices.length ? brazilianVoices : portugueseVoices;
}

function getVoiceLabel(voice) {
  const lang = normalizeVoiceLang(voice.lang);
  const suffix = lang === "pt-br" ? "Brasil" : voice.lang;

  return `${voice.name} - ${suffix}`;
}

function getPreferredBrazilianVoice(settings = {}) {
  const availableVoices = window.speechSynthesis?.getVoices?.() || [];

  if (settings.voiceURI) {
    const selectedVoice = availableVoices.find(v => v.voiceURI === settings.voiceURI);

    if (selectedVoice) return selectedVoice;
  }

  return getPortugueseVoices()[0] || null;
}

function speak(text, settings = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR";
  utt.rate = settings.rate ?? 1.0;
  utt.pitch = settings.pitch ?? 1.0;
  utt.volume = settings.volume ?? 1.0;
  const voice = getPreferredBrazilianVoice(settings);
  if (voice) utt.voice = voice;
  window.speechSynthesis.speak(utt);
}

/* ================= Envia áudio ================= */
function ChatSpeechListener({ ttsSettings }) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    const loadVoices = () => getPortugueseVoices();

    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  useDataChannel(CHAT_TOPIC, (msg) => {
    try {
      const decoded = JSON.parse(new TextDecoder().decode(msg.payload));

      if (decoded.identity !== localParticipant?.identity && decoded.text?.trim()) {
        speak(decoded.text, ttsSettings);
      }
    } catch (error) {
      console.error("Erro ao falar mensagem do chat", error);
    }
  });

  return null;
}

async function sendAudio(blob, mimeType, participantName, roomCode, durationMs) {
  if (!blob || blob.size < MIN_BLOB_BYTES || durationMs < MIN_DURATION_MS) return;
  const ext = mimeType.includes("ogg") ? "ogg" : "webm";
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const response = await axios.post(`${API_BASE_URL}/transcribe`,
    { audio: base64, audio_ext: ext, audio_duration_ms: durationMs, participant_name: participantName, room_code: roomCode },
    { headers: getAuthHeaders() }
  );

  return response.data;
}

/* ================= Transcrição com detecção de silêncio ================= */
function AudioTranscriber({ roomCode, userName, onSpeakingChange }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    if (!localParticipant || !isMicrophoneEnabled) {
      onSpeakingChange?.(false);
      return;
    }
    const getName = () => userName || localParticipant.name || localParticipant.identity || "Usuário";

    let active = true, mediaRecorder = null, chunks = [], silenceTimer = null;
    let maxTimer = null, audioCtx = null, analyser = null, rafId = null;
    let stream = null, isRecording = false, recordingStartedAt = 0;

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
      chunks = []; isRecording = true; recordingStartedAt = Date.now();
      onSpeakingChange?.(true);
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        isRecording = false;
        onSpeakingChange?.(false);
        if (!active) return;
        const blob = new Blob(chunks, { type: mimeType });
        const durationMs = Date.now() - recordingStartedAt;
        const response = await sendAudio(blob, mimeType, getName(), roomCode, durationMs);

        if (response?.persisted && response.message) {
          window.dispatchEvent(new CustomEvent(TRANSCRIPTION_FALLBACK_EVENT, {
            detail: response.message,
          }));
        }
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
    }).catch((error) => {
      console.error("Erro ao acessar microfone para transcricao", error);
      onSpeakingChange?.(false);
    });

    return () => {
      active = false;
      clearTimeout(silenceTimer); clearTimeout(maxTimer);
      cancelAnimationFrame(rafId);
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      stream?.getTracks().forEach(t => t.stop());
      audioCtx?.close();
      onSpeakingChange?.(false);
    };
  }, [localParticipant, isMicrophoneEnabled, roomCode, userName, onSpeakingChange]);

  return null;
}

/* ================= Modal QR Code ================= */
function QRModal({ roomCode, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white">Compartilhar Sala</h3>
        <div className="rounded-xl bg-white p-4">
          <QRCodeSVG value={roomCode} size={180} />
        </div>
        <div className="rounded-lg bg-zinc-800 px-5 py-2 font-mono text-xl font-bold tracking-[4px] text-white">
          {roomCode}
        </div>
        <button onClick={onClose} className="rounded-lg bg-orange-600 px-6 py-2 text-[13px] font-semibold text-white">
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
    const load = () => {
      const nextVoices = getPortugueseVoices();

      setVoices(nextVoices);
      setLocal((current) => {
        if (current.voiceURI || nextVoices.length === 0) {
          return current;
        }

        return { ...current, voiceURI: nextVoices[0].voiceURI };
      });
    };

    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);

    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="flex w-80 flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-7" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white">🔊 Configurações de Voz</h3>
        <div>
          <label className="mb-1.5 block text-[11px] text-zinc-400">VOZ</label>
          <select value={local.voiceURI || ""} onChange={e => setLocal(p => ({ ...p, voiceURI: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] text-white outline-none">
            <option value="">Padrão do sistema</option>
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{getVoiceLabel(v)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] text-zinc-400">VELOCIDADE — {local.rate?.toFixed(1)}x</label>
          <input className="w-full accent-orange-600" type="range" min="0.5" max="2" step="0.1" value={local.rate ?? 1} onChange={e => setLocal(p => ({ ...p, rate: parseFloat(e.target.value) }))} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] text-zinc-400">TOM — {local.pitch?.toFixed(1)}</label>
          <input className="w-full accent-orange-600" type="range" min="0.5" max="2" step="0.1" value={local.pitch ?? 1} onChange={e => setLocal(p => ({ ...p, pitch: parseFloat(e.target.value) }))} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => speak("Olá, esta é uma voz de teste!", local)} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 p-[9px] text-[13px] text-white">🔈 Testar</button>
          <button onClick={() => { onChange(local); onClose(); }} className="flex-1 rounded-lg bg-orange-600 p-[9px] text-[13px] font-semibold text-white">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ================= VLibras Avatar ================= */
const VLIBRAS_PLAYER_SCRIPT = "/vlibras-player/vlibras.js";
const VLIBRAS_TARGET_PATH = "/vlibras-player/target";
const VLIBRAS_BASE_SPEED = 1.5;
const VLIBRAS_FAST_SPEED = 2.0;

function VLibrasAvatar({ transcriptions, visible }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const timeoutRef = useRef(null);
  const itemTimeoutRef = useRef(null);
  const queueRef = useRef([]);
  const seenIdsRef = useRef(new Set());
  const playingRef = useRef(false);
  const startedRef = useRef(false);
  const minEndAtRef = useRef(0);
  const statusRef = useRef("idle");
  const [status, setStatus] = useState("idle");
  const [queueSize, setQueueSize] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);

  const applySpeed = useCallback(() => {
    if (!playerRef.current) return;
    const speed = queueRef.current.length > 0 ? VLIBRAS_FAST_SPEED : VLIBRAS_BASE_SPEED;
    try {
      playerRef.current.setSpeed(speed);
    } catch (error) {
      console.warn("[VLibras] setSpeed error:", error);
    }
  }, []);

  const finalizeCurrent = useCallback((reason = "end") => {
    if (!playingRef.current) return;

    const now = Date.now();
    if (now < minEndAtRef.current && reason === "event") {
      return;
    }

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    playingRef.current = false;
    startedRef.current = false;
    setIsPlaying(false);
    setCurrentItem(null);
  }, []);

  const playNext = useCallback(() => {
    if (!playerRef.current || statusRef.current !== "ready" || playingRef.current) return;

    const nextItem = queueRef.current.shift();
    setQueueSize(queueRef.current.length);
    applySpeed();

    if (!nextItem) {
      setCurrentItem(null);
      return;
    }

    playingRef.current = true;
    startedRef.current = false;
    setIsPlaying(true);
    setCurrentItem(nextItem);

    const minMs = 1200;
    const baseMs = 8500;
    const byTextMs = Math.min((nextItem.text || "").length * 65, 11000);
    const maxMs = baseMs + byTextMs;
    minEndAtRef.current = Date.now() + minMs;

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    itemTimeoutRef.current = setTimeout(() => {
      finalizeCurrent("timeout");
      playNext();
    }, maxMs);

    try {
      playerRef.current.translate(nextItem.text);
    } catch (error) {
      console.error("[VLibras] queue translate error:", error);
      finalizeCurrent("error");
      playNext();
    }
  }, [applySpeed, finalizeCurrent]);

  useEffect(() => {
    if (!visible || playerRef.current || !containerRef.current) return;
    setStatus("loading");
    statusRef.current = "loading";

    const buildPlayer = () => {
      try {
        if (!window.VLibras?.Player) {
          statusRef.current = "error";
          setStatus("error");
          return;
        }

        const player = new window.VLibras.Player({
          targetPath: VLIBRAS_TARGET_PATH,
          onLoad: () => {
            clearTimeout(timeoutRef.current);
            statusRef.current = "ready";
            setStatus("ready");
            applySpeed();
            playNext();
          },
        });

        player.on("error", () => {
          statusRef.current = "error";
          setStatus("error");
        });
        player.on("gloss:start", () => {
          startedRef.current = true;
        });
        player.on("gloss:end", () => {
          // Ignora término espúrio antes de realmente iniciar a glosa atual.
          if (!startedRef.current) return;
          finalizeCurrent("event");
          playNext();
        });

        player.load(containerRef.current);
        playerRef.current = player;

        timeoutRef.current = setTimeout(() => {
          if (statusRef.current === "ready") return;
          statusRef.current = "timeout";
          setStatus("timeout");
        }, 90000);
      } catch (error) {
        console.error("[VLibras] player init error:", error);
        statusRef.current = "error";
        setStatus("error");
      }
    };

    const existingScript = document.getElementById("vlibras-player-sdk");
    if (existingScript) {
      if (window.VLibras?.Player) buildPlayer();
      else existingScript.addEventListener("load", buildPlayer, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "vlibras-player-sdk";
    script.src = VLIBRAS_PLAYER_SCRIPT;
    script.onload = buildPlayer;
    script.onerror = () => setStatus("error");
    document.body.appendChild(script);

    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(itemTimeoutRef.current);
    };
  }, [applySpeed, finalizeCurrent, playNext, visible]);

  useEffect(() => {
    if (!transcriptions?.length) return;

    let added = 0;
    for (const item of transcriptions) {
      const key = item.serverId || item.id;
      if (!key || seenIdsRef.current.has(key)) continue;
      seenIdsRef.current.add(key);
      queueRef.current.push({
        id: key,
        name: item.name || "Usuário",
        text: item.text || "",
      });
      added += 1;
    }

    if (added > 0) {
      setQueueSize(queueRef.current.length);
      applySpeed();
      playNext();
    }
  }, [applySpeed, playNext, transcriptions]);

  if (!visible) return null;

  const overlay = {
    loading: { msg: "Carregando VLibras...", cls: "text-zinc-500" },
    timeout: { msg: "VLibras não carregou — recarregue", cls: "text-red-400" },
    error:   { msg: "Erro ao carregar VLibras", cls: "text-red-400" },
    ready: null,
  }[status];

  return (
    <div className="flex flex-col border-t border-zinc-800 bg-[#0b0b18]">
      <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: 180 }}>
        {overlay && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-xs ${overlay.cls}`}>
            {overlay.msg}
          </div>
        )}
        {status === "ready" && (isPlaying || queueSize > 0) && (
          <div className="absolute left-2 top-2 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] text-zinc-200">
            {isPlaying ? "Sinalizando" : "Na fila"} · fila {queueSize} · {queueSize > 0 ? `${VLIBRAS_FAST_SPEED.toFixed(2)}x` : `${VLIBRAS_BASE_SPEED.toFixed(1)}x`}
          </div>
        )}
      </div>
      {currentItem && (
        <div className="border-t border-zinc-800/60 px-3 py-1.5">
          <span className="text-[10px] font-bold text-indigo-300">🤟 {currentItem.name}</span>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-400">{currentItem.text}</p>
        </div>
      )}
    </div>
  );
}

/* ================= Chat Unificado com histórico ================= */
function UnifiedChat({ roomCode, userName, onClose, isMobile, onUnread }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showAvatar, setShowAvatar] = useState(true);
  const bottomRef = useRef(null);
  const { localParticipant } = useLocalParticipant();
  const displayName = userName || localParticipant?.name || "Você";
  const isFirstLoad = useRef(true);

  const liveTranscriptions = messages.filter((message) => message.type === "transcription" && !message.isHistory);

  const syncHistory = useCallback(async (isInitialLoad = false) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/transcriptions/${roomCode}`, { headers: getAuthHeaders() });
      const history = (res.data.messages || []).map((message) => normalizeServerMessage(message, displayName, isInitialLoad));

      setMessages((previousMessages) => (
        isInitialLoad ? history : mergeServerMessages(previousMessages, history)
      ));
    } catch (e) {
        console.error("Erro ao carregar histórico", e);
    } finally {
      if (isInitialLoad) {
        setLoadingHistory(false);
      }
    }
  }, [roomCode, displayName]);

  useEffect(() => {
    setLoadingHistory(true);
    isFirstLoad.current = true;
    syncHistory(true);

    const intervalId = window.setInterval(() => {
      syncHistory(false);
    }, CHAT_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [syncHistory]);

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
      setMessages((prev) => [...prev, {
        id: Date.now() + Math.random(), name: decoded.name, text: decoded.text, type: "chat",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        isLocal: decoded.identity === localParticipant?.identity,
      }]);
      onUnread?.();
    } catch (error) {
      console.error("Erro ao receber mensagem do chat", error);
    }
  });

  useEffect(() => {
    const channel = echo.channel(`room.${roomCode}`);
    channel.listen(".transcription.received", (e) => {
      setMessages((prev) => appendUniqueMessage(prev, {
        id: `srv-${e.id}`, serverId: e.id, name: e.participantName, text: e.transcript,
        type: "transcription",
        time: e.time || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        isLocal: false,
      }));
      onUnread?.();
    });
    return () => echo.leaveChannel(`room.${roomCode}`);
  }, [roomCode, onUnread, displayName]);

  useEffect(() => {
    const handleFallback = (event) => {
      const payload = event.detail;

      if (!payload || payload.roomCode !== roomCode) {
        return;
      }

      setMessages((prev) => appendUniqueMessage(prev, {
        id: `srv-${payload.id}`,
        serverId: payload.id,
        name: payload.participantName,
        text: payload.transcript,
        type: "transcription",
        time: payload.time,
        isLocal: payload.participantName === displayName,
      }));
    };

    window.addEventListener(TRANSCRIPTION_FALLBACK_EVENT, handleFallback);

    return () => window.removeEventListener(TRANSCRIPTION_FALLBACK_EVENT, handleFallback);
  }, [roomCode, displayName]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !send) return;
    const text = inputText.trim();
    const payload = { name: displayName, identity: localParticipant?.identity, text };
    send(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
    axios.post(`${API_BASE_URL}/chat-message`,
      { room_code: roomCode, participant_name: displayName, message: text },
      { headers: getAuthHeaders() }
    ).then((response) => {
      if (!response.data?.message) return;

      const persistedMessage = normalizeServerMessage(response.data.message, displayName);

      setMessages((prev) => mergeServerMessages(prev, [persistedMessage]));
    }).catch(console.error);
    setMessages((prev) => [...prev, {
      id: Date.now(), name: displayName, text, type: "chat",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isLocal: true,
    }]);
    setInputText("");
  }, [inputText, send, localParticipant, displayName, roomCode]);

  return (
    <div className={`flex h-full flex-col bg-[#111] ${isMobile ? "" : "border-l border-zinc-800"}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3 text-[13px] font-semibold text-white">
        <span>💬 Chat & Transcrições</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAvatar(v => !v)}
            title="Avatar Libras"
            className={`rounded-md px-2 py-0.5 text-[13px] transition-colors ${showAvatar ? "bg-indigo-700 text-white" : "bg-zinc-800 text-zinc-500"}`}
          >
            🤟
          </button>
          {isMobile && <button onClick={onClose} className="text-lg text-zinc-400">✕</button>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pt-3">
        {loadingHistory ? (
          <p className="mt-4 text-center text-xs text-zinc-600">Carregando histórico...</p>
        ) : (
          <>
            {messages.length === 0 && (
              <p className="mt-4 text-center text-xs text-zinc-600">As mensagens e transcrições aparecerão aqui...</p>
            )}
            {messages.some(m => m.isHistory) && messages.some(m => !m.isHistory) && (
              <div className="my-1 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="whitespace-nowrap text-[10px] text-zinc-600">mensagens anteriores</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            )}
            {messages.map((msg, i) => {
              const isFirstNew = !msg.isHistory && (i === 0 || messages[i - 1]?.isHistory);
              const messageClass = msg.type === "transcription"
                ? "border-indigo-800 bg-[#1c1c2e]"
                : msg.isLocal
                  ? "border-green-800 bg-[#1a2e1a]"
                  : "border-zinc-800 bg-[#1e1e1e]";
              const nameClass = msg.type === "transcription"
                ? "text-indigo-300"
                : msg.isLocal
                  ? "text-green-400"
                  : "text-orange-400";
              return (
                <div key={msg.id}>
                  {isFirstNew && messages.some(m => m.isHistory) && (
                    <div className="my-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-zinc-700" />
                      <span className="whitespace-nowrap text-[10px] text-zinc-500">agora</span>
                      <div className="h-px flex-1 bg-zinc-700" />
                    </div>
                  )}
                  <div className={`rounded-[10px] border px-3 py-2 ${messageClass} ${msg.isHistory ? "opacity-75" : "opacity-100"}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${nameClass}`}>
                        {msg.type === "transcription" ? "🎙️ " : "💬 "}{msg.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">{msg.time}</span>
                    </div>
                    <p className="text-[13px] leading-[1.4] text-zinc-200">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      <VLibrasAvatar transcriptions={liveTranscriptions} visible={showAvatar} />
      <div className="flex shrink-0 gap-2 border-t border-zinc-800 px-3 py-2.5">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] text-white outline-none"
        />
        <button onClick={handleSend} disabled={!inputText.trim()} className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-colors ${inputText.trim() ? "bg-orange-600" : "cursor-not-allowed bg-zinc-800"}`}>
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
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
        {speakingLocal && (
          <div className="absolute bottom-3 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2 rounded-full bg-indigo-500/90 px-3.5 py-1.5 text-xs text-white backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Transcrevendo...
          </div>
        )}
      </div>
      <div className="shrink-0 bg-zinc-900">
        <ControlBar controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }} />
      </div>
    </div>
  );
}

/* ================= Lista de Participantes ================= */
function ParticipantsList({ onClose, isMobile }) {
  const participants = useParticipants();
  return (
    <div className={`flex h-full flex-col bg-[#111] ${isMobile ? "" : "border-l border-zinc-800"}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3 text-[13px] font-semibold text-white">
        <span>👥 Participantes</span>
        {isMobile && <button onClick={onClose} className="text-lg text-zinc-400">✕</button>}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {participants.map((p) => (
          <div key={p.identity} className="flex items-center gap-2.5 rounded-[10px] bg-zinc-800 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white">
              {(p.name || "?").charAt(0).toUpperCase()}
            </div>
            <span className="truncate whitespace-nowrap text-[13px] text-zinc-200">
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

  // ── Apaga histórico ao sair ──────────────────────────────────────────────
  const handleDisconnected = useCallback(() => {
    axios.delete(`${API_BASE_URL}/transcriptions/${roomCode}`, { headers: getAuthHeaders() })
      .catch(console.error);
    navigate("/home");
  }, [roomCode, navigate]);

  if (!token || !roomCode) {
    return (
      <div className="p-10">
        <h2 className="text-xl font-bold">Erro</h2>
        <p>Você entrou na sala de forma inválida.</p>
        <button onClick={() => navigate("/")} className="mt-4 rounded-lg bg-black px-4 py-2 text-white">Voltar</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#09090b]">
      {showQR && <QRModal roomCode={roomCode} onClose={() => setShowQR(false)} />}
      {showTTS && <TTSModal settings={ttsSettings} onChange={setTtsSettings} onClose={() => setShowTTS(false)} />}

      {/* Header */}
      <div className="z-10 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-zinc-200">Sala: <strong>{roomCode}</strong></span>
          <button onClick={() => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-[3px] text-[11px] text-zinc-400">
            {copied ? "✓" : "Copiar"}
          </button>
          <button onClick={() => setShowQR(true)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-[3px] text-[11px] text-zinc-400">
            📷 QR
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTTS(true)}
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            🔊
          </button>
          <button onClick={() => { setShowChat(!showChat); setShowParticipants(false); setUnreadCount(0); }}
            className={`relative rounded-md px-3 py-1 text-xs text-white transition-colors ${showChat ? "bg-orange-600 font-bold" : "bg-zinc-800 font-normal"}`}>
            💬 Chat
            {unreadCount > 0 && !showChat && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
            className={`rounded-md px-3 py-1 text-xs text-white transition-colors ${showParticipants ? "bg-orange-600 font-bold" : "bg-zinc-800 font-normal"}`}>
            👥
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="relative flex flex-1 overflow-hidden">
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={token}
          connect={true}
          video={true}
          audio={true}
          onDisconnected={handleDisconnected}
          data-lk-theme="default"
          className="flex flex-1 overflow-hidden"
        >
          <RoomAudioRenderer />
          <ChatSpeechListener ttsSettings={ttsSettings} />
          <AudioTranscriber roomCode={roomCode} userName={userName} onSpeakingChange={setSpeakingLocal} />

          <div className="min-w-0 flex-1 overflow-hidden">
            <VideoLayout speakingLocal={speakingLocal} />
          </div>

          {!isMobile && showChat && (
            <div className="flex w-80 shrink-0 flex-col">
              <UnifiedChat roomCode={roomCode} userName={userName} onClose={() => setShowChat(false)} isMobile={false} onUnread={() => !showChat && setUnreadCount(c => c + 1)} />
            </div>
          )}
          {!isMobile && showParticipants && (
            <div className="w-[260px] shrink-0">
              <ParticipantsList onClose={() => setShowParticipants(false)} isMobile={false} />
            </div>
          )}

          {isMobile && (showChat || showParticipants) && (
            <>
              <div onClick={() => { setShowChat(false); setShowParticipants(false); }}
                className="absolute inset-0 z-20 bg-black/50" />
              <div className="absolute bottom-0 left-0 right-0 z-30 h-[70%] overflow-hidden rounded-t-2xl">
                {showChat && <UnifiedChat roomCode={roomCode} userName={userName} onClose={() => setShowChat(false)} isMobile={true} onUnread={() => !showChat && setUnreadCount(c => c + 1)} />}
                {showParticipants && <ParticipantsList onClose={() => setShowParticipants(false)} isMobile={true} />}
              </div>
            </>
          )}
        </LiveKitRoom>
      </div>

    </div>
  );
}
