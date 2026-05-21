"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export type TasksNoticesTabKey =
  | "industry"
  | "tasks"
  | "notices"
  | "activity";

export function TasksNoticesCard({
  tasksPane,
  noticesPane,
  activityPane,
  industryPane,
  counts,
}: {
  tasksPane: ReactNode;
  noticesPane: ReactNode;
  activityPane: ReactNode;
  industryPane: ReactNode;
  counts?: Partial<Record<TasksNoticesTabKey, number>>;
}) {
  const [tab, setTab] = useState<TasksNoticesTabKey>("industry");

  const tabs: { key: TasksNoticesTabKey; label: string }[] = [
    { key: "industry", label: "Industry" },
    { key: "tasks", label: "My Tasks" },
    { key: "notices", label: "Notices" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <Card>
      <CardHeader className="!py-4 !px-5 border-b border-border-soft">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted">
          Tasks and notices
        </CardTitle>
      </CardHeader>
      <CardHeader className="!py-0 !px-0 !border-0">
        <div className="flex w-full flex-wrap">
          {tabs.map((t) => {
            const count = counts?.[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-5 py-4 text-sm border-b-[3px] transition-colors inline-flex items-center gap-2",
                  tab === t.key
                    ? "border-brand-500 text-brand-700 font-semibold"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-danger-600 text-white text-[10px] font-semibold leading-none">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardBody className="!p-0 max-h-[min(520px,60vh)] overflow-y-auto">
        {tab === "industry" && industryPane}
        {tab === "tasks" && tasksPane}
        {tab === "notices" && noticesPane}
        {tab === "activity" && activityPane}
      </CardBody>
    </Card>
  );
}

export function ComingSoonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-warning-50 text-warning-700">
          Coming soon
        </span>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-muted">{description}</p>
      </CardBody>
    </Card>
  );
}
