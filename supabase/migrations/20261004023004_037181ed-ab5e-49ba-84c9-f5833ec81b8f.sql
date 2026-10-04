CREATE TABLE public.aura_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('ultra','flash')),
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan)
);
GRANT SELECT ON public.aura_subscriptions TO authenticated;
GRANT ALL ON public.aura_subscriptions TO service_role;
ALTER TABLE public.aura_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.aura_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);