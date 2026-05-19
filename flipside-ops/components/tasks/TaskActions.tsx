"use client";

import { useState, useTransition } from "react";
import {
  setTaskStatus,
  convertToRecurring,
} from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import type { Task } from "@/lib/database.types";

export function TaskActions({ task }: { task: Task }) {
  const [pending, start] = useTransition();
  const { push } = useToast();
  const [recurrence, setRecurrence] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("weekly");

  const update = (status: Task["status"]) =>
    start(async () => {
      try {
        await setTaskStatus({ id: task.id, status });
        push({ tone: "success", message: `Marked ${status.replace("_", " ")}.` });
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  const recurringIt = () =>
    start(async () => {
      try {
        await convertToRecurring({ id: task.id, recurrence });
        push({ tone: "success", message: "Converted to recurring template." });
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || task.status === "in_progress"}
          onClick={() => update("in_progress")}
        >
          In progress
        </Button>
        <Button
          size="sm"
          disabled={pending || task.status === "done"}
          onClick={() => update("done")}
        >
          Mark done
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || task.status === "cancelled"}
          onClick={() => update("cancelled")}
        >
          Cancel
        </Button>
      </div>

      {task.type === "task" && task.recurrence === "none" && (
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={recurrence}
            onChange={(e) =>
              setRecurrence(
                e.target.value as "daily" | "weekly" | "monthly" | "yearly",
              )
            }
            className="h-8 text-xs"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
          <Button size="sm" variant="outline" onClick={recurringIt}>
            Convert to recurring
          </Button>
        </div>
      )}
    </div>
  );
}
