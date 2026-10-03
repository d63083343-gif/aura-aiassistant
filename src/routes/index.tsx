import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { retrieveKnowledge } from "@/lib/rag.functions";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuraLogo, AuraWordmark } from "@/components/AuraMark";
import { JarvisSplash } from "@/components/JarvisSplash";
import { JarvisLogin } from "@/components/JarvisLogin";
import { encodeWav } from "@/lib/wav";
import { supabase } from "@/integrations/supabase/client";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Search, User, LogOut, Settings as SettingsIcon, Send, X, Moon, Sun, EyeOff, Paperclip, Camera, Image as ImageIcon, FileText, AlertTriangle, Save, ChevronDown, Sparkles, Code2, Palette, AudioLines, Plus, ShieldCheck, Menu, Zap, Brain, Copy, ThumbsUp, ThumbsDown, Share2, MoreHorizontal, Volume2, Square, Pencil, TextSelect } from "lucide-react";
import { JarvisSidebar } from "@/components/JarvisSidebar";
import { JarvisProfileSheet } from "@/components/JarvisProfileSheet";
import {
  JarvisWorkspace,
  saveGeneratedImage,
  type WorkspaceView,
  type Plugins,
} from "@/components/JarvisWorkspace";
import { Switch } from "@/components/ui/switch";
import { AutomationCard } from "@/components/JarvisAutomationCard";
import { handleNativeCommand } from "@/lib/jarvisNative";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  PinLockGate,
  PinSetupDialog,
  LiveVoiceOverlay,
  LiveVisionOverlay,
  WaveformRing,
  PIN_KEY,
  PIN_ENABLED_KEY,
} from "@/components/JarvisExtras";
import { JarvisDataControls } from "@/components/JarvisDataControls";
import { JarvisStorageSheet } from "@/components/JarvisStorageSheet";
import { JarvisScreenShare } from "@/components/JarvisScreenShare";
import {
  PERSONA_LIST,
  resolvePersona,
  type PersonaId,
} from "@/lib/jarvisPersonas";
import {
  addMemory,
  createConversation,
  extractMemory,
  listMemories,
  loadProfile,
  saveDataUrlImage,
  saveMessage,
  savePersona,
  setConversationTitle,
} from "@/lib/jarvisCloud";




export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AURA — Intelligent Voice Assistant" },
      { name: "description", content: "Chat naturally with AURA, your private intelligent voice assistant." },
      { property: "og:title", content: "AURA — Intelligent Voice Assistant" },
      { property: "og:description", content: "Chat naturally with AURA, your private intelligent voice assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisPage,
});

type Msg = { role: "user" | "assistant"; content: string; ts: number; imageUrl?: string };
type State = "idle" | "listening" | "thinking" | "speaking";
type HistoryItem = { id: string; query: string; reply?: string; title?: string; ts: number; messages?: Msg[] };
const HISTORY_KEY = "jarvis.history";
const MAX_HISTORY = 100;

