import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const AURA_PLANS = {
  "AURA Ultra": {
    price: 400,
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

export function AuraUpgradeModal({
  open, initial, onOpenChange, onSubscribe,
}: {
  open: boolean;
  initial: PaidModel;
  onOpenChange: (v: boolean) => void;
  onSubscribe: (m: PaidModel) => void;
}) {
  const [tab, setTab] = useState<PaidModel>(initial);
  const plan = AURA_PLANS[tab];
  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setTab(initial); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-hidden p-0">
        <div className="p-5 pb-3">
          <DialogHeader>
            <DialogTitle>Upgrade your plan</DialogTitle>
            <DialogDescription>Unlock AURA premium models.</DialogDescription>
          </DialogHeader>
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
        </div>
        <ul className="max-h-[40vh] space-y-2 overflow-y-auto px-5 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
          ))}
        </ul>
        <div className="p-5">
          <button type="button" onClick={() => onSubscribe(tab)}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Subscribe to {tab.replace("AURA ", "")} — ₹{plan.price}/mo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
