CREATE TABLE "run_phase_dependency" (
	"id" text PRIMARY KEY NOT NULL,
	"phaseId" text NOT NULL,
	"dependsOnPhaseId" text NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_phase_dependency_phaseId_dependsOnPhaseId_unique" UNIQUE("phaseId","dependsOnPhaseId")
);
--> statement-breakpoint
ALTER TABLE "run_phase_dependency" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workflow_template_phase_dependency" (
	"id" text PRIMARY KEY NOT NULL,
	"phaseId" text NOT NULL,
	"dependsOnPhaseId" text NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_template_phase_dependency_phaseId_dependsOnPhaseId_unique" UNIQUE("phaseId","dependsOnPhaseId")
);
--> statement-breakpoint
ALTER TABLE "workflow_template_phase_dependency" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run_phase_dependency" ADD CONSTRAINT "run_phase_dependency_phaseId_run_phase_id_fk" FOREIGN KEY ("phaseId") REFERENCES "public"."run_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_phase_dependency" ADD CONSTRAINT "run_phase_dependency_dependsOnPhaseId_run_phase_id_fk" FOREIGN KEY ("dependsOnPhaseId") REFERENCES "public"."run_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_phase_dependency" ADD CONSTRAINT "run_phase_dependency_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_phase_dependency" ADD CONSTRAINT "workflow_template_phase_dependency_phaseId_workflow_template_phase_id_fk" FOREIGN KEY ("phaseId") REFERENCES "public"."workflow_template_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_phase_dependency" ADD CONSTRAINT "workflow_template_phase_dependency_dependsOnPhaseId_workflow_template_phase_id_fk" FOREIGN KEY ("dependsOnPhaseId") REFERENCES "public"."workflow_template_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_phase_dependency" ADD CONSTRAINT "workflow_template_phase_dependency_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "run_phase_dependency_tenant_isolation" ON "run_phase_dependency" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("run_phase_dependency"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("run_phase_dependency"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
CREATE POLICY "workflow_template_phase_dependency_tenant_isolation" ON "workflow_template_phase_dependency" AS PERMISSIVE FOR ALL TO "staffcomplete_tenant" USING ("workflow_template_phase_dependency"."organizationId" = current_setting('app.organization_id', true)) WITH CHECK ("workflow_template_phase_dependency"."organizationId" = current_setting('app.organization_id', true));--> statement-breakpoint
-- Backfill (ADR-0019): give every existing phase a dependency edge on the
-- phase immediately before it by position, so locking behaves exactly as it
-- did under ADR-0017's position-walk the moment the new dependency-based
-- computeUnlockedPhaseIds deploys. The first phase in each template/run gets
-- no edge (LAG() is NULL for it), matching its current "unlocked
-- immediately" behavior — it becomes a root under the new model.
INSERT INTO "workflow_template_phase_dependency" ("id", "phaseId", "dependsOnPhaseId", "organizationId")
SELECT gen_random_uuid()::text, "id", "prevId", "organizationId"
FROM (
	SELECT "id", "organizationId",
		LAG("id") OVER (PARTITION BY "workflowTemplateId" ORDER BY "position") AS "prevId"
	FROM "workflow_template_phase"
) AS "ordered"
WHERE "prevId" IS NOT NULL;--> statement-breakpoint
INSERT INTO "run_phase_dependency" ("id", "phaseId", "dependsOnPhaseId", "organizationId")
SELECT gen_random_uuid()::text, "id", "prevId", "organizationId"
FROM (
	SELECT "id", "organizationId",
		LAG("id") OVER (PARTITION BY "runId" ORDER BY "position") AS "prevId"
	FROM "run_phase"
) AS "ordered"
WHERE "prevId" IS NOT NULL;