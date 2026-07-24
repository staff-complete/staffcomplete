ALTER TABLE "run_step" ADD COLUMN "action" text;--> statement-breakpoint
ALTER TABLE "run_step" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD COLUMN "action" text;--> statement-breakpoint
ALTER TABLE "workflow_template_step" ADD COLUMN "config" jsonb;