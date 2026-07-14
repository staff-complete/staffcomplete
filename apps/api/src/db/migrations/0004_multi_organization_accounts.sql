CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tenant" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tenant" CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_token_unique";--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_tenantId_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_invitedByUserId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_tenantId_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "inviterId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "activeOrganizationId" text;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" DROP COLUMN "tenantId";--> statement-breakpoint
ALTER TABLE "invitation" DROP COLUMN "invitedByUserId";--> statement-breakpoint
ALTER TABLE "invitation" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "tenantId";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";--> statement-breakpoint
ALTER POLICY "invitation_tenant_isolation" ON "invitation" TO staffcomplete_tenant USING ("invitation"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("invitation"."organizationId" = current_setting('app.organization_id', true));