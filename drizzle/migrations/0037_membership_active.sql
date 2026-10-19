ALTER TABLE public.tenant_memberships ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS audit_log_tenant_at ON public.audit_log (tenant_id, at DESC);