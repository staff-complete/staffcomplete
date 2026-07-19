CREATE TABLE "workflow_template" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workflow_template_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflowTemplateId" text NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"assigneeId" text,
	"dueDateOffsetDays" integer,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_template_step" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD CONSTRAINT "workflow_template_step_workflowTemplateId_workflow_template_id_fk" FOREIGN KEY ("workflowTemplateId") REFERENCES "public"."workflow_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD CONSTRAINT "workflow_template_step_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD CONSTRAINT "workflow_template_step_assigneeId_member_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "workflow_template_tenant_isolation" ON "workflow_template" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("workflow_template"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("workflow_template"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
CREATE POLICY "workflow_template_step_tenant_isolation" ON "workflow_template_step" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("workflow_template_step"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("workflow_template_step"."organizationId" = current_setting('app.organization_id', true));