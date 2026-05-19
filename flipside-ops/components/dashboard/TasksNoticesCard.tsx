"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

type TabKey = "tasks" | "notices" | "activity";

export function TasksNoticesCard({
  tasksPane,
  noticesPane,
  activityPane,
}: {
  tasksPane: ReactNode;
  noticesPane: ReactNode;
  activityPane: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("tasks");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "tasks", label: "My Tasks" },
    { key: "notices", label: "Notices" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <Card>
      <CardHeader className="!py-0 !px-0">
        <div className="flex w-full">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "px-5 py-4 text-sm border-b-2 transition-colors",
                tab === t.key
                  ? "border-brand-500 text-brand-700 font-medium"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody className="!p-0">
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
    <Card>
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
