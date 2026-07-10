CREATE ROLE "staffcomplete_app";--> statement-breakpoint
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invitation_tenant_isolation" ON "invitation" AS PERMISSIVE FOR ALL TO "staffcomplete_app" USING ("invitation"."tenantId" = current_setting('app.tenant_id', true)) WITH CHECK ("invitation"."tenantId" = current_setting('app.tenant_id', true));