function JarvisPage() {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState("Tap the core to begin");
  const [error, setError] = useState<string | null>(null);
  const [handsFree, setHandsFree] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 0.95;
    const v = parseFloat(localStorage.getItem("jarvis.speed") ?? "");
    return Number.isFinite(v) ? Math.min(1.3, Math.max(0.7, v)) : 0.95;
  });
  const [voicePitch, setVoicePitch] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = parseInt(localStorage.getItem("jarvis.pitch") ?? "", 10);
    return Number.isFinite(v) ? Math.min(3, Math.max(-3, v)) : 0;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; avatarUrl?: string | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [textInput, setTextInput] = useState("");
  const [auraModel, setAuraModel] = useState("AURA Lite");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState<boolean>(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [liveVisionOpen, setLiveVisionOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const [dataControlsOpen, setDataControlsOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView | null>(null);

  // ── Voice persona ────────────────────────────────────────────────────
  const [persona, setPersonaState] = useState<PersonaId>(() => {
    if (typeof window === "undefined") return "jarvis";
    const v = localStorage.getItem("jarvis.persona");
    return (["jarvis", "friday", "veronica", "edith"].includes(v ?? "") ? v : "jarvis") as PersonaId;
  });
  const personaRef = useRef<PersonaId>(persona);
  const setPersona = useCallback((p: PersonaId) => {
    setPersonaState(p);
    personaRef.current = p;
    try { localStorage.setItem("jarvis.persona", p); } catch { /* noop */ }
    void savePersona(p);
  }, []);
  useEffect(() => { personaRef.current = persona; }, [persona]);

  // ── Persistent memory + cloud conversation ───────────────────────────
  const memoriesRef = useRef<string[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // ── RAG retrieval (user-scoped; feeds context into the existing flow) ─
  const retrieve = useServerFn(retrieveKnowledge);
  const retrieveRef = useRef(retrieve);
  useEffect(() => { retrieveRef.current = retrieve; }, [retrieve]);
  const getKnowledge = useCallback(async (query: string) => {
    try {
      const res = await retrieveRef.current({ data: { query, topK: 5 } });
      return res?.chunks ?? [];
    } catch {
      return [];
    }
  }, []);

  const rememberFrom = useCallback((text: string) => {
    const fact = extractMemory(text);
    if (!fact || memoriesRef.current.includes(fact)) return;
    memoriesRef.current = [fact, ...memoriesRef.current].slice(0, 60);
    void addMemory(fact);
  }, []);
  const persistTurn = useCallback(
    async (role: "user" | "assistant", content: string, imageUrl?: string | null) => {
      if (incognitoRef.current) return;
      try {
        if (!conversationIdRef.current) {
          conversationIdRef.current = await createConversation(content.slice(0, 60));
        }
        if (conversationIdRef.current) {
          await saveMessage(conversationIdRef.current, role, content, imageUrl ?? null);
        }
      } catch { /* best effort */ }
    },
    [],
  );

  const [voiceReplies, setVoiceReplies] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("jarvis.voiceReplies") !== "0";
  });
  const [imageGen, setImageGen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("jarvis.imageGen") !== "0";
  });
  const voiceRepliesRef = useRef(voiceReplies);
  const imageGenRef = useRef(imageGen);
  useEffect(() => {
    voiceRepliesRef.current = voiceReplies;
    try { localStorage.setItem("jarvis.voiceReplies", voiceReplies ? "1" : "0"); } catch { /* noop */ }
  }, [voiceReplies]);
  useEffect(() => {
    imageGenRef.current = imageGen;
    try { localStorage.setItem("jarvis.imageGen", imageGen ? "1" : "0"); } catch { /* noop */ }
  }, [imageGen]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let on = false;
    try {
      on = localStorage.getItem(PIN_ENABLED_KEY) === "1" && !!localStorage.getItem(PIN_KEY);
    } catch { /* noop */ }
    setPinEnabled(on);
    setPinUnlocked(!on);
    setPinChecked(true);
  }, []);

  const [mode, setMode] = useState<"general" | "developer" | "creative">(() => {
    if (typeof window === "undefined") return "general";
    const v = localStorage.getItem("jarvis.mode");
    return v === "developer" || v === "creative" ? v : "general";
  });
  const modeRef = useRef<"general" | "developer" | "creative">(mode);
  useEffect(() => {
    modeRef.current = mode;
    try { localStorage.setItem("jarvis.mode", mode); } catch { /* noop */ }
  }, [mode]);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("jarvis.theme") as "dark" | "light") || "dark";
  });
  const [incognito, setIncognito] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("jarvis.incognito") === "1";
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("light", theme === "light");
    try { localStorage.setItem("jarvis.theme", theme); } catch { /* noop */ }
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem("jarvis.incognito", incognito ? "1" : "0"); } catch { /* noop */ }
  }, [incognito]);
  const incognitoRef = useRef(incognito);
  useEffect(() => { incognitoRef.current = incognito; }, [incognito]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch { /* noop */ }
  }, []);
  const persistHistory = useCallback((next: HistoryItem[]) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }, []);
  const historyRef = useRef<HistoryItem[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);
  // One history entry per conversation thread (ChatGPT-style). A new entry is
  // only created after New Chat / Branch reset threadIdRef.
  const threadIdRef = useRef<string | null>(null);
  const addHistoryQuery = useCallback((query: string) => {
    const now = Date.now();
    const userMsg: Msg = { role: "user", content: query, ts: now };
    const current = threadIdRef.current ? historyRef.current.find((h) => h.id === threadIdRef.current) : undefined;
    if (current) {
      if (incognitoRef.current) return current.id;
      const updated: HistoryItem = { ...current, ts: now, messages: [...(current.messages ?? []), userMsg] };
      persistHistory([updated, ...historyRef.current.filter((h) => h.id !== current.id)]);
      return current.id;
    }
    const item: HistoryItem = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      query,
      ts: now,
      messages: [userMsg],
    };
    threadIdRef.current = item.id;
    if (incognitoRef.current) return item.id;
    persistHistory([item, ...historyRef.current].slice(0, MAX_HISTORY));
    return item.id;
  }, [persistHistory]);
  const generateTitle = useCallback(async (id: string, query: string, reply?: string) => {
    try {
      const res = await fetch("/api/chat-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, reply }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { title?: string };
      const title = data.title?.trim();
      if (!title) return;
      persistHistory(historyRef.current.map((h) => (h.id === id ? { ...h, title } : h)));
    } catch { /* noop */ }
  }, [persistHistory]);
  const attachReplyToHistory = useCallback((id: string, reply: string) => {
    if (incognitoRef.current) return;
    const existing = historyRef.current.find((h) => h.id === id);
    const aMsg: Msg = { role: "assistant", content: reply, ts: Date.now() };
    persistHistory(historyRef.current.map((h) => (h.id === id ? { ...h, reply: h.reply ?? reply, messages: [...(h.messages ?? []), aMsg] } : h)));
    if (existing && !existing.title) void generateTitle(id, existing.query, reply);
  }, [persistHistory, generateTitle]);
  const syncThread = useCallback((msgs: Msg[]) => {
    const id = threadIdRef.current;
    if (!id || incognitoRef.current) return;
    persistHistory(historyRef.current.map((h) => (h.id === id ? { ...h, messages: msgs } : h)));
  }, [persistHistory]);
  const disablePin = useCallback(() => {
    try {
      localStorage.removeItem(PIN_KEY);
      localStorage.removeItem(PIN_ENABLED_KEY);
    } catch { /* noop */ }
    setPinEnabled(false);
    setPinUnlocked(true);
  }, []);
  const startNewChat = useCallback(() => {
    setMessages([]);
    setPendingImage(null);
    setTextInput("");
    setError(null);
    conversationIdRef.current = null;
    threadIdRef.current = null;
    setStatus("New session — tap the core or type to begin");
    setState("idle");
  }, []);

  // Pull persona + long-term memory from the cloud once signed in.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const profile = await loadProfile();
      if (alive && profile?.persona) {
        setPersonaState(profile.persona);
        personaRef.current = profile.persona;
      }
      const mem = await listMemories();
      if (alive) memoriesRef.current = mem.map((m) => m.content);
    })();
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!mounted) return;
      const recovering =
        typeof window !== "undefined" && sessionStorage.getItem("jarvis.recovery") === "1";
      if (session?.user && !recovering) {
        const email = session.user.email ?? "operator";
        const meta = session.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string } | undefined;
        const name = meta?.full_name || meta?.name || email.split("@")[0];
        setUser({ name, email, avatarUrl: meta?.avatar_url ?? null });
      } else {
        setUser(null);
      }
      setAuthReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => applySession(session));
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const voiceSpeedRef = useRef(voiceSpeed);
  const voicePitchRef = useRef(voicePitch);
  useEffect(() => {
    voiceSpeedRef.current = voiceSpeed;
    if (typeof window !== "undefined") localStorage.setItem("jarvis.speed", String(voiceSpeed));
  }, [voiceSpeed]);
  useEffect(() => {
    voicePitchRef.current = voicePitch;
    if (typeof window !== "undefined") localStorage.setItem("jarvis.pitch", String(voicePitch));
  }, [voicePitch]);

  // Recording refs
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // VAD refs
  const speechDetectedRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const autoStopRef = useRef<(() => void) | null>(null);
  const handsFreeRef = useRef(handsFree);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  // Spoken output is reserved for Live Voice / Live Vision. Typed chat on the
  // home screen stays silent (text-only), like a normal chat app.
  const liveModeRef = useRef(false);
  useEffect(() => {
    liveModeRef.current = liveVoiceOpen || liveVisionOpen;
  }, [liveVoiceOpen, liveVisionOpen]);

  // Guards against overlapping mic sessions, the main source of the
  // "voice stops working after a while" behaviour.
  const listeningRef = useRef(false);
  const stoppingRef = useRef(false);


  // Voice-activity thresholds (tuned to ignore background noise)
  const SPEECH_THRESHOLD = 0.14;      // must exceed to count as voice
  const SPEECH_FRAMES_REQUIRED = 8;   // sustained frames of voice before "speaking"
  const MIN_SPEECH_MS = 500;          // minimum voice duration to accept
  const SILENCE_MS = 1200;
  const MAX_RECORD_MS = 15000;
  const IDLE_TIMEOUT_MS = 6000;       // give up if no speech detected at all

  const speechFramesRef = useRef(0);
  const speechStartRef = useRef<number | null>(null);

  const stopMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const startMeter = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const startedAt = performance.now();
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const lvl = Math.min(1, Math.sqrt(sum / data.length) * 3);
      setLevel(lvl);

      const now = performance.now();
      // Voice activity detection — require sustained energy to count as speech.
      if (lvl > SPEECH_THRESHOLD) {
        speechFramesRef.current += 1;
        if (speechFramesRef.current >= SPEECH_FRAMES_REQUIRED) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            speechStartRef.current = now;
          }
          silenceStartRef.current = null;
        }
      } else {
        speechFramesRef.current = Math.max(0, speechFramesRef.current - 1);
        if (speechDetectedRef.current) {
          if (silenceStartRef.current == null) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > SILENCE_MS) {
            autoStopRef.current?.();
            return;
          }
        } else if (now - startedAt > IDLE_TIMEOUT_MS) {
          // No voice detected in the initial window — abandon this session.
          autoStopRef.current?.();
          return;
        }
      }
      if (now - startedAt > MAX_RECORD_MS && speechDetectedRef.current) {
        autoStopRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startListening = useCallback(async () => {
    // A second session while one is already open leaves an orphaned mic
    // stream behind and the assistant slowly stops responding.
    if (listeningRef.current || stoppingRef.current) return;
    listeningRef.current = true;
    // Stop any barge-in monitor still holding the microphone.
    bargeInRef.current?.();
    setError(null);
    speechDetectedRef.current = false;
    silenceStartRef.current = null;
    speechFramesRef.current = 0;
    speechStartRef.current = null;
    try {

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(analyser);
      source.connect(node);
      node.connect(ctx.destination);
      setState("listening");
      setStatus("Listening… speak now");
      startMeter(analyser);
    } catch {
      listeningRef.current = false;
      setError("Microphone access denied. Enable it in your browser.");
      setState("idle");
    }
  }, []);

  const stopListeningAndSend = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    listeningRef.current = false;
    stopMeter();
    const hadSpeech = speechDetectedRef.current;
    const speechDurationMs =
      speechStartRef.current != null ? performance.now() - speechStartRef.current : 0;
    const ctx = ctxRef.current;
    const stream = streamRef.current;
    const node = nodeRef.current;
    const chunks = chunksRef.current;
    node?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    const sampleRate = ctx?.sampleRate ?? 48000;
    await ctx?.close();
    ctxRef.current = null;
    streamRef.current = null;
    nodeRef.current = null;
    analyserRef.current = null;
    stoppingRef.current = false;
    setLevel(0);


    // Reject sessions where no real voice was detected, or the voice was too short.
    if (!chunks.length || !hadSpeech || speechDurationMs < MIN_SPEECH_MS) {
      setState("idle");
      setStatus(handsFreeRef.current ? "Listening for your voice…" : "Tap the core to speak");
      if (handsFreeRef.current) setTimeout(() => void startListening(), 300);
      return;
    }
    const blob = encodeWav(chunks, sampleRate);
    if (blob.size < 2048) {
      setState("idle");
      setStatus("Didn't catch that.");
      if (handsFreeRef.current) setTimeout(() => void startListening(), 400);
      return;
    }

    setState("thinking");
    setStatus("Transcribing…");
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const sttRes = await fetch("/api/stt", { method: "POST", body: form });
      if (!sttRes.ok) throw new Error(`STT ${sttRes.status}`);
      const sttData = (await sttRes.json()) as { text?: string };
      const userText = (sttData.text ?? "").trim();
      if (!userText) {
        setState("idle");
        setStatus("Didn't catch that.");
        if (handsFreeRef.current) setTimeout(() => void startListening(), 400);
        return;
      }

      const nextMsgs: Msg[] = [...messagesRef.current, { role: "user", content: userText, ts: Date.now() }];
      setMessages(nextMsgs);
      setStatus("Thinking…");
      const historyId = addHistoryQuery(userText);
      rememberFrom(userText);
      void persistTurn("user", userText);

      // Intercept image-generation requests.
      const imgPrompt = imageGenRef.current ? extractImagePrompt(userText) : null;
      if (imgPrompt) {
        setStatus("Generating image…");
        try {
          const res = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: imgPrompt }),
          });
          if (!res.ok) throw new Error(`Image ${res.status}`);
          const data = (await res.json()) as { image?: string; error?: string };
          if (!data.image) throw new Error(data.error || "No image returned");
          saveGeneratedImage(data.image, imgPrompt);
          void saveDataUrlImage(data.image, imgPrompt);
          const reply = `Here is your image of ${imgPrompt}, sir.`;
          setMessages((m) => [
            ...m,
            { role: "assistant", content: reply, imageUrl: data.image, ts: Date.now() },
          ]);
          attachReplyToHistory(historyId, reply);
          void persistTurn("assistant", reply, data.image);
          setState("speaking");
          setStatus("Rendering…");
          await speak(reply);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Image generation failed.";
          setError(msg);
          setMessages((m) => [
            ...m,
            { role: "assistant", content: `I couldn't generate that image, sir. ${msg}`, ts: Date.now() },
          ]);
        }
        setState("idle");
        if (handsFreeRef.current) { setStatus("Listening…"); void startListening(); }
        else setStatus("Tap the core to speak");
        return;
      }

      // Intercept device / launcher commands (open sites, call contacts, etc.)
      const commandReply = (await handleNativeCommand(userText)) ?? handleCommand(userText);
      if (commandReply) {
        setMessages((m) => [...m, { role: "assistant", content: commandReply, ts: Date.now() }]);
        attachReplyToHistory(historyId, commandReply);
        void persistTurn("assistant", commandReply);
        setState("speaking");
        setStatus("Executing…");
        await speak(commandReply);
        setState("idle");
        if (handsFreeRef.current) {
          setStatus("Listening…");
          void startListening();
        } else {
          setStatus("Tap the core to speak");
        }
        return;
      }

      const knowledge = await getKnowledge(userText);

      const chatRes = await fetch("/api/jarvis-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMsgs,
          mode: modeRef.current,
          persona: personaRef.current,
          memories: memoriesRef.current,
          knowledge,
        }),
      });

      if (!chatRes.ok) {
        if (chatRes.status === 429) throw new Error("Rate limited. Try again in a moment.");
        if (chatRes.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
        throw new Error(`Chat ${chatRes.status}`);
      }
      const chatData = (await chatRes.json()) as { reply?: string };
      const reply = (chatData.reply ?? "").trim();
      if (!reply) {
        setState("idle");
        setStatus("No response. Tap to try again.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      attachReplyToHistory(historyId, reply);
      void persistTurn("assistant", reply);

      setState("speaking");
      setStatus("Responding…");
      await speak(reply);
      setState("idle");
      if (handsFreeRef.current) {
        setStatus("Listening…");
        void startListening();
      } else {
        setStatus("Tap the core to speak");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setState("idle");
      setStatus("Tap the core to speak");
    }
  }, [startListening, addHistoryQuery, attachReplyToHistory, getKnowledge]);

  useEffect(() => {
    autoStopRef.current = stopListeningAndSend;
  }, [stopListeningAndSend]);

  const stopGenerating = useCallback(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    setState("idle");
    setStatus("Tap the core to speak");
  }, []);

  const sendUserMessage = useCallback(async (raw: string, imageUrl?: string) => {
    const userText = raw.trim();
    if (!userText && !imageUrl) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: userText || "(image attached)", ts: Date.now(), imageUrl };
    const nextMsgs: Msg[] = [...messagesRef.current, userMsg];
    setMessages(nextMsgs);
    setState("thinking");
    setStatus("Thinking…");
    const historyId = addHistoryQuery(imageUrl ? `[image] ${userText}`.trim() : userText);
    rememberFrom(userText);
    void persistTurn("user", userText || "(image attached)", imageUrl ?? null);
    if (imageUrl) void saveDataUrlImage(imageUrl, userText || "chat-image");

    // If no image is attached, allow image-generation and command routing.
    if (!imageUrl) {
      const imgPrompt = imageGenRef.current ? extractImagePrompt(userText) : null;
      if (imgPrompt) {
        setStatus("Generating image…");
        try {
          const res = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: imgPrompt }),
          });
          if (!res.ok) throw new Error(`Image ${res.status}`);
          const data = (await res.json()) as { image?: string; error?: string };
          if (!data.image) throw new Error(data.error || "No image returned");
          saveGeneratedImage(data.image, imgPrompt);
          void saveDataUrlImage(data.image, imgPrompt);
          const reply = `Here is your image of ${imgPrompt}, sir.`;
          setMessages((m) => [...m, { role: "assistant", content: reply, imageUrl: data.image, ts: Date.now() }]);
          attachReplyToHistory(historyId, reply);
          void persistTurn("assistant", reply, data.image);
          setState("speaking");
          setStatus("Rendering…");
          await speak(reply);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Image generation failed.";
          setError(msg);
          setMessages((m) => [...m, { role: "assistant", content: `I couldn't generate that image, sir. ${msg}`, ts: Date.now() }]);
        }
        setState("idle");
        setStatus("Tap the core to speak");
        return;
      }

      const commandReply = (await handleNativeCommand(userText)) ?? handleCommand(userText);
      if (commandReply) {
        setMessages((m) => [...m, { role: "assistant", content: commandReply, ts: Date.now() }]);
        attachReplyToHistory(historyId, commandReply);
        void persistTurn("assistant", commandReply);
        setState("speaking");
        setStatus("Executing…");
        await speak(commandReply);
        setState("idle");
        setStatus("Tap the core to speak");
        return;
      }
    }

    try {
      // Build API payload — convert the last user message to content blocks when an image is attached.
      const apiMessages = nextMsgs.map((m, i) => {
        if (i === nextMsgs.length - 1 && imageUrl) {
          return {
            role: "user" as const,
            content: [
              { type: "text" as const, text: userText || "What is in this image?" },
              { type: "image_url" as const, image_url: { url: imageUrl } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });
      const ctrl = new AbortController();
      chatAbortRef.current = ctrl;
      const chatRes = await fetch("/api/jarvis-chat", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          mode: modeRef.current,
          persona: personaRef.current,
          memories: memoriesRef.current,
        }),
      });
      if (!chatRes.ok) {
        if (chatRes.status === 429) throw new Error("Rate limited. Try again in a moment.");
        if (chatRes.status === 402) throw new Error("AI credits exhausted.");
        throw new Error(`Chat ${chatRes.status}`);
      }
      const chatData = (await chatRes.json()) as { reply?: string };
      const reply = (chatData.reply ?? "").trim();
      if (!reply) {
        setState("idle");
        setStatus("No response. Tap to try again.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      attachReplyToHistory(historyId, reply);
      void persistTurn("assistant", reply);
      setState("speaking");
      setStatus("Responding…");
      await speak(reply);
      setState("idle");
      setStatus("Tap the core to speak");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setState("idle");
        setStatus("Tap the core to speak");
        return;
      }
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setState("idle");
      setStatus("Tap the core to speak");
    }
  }, [addHistoryQuery, attachReplyToHistory]);

  // Live Vision — send a camera frame to AURA and speak the observation.
  // Screen share — AURA reads whatever is on the shared screen.
  const analyzeScreen = useCallback(async (dataUrl: string) => {
    const res = await fetch("/api/jarvis-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: modeRef.current,
        persona: personaRef.current,
        memories: memoriesRef.current,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is a screenshot of the user's screen. Explain what is on it and help with whatever they appear to be doing. Two or three short spoken sentences.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Screen ${res.status}`);
    const data = (await res.json()) as { reply?: string };
    const reply = (data.reply ?? "").trim();
    if (reply) {
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      void persistTurn("assistant", reply);
      try { await speak(reply); } catch { /* noop */ }
    }
    return reply;
  }, [persistTurn]);

  const analyzeFrame = useCallback(async (dataUrl: string) => {

    const res = await fetch("/api/jarvis-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: modeRef.current,
        persona: personaRef.current,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are seeing a live camera feed. In one short spoken sentence, describe what is happening right now. If nothing changed, mention the most notable detail instead.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Vision ${res.status}`);
    const data = (await res.json()) as { reply?: string };
    const reply = (data.reply ?? "").trim();
    if (reply) {
      try {
        await speak(reply);
      } catch { /* noop */ }
    }
    return reply;
  }, []);




  // NOTE: We intentionally do NOT auto-start the microphone on mount.
  // Mobile browsers (iOS Safari, Android Chrome) require getUserMedia() and
  // audio playback to be initiated inside a user gesture. After login we ask
  // the user to tap the core once — from there on, hands-free chaining works
  // because the mic permission is already granted for the session.

  // Free, offline fallback voice: the browser's built-in speech synthesis.
  // Used whenever the hosted TTS is unavailable (quota/credits/rate limits).
  // ── Barge-in (talk over AURA) ────────────────────────────────────────
  // While a reply is being spoken we keep a light mic monitor running. When
  // the user starts talking, playback stops instantly and we go back to
  // listening — like interrupting a person mid-sentence.
  const bargeInRef = useRef<(() => void) | null>(null);
  const startBargeInMonitor = useCallback(async (onInterrupt: () => void) => {
    // Only Live Voice mode may be interrupted; elsewhere it caused AURA to cut
    // herself off on speaker bleed and room noise.
    if (!liveModeRef.current || !handsFreeRef.current) return () => {};
    if (listeningRef.current) return () => {};

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frames = 0;
      let raf = 0;
      let stopped = false;
      const startedAt = performance.now();
      const stop = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
        bargeInRef.current = null;
      };
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const lvl = Math.sqrt(sum / data.length) * 3;
        // Grace period + high threshold so AURA's own voice and room noise
        // never cut her off mid-sentence.
        const armed = performance.now() - startedAt > 1500;
        if (armed && lvl > 0.5) {
          frames += 1;
          if (frames >= 16) {
            stop();
            onInterrupt();
            return;
          }
        } else {
          frames = Math.max(0, frames - 1);
        }
        raf = requestAnimationFrame(tick);
      };

      tick();
      bargeInRef.current = stop;
      return stop;
    } catch {
      return () => {};
    }
  }, []);

  // Free, offline fallback voice: the browser's built-in speech synthesis.
  const speakWithBrowser = (text: string) =>
    new Promise<void>((resolve) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth) return resolve();
      try {
        synth.cancel();
        const p = resolvePersona(personaRef.current);
        const u = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        const langRe = new RegExp(p.fallback.lang, "i");
        const preferred =
          voices.find((v) => langRe.test(v.lang) && p.fallback.match.test(v.name)) ||
          voices.find((v) => p.fallback.match.test(v.name) && /^en/i.test(v.lang)) ||
          voices.find((v) => langRe.test(v.lang)) ||
          voices.find((v) => /^en/i.test(v.lang));
        if (preferred) u.voice = preferred;
        u.lang = preferred?.lang || p.fallback.lang;
        u.rate = Math.min(1.2, Math.max(0.7, voiceSpeedRef.current || 0.95));
        u.pitch = Math.min(2, Math.max(0.4, 1 + (voicePitchRef.current || 0) * 0.15));
        let done = false;
        const finish = () => { if (!done) { done = true; setLevel(0); resolve(); } };
        // Crude but effective level animation while the browser voice speaks.
        const iv = setInterval(() => setLevel(0.25 + Math.random() * 0.35), 120);
        const clear = () => { clearInterval(iv); finish(); };
        u.onend = clear;
        u.onerror = clear;
        void startBargeInMonitor(() => {
          try { synth.cancel(); } catch { /* noop */ }
          clear();
        });
        synth.speak(u);
      } catch {
        resolve();
      }
    });


  // `force` is for explicit user actions (Read aloud, voice preview).
  // Otherwise AURA only speaks inside Live Voice / Live Vision.
  const speak = async (text: string, force = false) => {
    if (!voiceRepliesRef.current) return;
    if (!force && !liveModeRef.current) return;

    // Create the Audio element BEFORE the async fetch so mobile browsers
    // still associate playback with the recent user gesture.
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";

    let res: Response;
    try {
      res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          persona: personaRef.current,
          speed: voiceSpeedRef.current,
          pitch: voicePitchRef.current,
        }),
      });
    } catch {
      await speakWithBrowser(text);
      return;
    }
    if (!res.ok) {
      // 402 (out of credits), 429 (rate limited), 403/404 (not enabled) and any
      // server error fall back to the free built-in browser voice instead of
      // surfacing an error to the user.
      console.warn(`[jarvis] hosted TTS unavailable (${res.status}); using browser voice`);
      await speakWithBrowser(text);
      return;
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      await speakWithBrowser(text);
      return;
    }
    const url = URL.createObjectURL(blob);
    audio.src = url;

    // Wire analyser for the speaking visualization. If WebAudio wiring
    // fails (e.g. Safari cross-context issues), still play the audio.
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn("[jarvis] WebAudio analyser wiring failed, playing raw audio", err);
    }

    let interrupted = false;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      audio.onended = finish;
      audio.onerror = finish;
      void startBargeInMonitor(() => {
        interrupted = true;
        try { audio.pause(); } catch { /* noop */ }
        finish();
      });
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          console.warn("[jarvis] audio.play() blocked or failed", err);
          finish();
        });
      }
    });
    bargeInRef.current?.();
    if (raf) cancelAnimationFrame(raf);
    setLevel(0);
    URL.revokeObjectURL(url);
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* noop */
      }
    }
    if (interrupted) setStatus("Go ahead, I'm listening…");
  };

  const busy = state === "thinking" || state === "speaking";
  const onTap = () => {
    if (busy) return;
    if (state === "idle") startListening();
    else if (state === "listening") stopListeningAndSend();
  };

  if (!splashDone) return <JarvisSplash onDone={() => setSplashDone(true)} />;
  if (!pinChecked) return null;
  if (pinEnabled && !pinUnlocked) return <PinLockGate onUnlock={() => setPinUnlocked(true)} />;
  if (!authReady) return null;
  if (!user) return <JarvisLogin />;

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-foreground">
      {/* HUD grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.5 0.12 210 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.15) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 right-0 h-24 animate-jarvis-scan"
          style={{
            background:
              "linear-gradient(to bottom, transparent, oklch(0.62 0.22 292 / 0.14), transparent)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-4 pt-6 sm:px-8">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--jarvis-cyan)]/40 bg-card/50 text-[color:var(--jarvis-cyan)] backdrop-blur transition hover:bg-[color:var(--jarvis-cyan)]/15"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <div className="flex items-center gap-2">
            <AuraLogo size={26} />
            <AuraWordmark size="text-base" />
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <ModeSwitcher mode={mode} setMode={setMode} />
            <span className="h-1.5 w-1.5 animate-jarvis-pulse rounded-full bg-[color:var(--jarvis-cyan)] shadow-[0_0_10px_var(--jarvis-cyan)]" />
          </div>
        </div>

        {/* Live Vision */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLiveVisionOpen(true)}
            aria-label="Open live vision"
            title="Live Vision"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-card/50 text-[color:var(--jarvis-cyan)] backdrop-blur transition hover:bg-[color:var(--jarvis-cyan)]/15 active:scale-95"
          >
            <Camera className="h-[18px] w-[18px]" />
          </button>
        </div>

      </header>

      <JarvisSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        history={history}
        query={historyQuery}
        setQuery={setHistoryQuery}
        onDelete={(id) => persistHistory(history.filter((h) => h.id !== id))}
        onClear={() => persistHistory([])}
        onSelect={(item) => {
          setSidebarOpen(false);
          const full = (item as HistoryItem).messages;
          const restored: Msg[] = full && full.length ? full : [
            { role: "user", content: item.query, ts: item.ts },
            ...(item.reply ? [{ role: "assistant" as const, content: item.reply, ts: item.ts + 1 }] : []),
          ];
          threadIdRef.current = item.id;
          conversationIdRef.current = null;
          messagesRef.current = restored;
          setMessages(restored);
          setStatus(item.title?.trim() || "Chat restored");
          setState("idle");
        }}
        onNewChat={startNewChat}
        user={user}
        avatarUrl={user.avatarUrl}
        onOpenProfileSheet={() => setProfileSheetOpen(true)}
        onOpenWorkspace={(v) => setWorkspaceView(v)}
      />

      <JarvisProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        user={user}
        avatarUrl={user.avatarUrl}
        onNewChat={startNewChat}
        onOpenHistory={() => setSidebarOpen(true)}
        onOpenProfile={() => setShowAccount(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenVoiceMode={() => setLiveVoiceOpen(true)}
        onOpenLiveVision={() => setLiveVisionOpen(true)}
        onOpenScreenShare={() => setScreenShareOpen(true)}
        onOpenStorage={() => setStorageOpen(true)}
        onOpenDataControls={() => setDataControlsOpen(true)}
        pinEnabled={pinEnabled}
        onTogglePin={() => (pinEnabled ? disablePin() : setPinSetupOpen(true))}
        onSignOut={() => { void supabase.auth.signOut(); }}
      />

      <JarvisStorageSheet open={storageOpen} onOpenChange={setStorageOpen} />

      <JarvisDataControls
        open={dataControlsOpen}
        onOpenChange={setDataControlsOpen}
        incognito={incognito}
        setIncognito={setIncognito}
      />

      <JarvisScreenShare
        open={screenShareOpen}
        onClose={() => setScreenShareOpen(false)}
        onFrame={analyzeScreen}
      />


      <JarvisWorkspace
        view={workspaceView}
        onClose={() => setWorkspaceView(null)}
        currentTranscript={{
          title: messages[0]?.content?.slice(0, 60) || "Chat",
          text: messages.map((m) => `${m.role === "user" ? "You" : "AURA"}: ${m.content}`).join("\n\n"),
        }}
        plugins={{ voiceReplies, autoListen: handsFree, stealth: incognito, imageGen }}
        setPlugins={(next: Plugins) => {
          setVoiceReplies(next.voiceReplies);
          setHandsFree(next.autoListen);
          setIncognito(next.stealth);
          setImageGen(next.imageGen);
        }}
      />




      <AccountSheet
        open={showAccount}
        onOpenChange={setShowAccount}
        user={user}
        onUpdated={(next: { name?: string; email?: string; avatarUrl?: string | null }) => setUser((u) => (u ? { ...u, ...next } : u))}
      />

      <SettingsMenu
        open={showSettings}
        onOpenChange={setShowSettings}
        theme={theme}
        setTheme={setTheme}
        incognito={incognito}
        setIncognito={setIncognito}
        persona={persona}
        setPersona={setPersona}
        voiceSpeed={voiceSpeed}
        setVoiceSpeed={setVoiceSpeed}
        voicePitch={voicePitch}
        setVoicePitch={setVoicePitch}
      />


      {/* Main */}
      <main className="relative z-10 flex min-h-[calc(100dvh-68px)] flex-col items-center px-4 pb-36 pt-5 sm:px-10 sm:pt-8">

        {showSettings && false && (
          <div className="mt-4 w-full max-w-md rounded-lg border border-[color:var(--jarvis-cyan)]/30 bg-card/60 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-hud text-[10px] text-[color:var(--jarvis-cyan)] text-glow">
                ◢ VOICE CALIBRATION
              </div>
              <button
                type="button"
                onClick={() => {
                  setVoiceSpeed(0.95);
                  setVoicePitch(0);
                }}
                className="font-hud text-[10px] text-muted-foreground transition hover:text-foreground"
              >
                RESET ▸
              </button>
            </div>

            <VoiceSlider
              label="SPEED"
              value={voiceSpeed}
              min={0.7}
              max={1.3}
              step={0.05}
              display={`${voiceSpeed.toFixed(2)}×`}
              minLabel="Slow"
              maxLabel="Fast"
              onChange={setVoiceSpeed}
              accent="cyan"
            />
            <div className="h-4" />
            <VoiceSlider
              label="PITCH"
              value={voicePitch}
              min={-3}
              max={3}
              step={1}
              display={voicePitch > 0 ? `+${voicePitch}` : `${voicePitch}`}
              minLabel="Deeper"
              maxLabel="Higher"
              onChange={(v) => setVoicePitch(Math.round(v))}
              accent="gold"
            />

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void speak(
                  voicePitch <= -2
                    ? "Systems online, sir. Voice calibration confirmed."
                    : voicePitch >= 2
                      ? "All systems nominal. Ready when you are, sir."
                      : "At your service, sir. How may I assist you today?",
                  true,
                )

              }
              className="font-hud mt-4 w-full rounded-md border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 py-2 text-[11px] text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/20 disabled:opacity-40"
            >
              ▶ PREVIEW VOICE
            </button>
          </div>
        )}


        {messages.length === 0 && (
        <>
        {/* Greeting */}
        <div className="mt-5 flex flex-col items-center text-center sm:mt-7">
          <h1 className="bg-gradient-to-b from-[oklch(1_0_0)] to-[oklch(0.74_0.02_290)] bg-clip-text text-3xl font-light text-transparent sm:text-4xl">
            Hi, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">How can I help you today?</p>
        </div>

        {/* Quick prompts */}
        <div className="mt-8 grid w-full max-w-2xl grid-cols-4 gap-2 sm:gap-4">
          {[
            { icon: Brain, label: "Explain quantum computing", prompt: "Explain quantum computing" },
            { icon: Code2, label: "Write a Python script", prompt: "Write a Python script" },
            { icon: Sparkles, label: "Give me study tips", prompt: "Give me study tips" },
            { icon: Search, label: "Summarize this article", prompt: "Help me summarize an article" },
          ].map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              disabled={busy}
              onClick={() => void sendUserMessage(prompt)}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-[color:var(--jarvis-cyan)]/20 bg-card/20 px-1.5 py-3 text-center text-muted-foreground backdrop-blur-sm transition hover:border-[color:var(--jarvis-cyan)]/55 hover:bg-[color:var(--jarvis-cyan)]/10 hover:text-foreground disabled:opacity-40 sm:min-h-28 sm:px-3"
            >
              <Icon className="h-5 w-5 shrink-0 text-[color:var(--jarvis-cyan)]" />
              <span className="text-[10px] leading-snug sm:text-xs">{label}</span>
            </button>
          ))}
        </div>

        </>
        )}

        {/* Inline error */}
        {error && (
          <div className="mt-4 flex w-full max-w-2xl flex-col items-start gap-2">
            <div className="rounded border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 px-3 py-1 text-xs text-[color:var(--jarvis-red)]">
              {error}
            </div>
          </div>
        )}

        {/* Message composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            const t = textInput.trim();
            if (!t && !pendingImage) return;
            const img = pendingImage;
            setTextInput("");
            setPendingImage(null);
            void sendUserMessage(t, img ?? undefined);
          }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+2.25rem)] left-4 right-4 z-30 mx-auto w-auto max-w-2xl sm:left-8 sm:right-8"
        >
          {pendingImage && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-[color:var(--jarvis-cyan)]/40 bg-card/60 p-2 backdrop-blur">
              <img
                src={pendingImage}
                alt="Attached"
                className="h-12 w-12 rounded object-cover border border-[color:var(--jarvis-cyan)]/40"
              />
              <div className="flex-1 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
                ◢ IMAGE ATTACHED — READY FOR ANALYSIS
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                aria-label="Remove attachment"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--jarvis-red)]/50 text-[color:var(--jarvis-red)] transition hover:bg-[color:var(--jarvis-red)]/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2 rounded-3xl border border-[color:var(--jarvis-cyan)]/35 bg-background/95 px-4 pt-3.5 pb-2.5 backdrop-blur-xl shadow-[0_0_26px_oklch(0.5_0.2_292/0.28)] focus-within:border-[color:var(--jarvis-cyan)] focus-within:shadow-[0_0_34px_oklch(0.55_0.22_292/0.45)] transition">
            <textarea
              rows={2}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={pendingImage ? "Ask AURA about this image…" : "Message AURA…"}
              disabled={busy}
              className="max-h-40 min-h-[3rem] w-full resize-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              aria-label="Message AURA"
            />
            <div className="flex items-center gap-2">
              <UploadMenu onImage={setPendingImage} disabled={busy} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">
                    {auraModel} <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {[
                    ["AURA Lite", "Lightweight · Basic"],
                    ["AURA Ultra", "Paid Model 1"],
                    ["AURA Flash", "Paid Model 2"],
                  ].map(([name, desc]) => (
                    <DropdownMenuItem key={name} onSelect={() => setAuraModel(name)} className="flex flex-col items-start">
                      <span className={auraModel === name ? "text-primary" : undefined}>{name}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="ml-auto">
                {busy ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    aria-label="Stop response"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-80"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : textInput.trim() || pendingImage ? (
                  <button
                    type="submit"
                    disabled={busy}
                    aria-label="Send message"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLiveVoiceOpen(true)}
                    aria-label="Open live voice mode"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.6_0.2_268)] to-[oklch(0.52_0.24_305)] text-white shadow-[0_0_20px_oklch(0.55_0.22_292/0.7)] transition hover:scale-105"
                  >
                    <AudioLines className="h-4 w-4 animate-jarvis-pulse" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Conversation */}
        {messages.length > 0 && (
          <ChatMessages
            messages={messages}
            thinking={state === "thinking"}
            onSpeak={(text) => void speak(text, true)}
            onEdit={(text) => {
              setTextInput(text);
              setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message AURA"]')?.focus(), 50);
            }}
            conversationId={conversationIdRef.current}
            onRetry={(i) => {
              let u = i - 1;
              while (u >= 0 && messages[u].role !== "user") u--;
              if (u < 0) return;
              const q = messages[u];
              const trimmed = messages.slice(0, u);
              messagesRef.current = trimmed;
              setMessages(trimmed);
              syncThread(trimmed);
              void sendUserMessage(q.content === "(image attached)" ? "" : q.content, q.imageUrl);
            }}
            onBranch={(i) => {
              const kept = messages.slice(0, i + 1);
              conversationIdRef.current = null;
              threadIdRef.current = null;
              messagesRef.current = kept;
              setMessages(kept);
              toast.success("Branched into a new chat");
            }}
          />
        )}

      </main>

      {/* Footer glow */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[color:var(--jarvis-cyan-deep)]/25 to-transparent" />
      <div className="pointer-events-none fixed bottom-2 left-0 right-0 z-20 text-center">
        <span className="font-hud text-[9px] tracking-[0.3em] text-muted-foreground">
          AURA • SECURE CHANNEL • CREATED BY <span className="text-[color:var(--jarvis-cyan)] text-glow">CHINNU</span>
        </span>
      </div>

      <PinSetupDialog
        open={pinSetupOpen}
        onClose={() => {
          setPinSetupOpen(false);
          // Sync toggle state to reflect any changes / cancellations.
          setPinEnabled(
            typeof window !== "undefined" &&
              localStorage.getItem(PIN_ENABLED_KEY) === "1" &&
              !!localStorage.getItem(PIN_KEY),
          );
        }}
        onSaved={() => {
          setPinEnabled(true);
          setPinUnlocked(true);
        }}
      />

      <LiveVoiceOverlay
        open={liveVoiceOpen}
        onClose={() => {
          setLiveVoiceOpen(false);
          handsFreeRef.current = false;
          setHandsFree(false);
          if (state === "listening") void stopListeningAndSend();
        }}
        state={state}
        level={level}
        status={status}
        messages={messages.map((m) => ({ role: m.role, content: m.content, ts: m.ts }))}
        onStart={() => {
          handsFreeRef.current = true;
          setHandsFree(true);
          if (state === "idle") void startListening();
        }}
        onSendText={(t) => void sendUserMessage(t)}
      />

      <LiveVisionOverlay
        open={liveVisionOpen}
        onClose={() => setLiveVisionOpen(false)}
        onFrame={analyzeFrame}
      />

    </div>
  );
}

function ProfileMenu({ user, onSignOut, onOpenProfile, onOpenSettings, avatarUrl, onOpenLiveVoice }: { user: { name: string; email: string }; onSignOut: () => void; onOpenProfile: () => void; onOpenSettings: () => void; avatarUrl?: string | null; onOpenLiveVoice: () => void }) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="group flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)] shadow-[0_0_10px_oklch(0.5_0.12_210/0.35)] transition hover:bg-[color:var(--jarvis-cyan)]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--jarvis-cyan)]"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-hud text-xs font-bold text-glow">{initial}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 border-[color:var(--jarvis-cyan)]/40 bg-card/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-hud text-sm font-bold text-glow">{initial}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[color:var(--jarvis-cyan)]/25" />
        <DropdownMenuItem
          onSelect={() => onOpenProfile()}
          className="cursor-pointer gap-2 text-sm focus:bg-[color:var(--jarvis-cyan)]/10"
        >
          <User className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onOpenSettings()}
          className="cursor-pointer gap-2 text-sm focus:bg-[color:var(--jarvis-cyan)]/10"
        >
          <SettingsIcon className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onOpenLiveVoice()}
          className="cursor-pointer gap-2 text-sm focus:bg-[color:var(--jarvis-cyan)]/10"
        >
          <AudioLines className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
          <span>Live Voice Mode</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[color:var(--jarvis-cyan)]/25" />
        <DropdownMenuItem
          onSelect={() => onSignOut()}
          className="cursor-pointer gap-2 text-sm text-[color:var(--jarvis-red)] focus:bg-[color:var(--jarvis-red)]/10 focus:text-[color:var(--jarvis-red)]"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Mode = "general" | "developer" | "creative";
const MODE_META: Record<Mode, { label: string; hint: string; color: string; Icon: typeof Sparkles }> = {
  general: { label: "General", hint: "Balanced assistant", color: "var(--jarvis-cyan)", Icon: Sparkles },
  developer: { label: "Developer", hint: "Coding / Technical", color: "oklch(0.78 0.17 155)", Icon: Code2 },
  creative: { label: "Creative", hint: "Brainstorming / Ideas", color: "oklch(0.72 0.2 310)", Icon: Palette },
};

function ModeSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const current = MODE_META[mode];
  const CurrentIcon = current.Icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change AURA mode"
          className="font-hud group flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/10"
          style={{ color: current.color }}
        >
          <CurrentIcon className="h-3 w-3" />
          <span>AURA {mode !== "general" ? current.label : "• ONLINE"}</span>
          <ChevronDown className="h-3 w-3 opacity-70 transition group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-60 border-[color:var(--jarvis-cyan)]/40 bg-card/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="font-hud text-[9px] tracking-widest text-muted-foreground">
          ◢ SELECT MODE
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[color:var(--jarvis-cyan)]/25" />
        {(Object.keys(MODE_META) as Mode[]).map((m) => {
          const meta = MODE_META[m];
          const Icon = meta.Icon;
          const active = m === mode;
          return (
            <DropdownMenuItem
              key={m}
              onSelect={() => setMode(m)}
              className="cursor-pointer gap-3 py-2 text-sm focus:bg-[color:var(--jarvis-cyan)]/10"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md border"
                style={{ borderColor: meta.color, color: meta.color, background: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[11px] text-muted-foreground">{meta.hint}</span>
              </span>
              {active && <span className="font-hud text-[9px] tracking-widest text-[color:var(--jarvis-cyan)]">ACTIVE</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



function ChatMessages({
  messages,
  thinking,
  onSpeak,
  onRetry,
  onBranch,
  onEdit,
  conversationId,
}: {
  messages: Msg[];
  thinking: boolean;
  onSpeak: (text: string) => void;
  onRetry: (index: number) => void;
  onBranch: (index: number) => void;
  onEdit: (text: string) => void;
  conversationId: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [ratings, setRatings] = useState<Record<number, "up" | "down">>({});
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [selectIndex, setSelectIndex] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const startPress = (i: number) => {
    if (selectIndex === i) return;
    pressTimer.current = window.setTimeout(() => {
      try { navigator.vibrate?.(15); } catch { /* noop */ }
      setMenuIndex(i);
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const formatTs = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
  };
  const sharePrompt = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Prompt copied"); }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      toast.error("Unable to share");
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [messages, thinking]);

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const shareConversation = async () => {
    const url = `${window.location.origin}/?c=${encodeURIComponent(conversationId ?? String(messages[0]?.ts ?? Date.now()))}`;
    try {
      if (navigator.share) await navigator.share({ title: "AURA conversation", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Conversation link copied");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      toast.error("Unable to share");
    }
  };

  return (
    <div className="mt-8 w-full max-w-2xl space-y-8 pb-6" aria-label="Conversation">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        return (
          <Message key={`${message.ts}-${index}`} from={message.role} className={isUser ? "max-w-[88%]" : "max-w-full"}>
            <div className={isUser ? "flex justify-end" : "w-full"}>
              <div className={isUser ? "max-w-full" : "min-w-0 w-full"}>
                {isUser ? (
                  <DropdownMenu open={menuIndex === index} onOpenChange={(o) => setMenuIndex(o ? index : null)}>
                    <DropdownMenuTrigger asChild>
                      <div
                        onPointerDown={(e) => { if (e.button === 0) startPress(index); }}
                        onPointerUp={cancelPress}
                        onPointerLeave={cancelPress}
                        onPointerMove={cancelPress}
                        onContextMenu={(e) => { e.preventDefault(); setMenuIndex(index); }}
                        onClick={(e) => e.preventDefault()}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
                        className={selectIndex === index ? "select-text" : "select-none [-webkit-touch-callout:none]"}
                      >
                        <MessageContent className="rounded-[1.6rem] border border-border bg-secondary px-5 py-3 text-base leading-relaxed">
                          <MessageResponse>{message.content}</MessageResponse>
                          {message.imageUrl && (
                            <img src={message.imageUrl} alt="Conversation attachment" className="mt-3 max-h-80 w-auto max-w-full rounded-lg border border-border object-contain" />
                          )}
                        </MessageContent>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-2">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">{formatTs(message.ts)}</div>
                      <DropdownMenuItem onSelect={() => void copyMessage(message.content)}><Copy className="mr-2 h-4 w-4" />Copy</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { setSelectIndex(index); toast("Select the text you need"); }}><TextSelect className="mr-2 h-4 w-4" />Select text</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit(message.content === "(image attached)" ? "" : message.content)}><Pencil className="mr-2 h-4 w-4" />Edit message</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void sharePrompt(message.content)}><Share2 className="mr-2 h-4 w-4" />Share prompt</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                <MessageContent className="w-full bg-transparent p-0 text-base leading-7">
                  <MessageResponse>{message.content}</MessageResponse>
                  {message.imageUrl && (
                    <img src={message.imageUrl} alt="Conversation attachment" className="mt-3 max-h-80 w-auto max-w-full rounded-lg border border-border object-contain" />
                  )}
                </MessageContent>
            )}
                {!isUser && (
                  <MessageActions className="mt-3 gap-1 text-muted-foreground">
                    <MessageAction tooltip="Copy" onClick={() => void copyMessage(message.content)}><Copy /></MessageAction>
                    <MessageAction
                      tooltip="Good response"
                      aria-pressed={ratings[index] === "up"}
                      className={ratings[index] === "up" ? "text-primary" : undefined}
                      onClick={() => setRatings((current) => ({ ...current, [index]: "up" }))}
                    ><ThumbsUp /></MessageAction>
                    <MessageAction
                      tooltip="Bad response"
                      aria-pressed={ratings[index] === "down"}
                      className={ratings[index] === "down" ? "text-destructive" : undefined}
                      onClick={() => setRatings((current) => ({ ...current, [index]: "down" }))}
                    ><ThumbsDown /></MessageAction>
                    <MessageAction tooltip="Read aloud" onClick={() => onSpeak(message.content)}><Volume2 /></MessageAction>
                    <MessageAction tooltip="Share" onClick={() => void shareConversation()}><Share2 /></MessageAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <MessageAction tooltip="More options"><MoreHorizontal /></MessageAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => onBranch(index)}>Branch in new chat</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onRetry(index)}>Retry</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </MessageActions>
                )}
              </div>
            </div>
          </Message>
        );
      })}
      {thinking && messages.at(-1)?.role === "user" && (
        <div className="flex items-center" aria-live="polite">
          <Shimmer className="text-sm">Thinking…</Shimmer>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function VoiceSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  minLabel,
  maxLabel,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  minLabel: string;
  maxLabel: string;
  onChange: (v: number) => void;
  accent: "cyan" | "gold";
}) {
  const color = accent === "cyan" ? "var(--jarvis-cyan)" : "var(--jarvis-gold)";
  const glow = accent === "cyan" ? "text-glow" : "text-glow-gold";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`font-hud text-[10px]`} style={{ color }}>
          {label}
        </span>
        <span className={`font-hud text-[11px] ${glow}`} style={{ color }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, oklch(0.3 0.02 240 / 0.5) ${pct}%, oklch(0.3 0.02 240 / 0.5) 100%)`,
        }}
      />
      <div className="mt-1 flex justify-between font-hud text-[9px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function SearchingOverlay() {
  // Rolling stream of pseudo-hex + binary "data" for visual noise.
  const [rows, setRows] = useState<string[]>(() => Array.from({ length: 14 }, makeRow));
  useEffect(() => {
    const id = window.setInterval(() => {
      setRows((prev) => [...prev.slice(1), makeRow()]);
    }, 120);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {/* Radar sweep cone */}
      <div className="absolute inset-[6%] rounded-full overflow-hidden">
        {/* concentric rings */}
        {[30, 55, 80].map((pct) => (
          <div
            key={pct}
            className="absolute rounded-full border border-[color:var(--jarvis-cyan)]/25"
            style={{
              top: `${(100 - pct) / 2}%`,
              left: `${(100 - pct) / 2}%`,
              width: `${pct}%`,
              height: `${pct}%`,
            }}
          />
        ))}
        {/* crosshair */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-[color:var(--jarvis-cyan)]/25" />
        <div className="absolute top-1/2 left-0 h-px w-full bg-[color:var(--jarvis-cyan)]/25" />
      </div>

      {/* Streaming data column, left */}
      <div className="absolute left-1 top-4 bottom-4 w-16 overflow-hidden opacity-60 sm:left-2 sm:w-24">
        <div className="font-hud text-[8px] leading-[1.35] text-[color:var(--jarvis-cyan)] text-glow whitespace-pre">
          {rows.join("\n")}
        </div>
      </div>
      {/* Streaming data column, right */}
      <div className="absolute right-1 top-4 bottom-4 w-16 overflow-hidden opacity-60 sm:right-2 sm:w-24">
        <div className="font-hud text-[8px] leading-[1.35] text-right text-[color:var(--jarvis-gold)] text-glow-gold whitespace-pre">
          {rows.slice().reverse().join("\n")}
        </div>
      </div>

      {/* Central status */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="font-hud text-[9px] text-[color:var(--jarvis-cyan)] text-glow animate-jarvis-blink">
          ◢ SEARCHING NEURAL NET ◣
        </div>
        <div className="relative h-[3px] w-40 overflow-hidden rounded bg-[color:var(--jarvis-cyan)]/15">
          <div
            className="absolute inset-y-0 w-1/2 animate-jarvis-search-bar rounded"
            style={{
              background:
                "linear-gradient(90deg, transparent, oklch(0.82 0.16 210 / 0.9), transparent)",
              boxShadow: "0 0 12px oklch(0.82 0.16 210 / 0.8)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

const HEX = "0123456789ABCDEF";
function makeRow() {
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += Math.random() < 0.35 ? (Math.random() < 0.5 ? "0" : "1") : HEX[Math.floor(Math.random() * 16)];
  }
  return s;
}



// ─── Command router ──────────────────────────────────────────────────────
// Recognizes launcher-style voice commands and executes them client-side.
// Returns a spoken confirmation string, or null if the utterance is not a
// command (so it falls through to the LLM).
//
// NOTE: This is a browser app. App-scheme URIs (e.g. whatsapp://) launch the
// native app if installed; otherwise we open a web fallback in a new tab.
// System-settings panels, contact reads, calendar/alarm writes, and radio
// toggles are NOT possible from a browser — those commands return a spoken
// note explaining the limitation.

function openApp(scheme: string, webFallback: string): void {
  // Try the app scheme in the current tab, then open the web fallback in a
  // new tab as a safety net. Browsers that don't recognize the scheme simply
  // do nothing, so the web tab still gives the user a usable result.
  try {
    const w = window.open(webFallback, "_blank", "noopener");
    // Attempt the app scheme via a hidden anchor so it doesn't blank the tab.
    const a = document.createElement("a");
    a.href = scheme;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    void w;
  } catch {
    window.open(webFallback, "_blank", "noopener");
  }
}

type AppEntry = { keys: RegExp; scheme: (q?: string) => string; web: (q?: string) => string; label: string };
const APPS: AppEntry[] = [
  { keys: /\b(whats ?app)\b/i, label: "WhatsApp",
    scheme: () => "whatsapp://", web: () => "https://web.whatsapp.com" },
  { keys: /\binstagram\b/i, label: "Instagram",
    scheme: () => "instagram://", web: () => "https://www.instagram.com" },
  { keys: /\bspotify\b/i, label: "Spotify",
    scheme: () => "spotify:", web: () => "https://open.spotify.com" },
  { keys: /\byoutube\b/i, label: "YouTube",
    scheme: () => "vnd.youtube://", web: () => "https://www.youtube.com" },
  { keys: /\b(gmail|google mail)\b/i, label: "Gmail",
    scheme: () => "googlegmail://", web: () => "https://mail.google.com" },
  { keys: /\b(google\s*)?maps\b/i, label: "Google Maps",
    scheme: () => "comgooglemaps://", web: () => "https://maps.google.com" },
  { keys: /\b(twitter|^x$|\bx app\b)\b/i, label: "Twitter",
    scheme: () => "twitter://", web: () => "https://twitter.com" },
  { keys: /\bfacebook\b/i, label: "Facebook",
    scheme: () => "fb://", web: () => "https://www.facebook.com" },
  { keys: /\btelegram\b/i, label: "Telegram",
    scheme: () => "tg://", web: () => "https://web.telegram.org" },
  { keys: /\bmessenger\b/i, label: "Messenger",
    scheme: () => "fb-messenger://", web: () => "https://www.messenger.com" },
  { keys: /\bnetflix\b/i, label: "Netflix",
    scheme: () => "nflx://", web: () => "https://www.netflix.com" },
  { keys: /\bcalendar\b/i, label: "Google Calendar",
    scheme: () => "googlecalendar://", web: () => "https://calendar.google.com" },
  { keys: /\b(contacts|phonebook)\b/i, label: "Contacts",
    scheme: () => "contacts://", web: () => "https://contacts.google.com" },
];

const SETTINGS_KEYWORDS = /\b(wifi|wi-fi|bluetooth|location|gps|airplane|flight|display|brightness|battery|sound|volume|hotspot|data|mobile data)\b/i;

function playOn(service: "youtube" | "spotify", query: string): string {
  const q = query.replace(/[.?!]+$/, "").trim();
  if (service === "youtube") {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank", "noopener");
    return `Playing ${q} on YouTube, sir.`;
  }
  window.open(`https://open.spotify.com/search/${encodeURIComponent(q)}`, "_blank", "noopener");
  return `Playing ${q} on Spotify, sir.`;
}

export function handleCommand(text: string): string | null {
  const t = text.trim();

  // ── Play on YouTube / Spotify ──
  const playM = t.match(/\bplay\s+(.+?)\s+on\s+(youtube|spotify)\b/i);
  if (playM) return playOn(playM[2].toLowerCase() as "youtube" | "spotify", playM[1]);

  // ── Install X from the store ──
  const installM = t.match(/\binstall\s+(.+?)(?:\s+from\s+(?:the\s+)?(?:play\s*store|app\s*store|store))?[.?!]*$/i);
  if (installM && installM[1]) {
    const q = installM[1].replace(/[.?!]+$/, "").trim();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `https://apps.apple.com/search?term=${encodeURIComponent(q)}`
      : `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`;
    window.open(url, "_blank", "noopener");
    return `Opening the store for ${q}, sir.`;
  }

  // ── Navigate / directions ──
  const navM = t.match(/\b(?:navigate|directions?|drive)\s+(?:to\s+)?(.+)/i);
  if (navM && navM[1]) {
    const dest = navM[1].replace(/[.?!]+$/, "").trim();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    window.open(url, "_blank", "noopener");
    return `Navigating to ${dest}, sir.`;
  }

  // ── Find X near me ──
  const nearM = t.match(/\bfind\s+(.+?)\s+near\s+me\b/i);
  if (nearM && nearM[1]) {
    const q = nearM[1].trim();
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}/`, "_blank", "noopener");
    return `Finding ${q} near you.`;
  }

  // ── Email ──
  const emailM = t.match(/\bemail\s+(\S+@\S+\.\S+)(?:\s+(?:about|regarding|subject)\s+(.+?))?(?:\s+saying\s+(.+))?[.?!]*$/i);
  if (emailM) {
    const to = emailM[1];
    const subject = (emailM[2] ?? "").trim();
    const body = (emailM[3] ?? "").trim();
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const qs = params.toString();
    window.open(`mailto:${to}${qs ? `?${qs}` : ""}`, "_self");
    return `Drafting an email to ${to}, sir.`;
  }

  // ── Text / SMS ──
  const smsM = t.match(/\b(?:text|sms|message)\s+(.+?)(?:\s+saying\s+(.+))?[.?!]*$/i);
  if (smsM) {
    const target = smsM[1].trim();
    const body = (smsM[2] ?? "").trim();
    const digits = target.replace(/[^\d+]/g, "");
    const to = digits.length >= 4 ? digits : target;
    const qs = body ? `?&body=${encodeURIComponent(body)}` : "";
    window.open(`sms:${to}${qs}`, "_self");
    return `Preparing a text to ${target}, sir.`;
  }

  // ── Call: number ──
  const callNumM = t.match(/\b(?:call|dial|phone|ring)\s+([\d\s+\-().]{4,})/i);
  if (callNumM && callNumM[1]) {
    const digits = callNumM[1].replace(/[^\d+]/g, "");
    window.open(`tel:${digits}`, "_self");
    return `Dialing ${digits}, sir.`;
  }

  // ── Call: named contact (browser can't read contacts; open dialer) ──
  const callNameM = t.match(/\b(?:call|dial|phone|ring)\s+([a-z][a-z\s]{1,30})/i);
  if (callNameM && callNameM[1]) {
    const name = callNameM[1].replace(/[.?!]+$/, "").trim();
    window.open(`tel:${encodeURIComponent(name)}`, "_self");
    return `Opening the dialer for ${name}, sir. The browser can't reach your contacts, so please confirm the number.`;
  }

  // ── Add calendar event ──
  const evtM = t.match(/\badd\s+(?:an?\s+)?event\s+(?:for\s+)?(.+)/i);
  if (evtM && evtM[1]) {
    const title = evtM[1].replace(/[.?!]+$/, "").trim();
    window.open(`https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(title)}`, "_blank", "noopener");
    return `Creating a calendar event for ${title}, sir.`;
  }

  // ── Set alarm (browsers can't; guide the user) ──
  const alarmM = t.match(/\bset\s+(?:an?\s+)?alarm(?:\s+for\s+(.+))?/i);
  if (alarmM) {
    return "Alarms are native-only, sir — the browser can't schedule them. On mobile, please use your Clock app.";
  }

  // ── System settings (not available from the browser) ──
  if (/\b(open|show|go to)\b.*\bsettings\b/i.test(t) || /\b(turn on|enable|turn off|disable)\b/i.test(t)) {
    if (SETTINGS_KEYWORDS.test(t)) {
      return "System settings can't be opened from a browser, sir. On a phone, please open them from the notification shade.";
    }
  }

  // ── Known apps by name ──
  if (/\b(open|launch|start|play)\b/i.test(t)) {
    for (const app of APPS) {
      if (app.keys.test(t)) {
        openApp(app.scheme(), app.web());
        return `Opening ${app.label}, sir.`;
      }
    }
  }

  // ── Search ──
  const searchM = t.match(/\b(?:search|google|look up)\b\s+(?:for\s+)?(.+)/i);
  if (searchM && searchM[1]) {
    const q = searchM[1].replace(/[.?!]+$/, "").trim();
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
    return `Searching for ${q}.`;
  }

  // ── Generic "open <site>" website launcher ──
  const openM = t.match(/\b(?:open|launch|go to|visit)\b\s+(?:the\s+)?([a-z0-9][a-z0-9\s.-]{1,40}?)(?:\s+(?:website|site|page|app))?[.?!]*$/i);
  if (openM && openM[1]) {
    const raw = openM[1].trim().toLowerCase().replace(/\s+/g, "");
    const url = /^https?:\/\//i.test(raw)
      ? raw
      : raw.includes(".")
        ? `https://${raw}`
        : `https://www.${raw}.com`;
    window.open(url, "_blank", "noopener");
    return `Opening ${openM[1].trim()}, sir.`;
  }

  return null;
}

// Recognizes an image-generation request and returns the subject prompt,
// or null if the utterance is not an image request.
export function extractImagePrompt(text: string): string | null {
  const t = text.trim();
  const patterns: RegExp[] = [
    /\b(?:generate|create|make|draw|render|design)\s+(?:an?\s+)?(?:image|picture|photo|pic|photograph|art)\s+(?:of\s+)?(.+)/i,
    /\b(?:show|give|get|find|fetch)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image|picture|photo|pic|photograph)\s+(?:of\s+)?(.+)/i,
    /\b(?:image|picture|photo|pic)\s+of\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) {
      return m[1].replace(/[.?!]+$/, "").trim();
    }
  }
  return null;
}

function SettingsMenu({
  open,
  onOpenChange,
  theme,
  setTheme,
  incognito,
  setIncognito,
  persona,
  setPersona,
  voiceSpeed,
  setVoiceSpeed,
  voicePitch,
  setVoicePitch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  incognito: boolean;
  setIncognito: (v: boolean) => void;
  persona: PersonaId;
  setPersona: (p: PersonaId) => void;
  voiceSpeed: number;
  setVoiceSpeed: (v: number) => void;
  voicePitch: number;
  setVoicePitch: (v: number) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <SheetHeader className="relative border-b border-[color:var(--jarvis-cyan)]/25 px-5 pb-4 pt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--jarvis-cyan)]/50 bg-background/70 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/20"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-jarvis-pulse rounded-full bg-[color:var(--jarvis-cyan)] shadow-[0_0_10px_var(--jarvis-cyan)]" />
            <SheetTitle className="font-hud text-sm tracking-[0.25em] text-[color:var(--jarvis-cyan)] text-glow">
              ◢ SYSTEM SETTINGS
            </SheetTitle>
          </div>
          <SheetDescription className="font-hud text-[10px] tracking-widest text-muted-foreground">
            CALIBRATE INTERFACE
          </SheetDescription>
        </SheetHeader>

        <div className="relative flex flex-col gap-5 px-5 py-6">
          {/* Theme */}
          <div className="rounded-md border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/[0.03] p-4">
            <div className="mb-3 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
              ◢ APPEARANCE
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
                ) : (
                  <Sun className="h-4 w-4 text-[color:var(--jarvis-gold)]" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-sm text-foreground">Theme</span>
                  <span className="font-hud text-[9px] tracking-widest text-muted-foreground">
                    {theme === "dark" ? "DARK MODE" : "LIGHT MODE"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`font-hud rounded border px-2 py-1 text-[10px] tracking-widest transition ${
                    theme === "dark"
                      ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)]/20 text-[color:var(--jarvis-cyan)] text-glow"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  DARK
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`font-hud rounded border px-2 py-1 text-[10px] tracking-widest transition ${
                    theme === "light"
                      ? "border-[color:var(--jarvis-gold)] bg-[color:var(--jarvis-gold)]/20 text-[color:var(--jarvis-gold)] text-glow-gold"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  LIGHT
                </button>
              </div>
            </div>
          </div>

          {/* Voice persona */}
          <div className="rounded-md border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/[0.03] p-4">
            <div className="mb-3 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
              ◢ VOICE PERSONA
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PERSONA_LIST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    persona === p.id
                      ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)]/15"
                      : "border-border/60 hover:border-[color:var(--jarvis-cyan)]/50"
                  }`}
                >
                  <div
                    className={`font-hud text-[11px] tracking-widest ${
                      persona === p.id
                        ? "text-[color:var(--jarvis-cyan)] text-glow"
                        : "text-foreground"
                    }`}
                  >
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {p.tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Incognito */}
          <div className="rounded-md border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/[0.03] p-4">
            <div className="mb-3 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
              ◢ PRIVACY
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <EyeOff className={`h-4 w-4 ${incognito ? "text-[color:var(--jarvis-gold)]" : "text-muted-foreground"}`} />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm text-foreground">Incognito mode</span>
                  <span className="font-hud text-[9px] tracking-widest text-muted-foreground">
                    AURA WON'T SAVE HISTORY
                  </span>
                </div>
              </div>
              <Switch checked={incognito} onCheckedChange={setIncognito} aria-label="Toggle incognito mode" />
            </div>
            {incognito && (
              <div className="mt-3 rounded border border-[color:var(--jarvis-gold)]/40 bg-[color:var(--jarvis-gold)]/10 p-2 font-hud text-[9px] tracking-widest text-[color:var(--jarvis-gold)] text-glow-gold">
                ▮ STEALTH ACTIVE — TRANSMISSIONS NOT LOGGED
              </div>
            )}
          </div>

          {/* Voice calibration */}
          <div className="rounded-md border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
                ◢ VOICE CALIBRATION
              </div>
              <button
                type="button"
                onClick={() => { setVoiceSpeed(0.95); setVoicePitch(0); }}
                className="font-hud text-[10px] text-muted-foreground transition hover:text-foreground"
              >
                RESET ▸
              </button>
            </div>
            <VoiceSlider
              label="SPEED"
              value={voiceSpeed}
              min={0.7}
              max={1.3}
              step={0.05}
              display={`${voiceSpeed.toFixed(2)}×`}
              minLabel="Slow"
              maxLabel="Fast"
              onChange={setVoiceSpeed}
              accent="cyan"
            />
            <div className="h-4" />
            <VoiceSlider
              label="PITCH"
              value={voicePitch}
              min={-3}
              max={3}
              step={1}
              display={voicePitch > 0 ? `+${voicePitch}` : `${voicePitch}`}
              minLabel="Deeper"
              maxLabel="Higher"
              onChange={(v) => setVoicePitch(Math.round(v))}
              accent="gold"
            />
          </div>

          {/* Device automation */}
          <AutomationCard />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Upload Menu ----------
function fileToDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function UploadMenu({ onImage, disabled }: { onImage: (dataUrl: string) => void; disabled?: boolean }) {
  const photoRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (f: File | undefined | null) => {
    if (!f) return;
    setErr(null);
    try {
      if (!f.type.startsWith("image/")) {
        setErr("Only image files are supported.");
        return;
      }
      const url = await fileToDataUrl(f, 1024);
      onImage(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <>
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Attach file"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/25 disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-[color:var(--jarvis-cyan)]/40 bg-card/95 backdrop-blur-xl">
          <DropdownMenuLabel className="font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)]">
            ATTACH
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[color:var(--jarvis-cyan)]/25" />
          <DropdownMenuItem onSelect={() => photoRef.current?.click()} className="cursor-pointer gap-2 focus:bg-[color:var(--jarvis-cyan)]/10">
            <ImageIcon className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
            <span>Photos</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()} className="cursor-pointer gap-2 focus:bg-[color:var(--jarvis-cyan)]/10">
            <Camera className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
            <span>Camera</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()} className="cursor-pointer gap-2 focus:bg-[color:var(--jarvis-cyan)]/10">
            <FileText className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
            <span>Files</span>
          </DropdownMenuItem>
          {err && (
            <div className="px-2 py-1 text-[10px] text-[color:var(--jarvis-red)]">{err}</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ---------- Account Sheet ----------
function AccountSheet({
  open,
  onOpenChange,
  user,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; email: string; avatarUrl?: string | null };
  onUpdated: (next: { name?: string; email?: string; avatarUrl?: string | null }) => void;
}) {
  const [fullName, setFullName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setFullName(user.name);
      setEmail(user.email);
      setAvatarUrl(user.avatarUrl ?? null);
      setInfo(null);
      setErr(null);
      setConfirmDelete(false);
    }
  }, [open, user]);

  const handleAvatarFile = async (f?: File | null) => {
    if (!f) return;
    setErr(null);
    try {
      if (!f.type.startsWith("image/")) throw new Error("Choose an image file.");
      const url = await fileToDataUrl(f, 256);
      setAvatarUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    setInfo(null);
    try {
      const payload: {
        data: { full_name: string; avatar_url: string | null };
        email?: string;
      } = {
        data: { full_name: fullName.trim(), avatar_url: avatarUrl },
      };
      if (email.trim() && email.trim() !== user.email) payload.email = email.trim();
      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;
      onUpdated({ name: fullName.trim(), email: email.trim() || user.email, avatarUrl });
      setInfo(
        payload.email
          ? "Saved. Confirm your new email via the link we sent."
          : "Profile updated.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  const doDelete = async () => {
    setSaving(true);
    setErr(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  };

  const initial = (fullName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto border-[color:var(--jarvis-cyan)]/40 bg-card/95 backdrop-blur-xl">
        <SheetHeader className="flex flex-row items-start justify-between">
          <div>
            <SheetTitle className="font-hud tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
              ◢ ACCOUNT SETTINGS ◣
            </SheetTitle>
            <SheetDescription className="font-hud text-[10px] tracking-widest text-muted-foreground">
              PROFILE MANAGEMENT • STARK INDUSTRIES
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/10"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 shadow-[0_0_20px_oklch(0.5_0.12_210/0.35)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-hud text-2xl font-bold text-[color:var(--jarvis-cyan)] text-glow">
                  {initial}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="font-hud rounded-md border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 px-3 py-1.5 text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/25"
              >
                ▸ CHANGE PHOTO
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="font-hud text-[10px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-red)]"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="font-hud mb-1 block text-[10px] tracking-widest text-[color:var(--jarvis-cyan)]">
              FULL NAME
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="font-hud w-full rounded-md border border-[color:var(--jarvis-cyan)]/40 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-[color:var(--jarvis-cyan)] focus:shadow-[0_0_12px_oklch(0.5_0.12_210/0.4)]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="font-hud mb-1 block text-[10px] tracking-widest text-[color:var(--jarvis-cyan)]">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-hud w-full rounded-md border border-[color:var(--jarvis-cyan)]/40 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-[color:var(--jarvis-cyan)] focus:shadow-[0_0_12px_oklch(0.5_0.12_210/0.4)]"
            />
            <p className="font-hud mt-1 text-[9px] tracking-widest text-muted-foreground">
              Changing email requires confirmation via link.
            </p>
          </div>

          {err && (
            <div className="rounded border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-red)]">
              {err}
            </div>
          )}
          {info && !err && (
            <div className="rounded border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-cyan)]">
              {info}
            </div>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="font-hud flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--jarvis-cyan)]/60 bg-[color:var(--jarvis-cyan)]/10 py-2.5 text-xs tracking-[0.3em] text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/20 disabled:cursor-wait disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {saving ? "SAVING…" : "SAVE CHANGES"}
          </button>




          {/* Danger zone */}
          <div className="mt-8 rounded-lg border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[color:var(--jarvis-red)]" />
              <span className="font-hud text-[10px] tracking-[0.3em] text-[color:var(--jarvis-red)]">
                DANGER ZONE
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Delete your account and all associated data. This action is
              permanent and cannot be undone.
            </p>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="font-hud w-full rounded-md border border-[color:var(--jarvis-red)]/60 bg-[color:var(--jarvis-red)]/10 py-2 text-xs tracking-[0.3em] text-[color:var(--jarvis-red)] transition hover:bg-[color:var(--jarvis-red)]/20"
              >
                ▸ DELETE ACCOUNT
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-xs text-[color:var(--jarvis-red)]">
                  Are you absolutely sure?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                    className="font-hud flex-1 rounded-md border border-[color:var(--jarvis-cyan)]/40 py-2 text-[10px] tracking-widest text-muted-foreground transition hover:text-foreground"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDelete()}
                    disabled={saving}
                    className="font-hud flex-1 rounded-md border border-[color:var(--jarvis-red)]/60 bg-[color:var(--jarvis-red)]/20 py-2 text-[10px] tracking-widest text-[color:var(--jarvis-red)] transition hover:bg-[color:var(--jarvis-red)]/30 disabled:opacity-60"
                  >
                    {saving ? "DELETING…" : "CONFIRM DELETE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
