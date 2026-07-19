CREATE TABLE "subscription" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"plan" text,
	"trialStartedAt" timestamp NOT NULL,
	"trialEndsAt" timestamp NOT NULL,
	"trialReminderSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "subscription_tenant_isolation" ON "subscription" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("subscription"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("subscription"."organizationId" = current_setting('app.organization_id', true));