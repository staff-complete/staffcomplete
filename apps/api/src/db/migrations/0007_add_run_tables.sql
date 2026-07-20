CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"workflowTemplateId" text,
	"type" text NOT NULL,
	"employeeName" text NOT NULL,
	"employeeEmail" text NOT NULL,
	"employeeRole" text NOT NULL,
	"eventDate" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "run_step" (
	"id" text PRIMARY KEY NOT NULL,
	"runId" text NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"assigneeId" text,
	"dueDateOffsetDays" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_step" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_workflowTemplateId_workflow_template_id_fk" FOREIGN KEY ("workflowTemplateId") REFERENCES "public"."workflow_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_runId_run_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_assigneeId_member_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "run_tenant_isolation" ON "run" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("run"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("run"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
CREATE POLICY "run_step_tenant_isolation" ON "run_step" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("run_step"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("run_step"."organizationId" = current_setting('app.organization_id', true));