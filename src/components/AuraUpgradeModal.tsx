import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const UPI_ID = "8106727043@superyes";
const UPI_NAME = "AURA AI";

export const AURA_PLANS = {
  "AURA Ultra": {
    price: 400,
    plan: "ultra",
    label: "Paid Model 1",
    features: [
      "🤖 Multi-AI Provider Gateway", "🔄 Automatic Provider Fallback", "⚡ Retry & Provider Cooldown",
      "🧠 AURA Orchestrator", "🛠️ 37-Tool Intelligence Framework", "🎯 Automatic Tool Selection",
      "🔗 Multi-Tool Execution & Chaining", "🧮 Calculator & Reasoning Tools", "📄 Document & File Processing Tools",
      "💻 Coding, Analysis & Debugging Tools", "👁️ Vision & OCR Tools", "🎙️ Speech AI Tools",
      "🔐 Secure AURA API Key", "📡 Native Streaming / SSE", "📊 Usage Tracking & Audit Logs",
      "🏥 Provider Health & Recovery", "🔑 API Key Management", "🌐 Unified AURA API",
      "🛡️ Tool Safety / Sandbox Controls",
    ],
  },
  "AURA Flash": {
    price: 800,
    plan: "flash",
    label: "Paid Model 2",
    features: [
      "🧠 Advanced AURA Brain", "📚 Own knowledge + reasoning", "🎯 Intelligent decision making",
      "🔍 Automatic knowledge-gap detection", "🛠️ Smart tool selection", "🔗 Multi-tool reasoning chains",
      "✅ Grounded answers from tool results", "🔄 Provider selection & fallback intelligence",
      "🧪 Advanced model/evaluation infrastructure", "🚀 Advanced inference capabilities",
    ],
  },
} as const;

export type PaidModel = keyof typeof AURA_PLANS;

type PayReq = { id: string; email: string | null; plan: string; amount: number; utr_number: string; status: string; created_at: string };

