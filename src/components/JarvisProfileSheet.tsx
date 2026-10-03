import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus,
  MessageSquare,
  User,
  Settings as SettingsIcon,
  AudioLines,
  Eye,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  X,
  ChevronRight,
  ChevronLeft,
  Mail,
  MonitorUp,
  HardDrive,
  SlidersHorizontal,
} from "lucide-react";


type Row = {
  label: string;
  Icon: typeof User;
  run: () => void;
  hint?: string;
  danger?: boolean;
};

export function JarvisProfileSheet({
  open,
  onOpenChange,
  user,
  avatarUrl,
  onNewChat,
  onOpenHistory,
  onOpenProfile,
  onOpenSettings,
  onOpenVoiceMode,
  onOpenLiveVision,
  onOpenScreenShare,
  onOpenStorage,
  onOpenDataControls,
  pinEnabled,
  onTogglePin,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: { name: string; email: string };
  avatarUrl?: string | null;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenVoiceMode: () => void;
  onOpenLiveVision: () => void;
  onOpenScreenShare: () => void;
  onOpenStorage: () => void;
  onOpenDataControls: () => void;
  pinEnabled: boolean;
  onTogglePin: () => void;
  onSignOut: () => void;
}) {

  const [helpOpen, setHelpOpen] = useState(false);
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  const close = () => {
    setHelpOpen(false);
    onOpenChange(false);
  };
  const act = (fn: () => void) => () => {
    close();
    fn();
  };

  const groups: Row[][] = [
    [
      { label: "New Chat", Icon: Plus, run: act(onNewChat) },
      { label: "Chat History", Icon: MessageSquare, run: act(onOpenHistory) },
    ],
    [
      { label: "My Profile", Icon: User, run: act(onOpenProfile) },
      { label: "Settings", Icon: SettingsIcon, run: act(onOpenSettings) },
    ],
    [
      { label: "Voice Mode", Icon: AudioLines, run: act(onOpenVoiceMode) },
      { label: "Live Vision", Icon: Eye, run: act(onOpenLiveVision) },
    ],
    [
      { label: "Storage", Icon: HardDrive, run: act(onOpenStorage) },
      { label: "Data Controls", Icon: SlidersHorizontal, run: act(onOpenDataControls) },
    ],

    [
      { label: "Help & Support", Icon: LifeBuoy, run: () => setHelpOpen(true) },
    ],
    [{ label: "Sign Out", Icon: LogOut, danger: true, run: act(onSignOut) }],
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88vh] flex-col rounded-t-3xl border-t border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl [&>button:first-of-type]:hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-t-3xl opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.5 0.12 210 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.35) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="relative mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[color:var(--jarvis-cyan)]/40" />

        <SheetHeader className="relative shrink-0 items-center gap-1 px-5 pb-2 pt-4 text-center">
          {helpOpen ? (
            <>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="absolute left-4 top-4 flex items-center gap-1 font-hud text-[10px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> BACK
              </button>
              <SheetTitle className="font-hud text-base text-[color:var(--jarvis-cyan)] text-glow">
                Help &amp; Support
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Quick answers and a direct channel to the operator desk.
              </SheetDescription>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)] shadow-[0_0_24px_oklch(0.6_0.14_210/0.35)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-hud text-xl font-bold text-glow">{initial}</span>
                )}
              </div>
              <SheetTitle className="mt-2 text-base font-semibold text-foreground">
                {user.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {user.email}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3 pb-2">
            {helpOpen ? (
              <div className="space-y-2 pt-1">
                {[
                  {
                    q: "Voice not responding?",
                    a: "Allow microphone access in your browser or device settings, then tap the core once.",
                  },
                  {
                    q: "Live Vision shows a black screen?",
                    a: "Grant camera permission and make sure no other app is using the camera.",
                  },
                  {
                    q: "Forgot your PIN?",
                    a: "Sign out and back in, then disable and re-create the PIN from this menu.",
                  },
                ].map((f) => (
                  <div
                    key={f.q}
                    className="rounded-2xl border border-[color:var(--jarvis-cyan)]/25 bg-background/50 px-4 py-3"
                  >
                    <div className="font-hud text-[11px] tracking-wide text-[color:var(--jarvis-cyan)]">
                      {f.q}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.a}</p>
                  </div>
                ))}
                <a
                  href="mailto:support@aura.app?subject=AURA%20Support"
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/10 px-4 py-3.5 text-sm text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/20"
                >
                  <Mail className="h-4 w-4" />
                  <span className="flex-1">Contact support</span>
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </a>
              </div>
            ) : (
              groups.map((rows, gi) => (
                <div key={gi} className="mb-2 space-y-2">
                  {rows.map(({ label, Icon, run, hint, danger }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={run}
                      className={`flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left text-sm transition active:scale-[0.99] ${
                        danger
                          ? "border-[color:var(--jarvis-red)]/40 bg-[color:var(--jarvis-red)]/10 text-[color:var(--jarvis-red)] hover:bg-[color:var(--jarvis-red)]/20"
                          : "border-[color:var(--jarvis-cyan)]/20 bg-background/50 text-foreground hover:border-[color:var(--jarvis-cyan)]/50 hover:bg-[color:var(--jarvis-cyan)]/10"
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] ${
                          danger ? "" : "text-[color:var(--jarvis-cyan)]"
                        }`}
                      />
                      <span className="flex-1">{label}</span>
                      {hint ? (
                        <span
                          className={`font-hud text-[9px] tracking-widest ${
                            hint === "ON"
                              ? "text-[color:var(--jarvis-cyan)] text-glow"
                              : "text-muted-foreground"
                          }`}
                        >
                          {hint}
                        </span>
                      ) : (
                        !danger && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="relative shrink-0 border-t border-[color:var(--jarvis-cyan)]/20 px-5 py-3">
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-background/60 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/15 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
