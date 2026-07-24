CREATE TABLE "run_phase" (
	"id" text PRIMARY KEY NOT NULL,
	"runId" text NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_phase" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workflow_template_phase" (
	"id" text PRIMARY KEY NOT NULL,
	"workflowTemplateId" text NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_template_phase" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run_step" ADD COLUMN "phaseId" text;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD COLUMN "phaseId" text;--> statement-breakpoint
ALTER TABLE "run_phase" ADD CONSTRAINT "run_phase_runId_run_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_phase" ADD CONSTRAINT "run_phase_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_phase" ADD CONSTRAINT "workflow_template_phase_workflowTemplateId_workflow_template_id_fk" FOREIGN KEY ("workflowTemplateId") REFERENCES "public"."workflow_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_phase" ADD CONSTRAINT "workflow_template_phase_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_phaseId_run_phase_id_fk" FOREIGN KEY ("phaseId") REFERENCES "public"."run_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD CONSTRAINT "workflow_template_step_phaseId_workflow_template_phase_id_fk" FOREIGN KEY ("phaseId") REFERENCES "public"."workflow_template_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "run_phase_tenant_isolation" ON "run_phase" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("run_phase"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("run_phase"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
CREATE POLICY "workflow_template_phase_tenant_isolation" ON "workflow_template_phase" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("workflow_template_phase"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("workflow_template_phase"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
-- Backfill: give every pre-existing template/run a single default phase and
-- point its steps at it, so phaseId has a value everywhere before a
-- follow-up migration tightens it to NOT NULL once the write paths always
-- set it (see the comments on workflowTemplateStep/runStep in schema.ts).
INSERT INTO "workflow_template_phase" ("id", "workflowTemplateId", "organizationId", "name", "position")
SELECT gen_random_uuid()::text, "id", "organizationId", 'Steps', 0
FROM "workflow_template";--> statement-breakpoint
UPDATE "workflow_template_step" AS s
SET "phaseId" = p."id"
FROM "workflow_template_phase" AS p
WHERE p."workflowTemplateId" = s."workflowTemplateId";--> statement-breakpoint
INSERT INTO "run_phase" ("id", "runId", "organizationId", "name", "position")
SELECT gen_random_uuid()::text, "id", "organizationId", 'Steps', 0
FROM "run";--> statement-breakpoint
UPDATE "run_step" AS s
SET "phaseId" = p."id"
FROM "run_phase" AS p
WHERE p."runId" = s."runId";