export function upiLink(amount: number, plan: string) {
  return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`AURA ${plan}`)}`;
}

export function AuraUpgradeModal({
  open, initial, onOpenChange, onApproved,
}: {
  open: boolean;
  initial: PaidModel;
  onOpenChange: (v: boolean) => void;
  onApproved?: () => void;
  onSubscribe?: (m: PaidModel) => void;
}) {
  const [tab, setTab] = useState<PaidModel>(initial);
  const [step, setStep] = useState<"plan" | "pay" | "admin">("plan");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<PayReq[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<PayReq[]>([]);
  const plan = AURA_PLANS[tab];

  const load = async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return;
    const { data: admin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    setIsAdmin(!!admin);
    const { data } = await supabase.from("aura_payment_requests")
      .select("id,email,plan,amount,utr_number,status,created_at").order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as PayReq[];
    setMine(rows.filter((r) => r.email === s.session?.user.email));
    setPending(rows.filter((r) => r.status === "pending"));
  };

  useEffect(() => { if (open) { setTab(initial); setStep("plan"); setUtr(""); void load(); } }, [open, initial]);

  const myPending = mine.find((r) => r.plan === plan.plan && r.status === "pending");

  const submit = async () => {
    if (!/^\d{12}$/.test(utr)) { toast.error("12-digit UTR number enter చేయండి"); return; }
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const u = s.session?.user;
    if (!u) { setBusy(false); toast.error("Please sign in first"); return; }
    const { error } = await supabase.from("aura_payment_requests").insert({
      user_id: u.id, email: u.email ?? null, plan: plan.plan, amount: plan.price, utr_number: utr,
    });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "ఈ UTR ఇప్పటికే వాడబడింది" : "Submit failed. Try again.");
      return;
    }
    toast.success("Payment submitted — verification తర్వాత ప్లాన్ అన్‌లాక్ అవుతుంది");
    setUtr("");
    void load();
  };

  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("review_payment", { _id: id, _approve: approve });
    if (error) { toast.error("Action failed"); return; }
    toast.success(approve ? "Approved — plan activated for 30 days" : "Rejected");
    void load();
    onApproved?.();
  };

  const copy = (t: string) => { void navigator.clipboard?.writeText(t); toast.success("Copied"); };
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink(plan.price, plan.plan))}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto p-0">
        <div className="p-5 pb-3">
          <DialogHeader>
            <DialogTitle>{step === "admin" ? "Payment Approvals" : "Upgrade your plan"}</DialogTitle>
            <DialogDescription>{step === "admin" ? "Verify UTR in your UPI app, then approve." : "Unlock AURA premium models."}</DialogDescription>
          </DialogHeader>
          {step !== "admin" && (
            <>
              <div className="mt-4 grid grid-cols-2 rounded-full border border-border p-1 text-sm">
                {(Object.keys(AURA_PLANS) as PaidModel[]).map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)}
                    className={`rounded-full py-1.5 transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {k.replace("AURA ", "")}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">₹{plan.price}</span>
                <span className="text-sm text-muted-foreground">/ month · {plan.label}</span>
              </div>
            </>
          )}
        </div>

        {step === "plan" && (
          <>
            <ul className="max-h-[36vh] space-y-2 overflow-y-auto px-5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
              ))}
            </ul>
            <div className="space-y-2 p-5">
              {myPending ? (
                <p className="rounded-lg border border-border p-3 text-center text-sm text-muted-foreground">⏳ Payment under review (UTR {myPending.utr_number}). Verify అయిన వెంటనే అన్‌లాక్ అవుతుంది.</p>
              ) : (
                <button type="button" onClick={() => setStep("pay")}
                  className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                  Pay ₹{plan.price} via UPI
                </button>
              )}
              {isAdmin && (
                <button type="button" onClick={() => setStep("admin")}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-2 text-sm">
                  <ShieldCheck className="h-4 w-4" /> Payment Approvals ({pending.length})
                </button>
              )}
            </div>
          </>
        )}

        {step === "pay" && (
          <div className="space-y-3 px-5 pb-5 text-sm">
            <img src={qr} alt={`UPI QR for ₹${plan.price}`} className="mx-auto h-48 w-48 rounded-lg bg-background p-2" />
            <button type="button" onClick={() => copy(UPI_ID)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
              <span>{UPI_ID}</span><Copy className="h-4 w-4" />
            </button>
            <a href={upiLink(plan.price, plan.plan)}
              className="block w-full rounded-full bg-primary py-2.5 text-center font-medium text-primary-foreground">
              Pay via GPay / PhonePe / Paytm
            </a>
            <input value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric" placeholder="12-digit UTR / UPI Ref number"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none" />
            <button type="button" disabled={busy} onClick={() => void submit()}
              className="w-full rounded-full border border-primary py-2.5 font-medium text-primary disabled:opacity-50">
              {busy ? "Submitting…" : "Submit Payment"}
            </button>
            <button type="button" onClick={() => setStep("plan")} className="w-full text-xs text-muted-foreground">← Back</button>
          </div>
        )}

        {step === "admin" && (
          <div className="space-y-2 px-5 pb-5 text-sm">
            {pending.length === 0 && <p className="text-center text-muted-foreground">No pending payments.</p>}
            {pending.map((r) => (
              <div key={r.id} className="space-y-1 rounded-lg border border-border p-3">
                <div className="font-medium">{r.email ?? "user"}</div>
                <div className="text-muted-foreground">{r.plan === "ultra" ? "AURA Ultra" : "AURA Flash"} · ₹{r.amount} · {new Date(r.created_at).toLocaleString()}</div>
                <button type="button" onClick={() => copy(r.utr_number)} className="flex items-center gap-1 font-mono">UTR {r.utr_number} <Copy className="h-3 w-3" /></button>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => void review(r.id, true)} className="flex-1 rounded-full bg-primary py-1.5 text-primary-foreground">✓ Approve</button>
                  <button type="button" onClick={() => void review(r.id, false)} className="flex-1 rounded-full border border-border py-1.5">✕ Reject</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setStep("plan")} className="w-full text-xs text-muted-foreground">← Back</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
