DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','moderator','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
INSERT INTO public.user_roles (user_id, role) VALUES ('c95459a5-96d1-4bf0-ad17-5b5cf8e89000','admin') ON CONFLICT DO NOTHING;

CREATE TABLE public.aura_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  plan text NOT NULL CHECK (plan IN ('ultra','flash')),
  amount integer NOT NULL,
  utr_number text NOT NULL UNIQUE CHECK (utr_number ~ '^[0-9]{12}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.aura_payment_requests TO authenticated;
GRANT ALL ON public.aura_payment_requests TO service_role;
ALTER TABLE public.aura_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own or admin all" ON public.aura_payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit own pending" ON public.aura_payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND ((plan='ultra' AND amount=400) OR (plan='flash' AND amount=800)));
CREATE POLICY "Admins review" ON public.aura_payment_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.review_payment(_id uuid, _approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.aura_payment_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.aura_payment_requests WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not pending'; END IF;
  UPDATE public.aura_payment_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, reviewed_at = now() WHERE id = _id;
  IF _approve THEN
    INSERT INTO public.aura_subscriptions (user_id, plan, status, current_period_end)
    VALUES (r.user_id, r.plan, 'active', now() + interval '30 days')
    ON CONFLICT (user_id, plan) DO UPDATE SET status='active', current_period_end = GREATEST(public.aura_subscriptions.current_period_end, now()) + interval '30 days';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_payment(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.review_payment(uuid, boolean) TO authenticated;