-- Report versions are immutable snapshots. These nullable fields preserve
-- live-task details at import/save time without changing existing history.
ALTER TABLE "report_tasks"
  ADD COLUMN "source_task_description" TEXT,
  ADD COLUMN "source_task_planned_date" DATE,
  ADD COLUMN "source_task_due_date" DATE,
  ADD COLUMN "source_task_assignee_name" VARCHAR(201);
