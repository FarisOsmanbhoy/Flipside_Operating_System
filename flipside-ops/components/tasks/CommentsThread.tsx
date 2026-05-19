"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { addComment, type TaskState } from "@/app/(app)/(administration)/tasks/actions";
import { timeAgo } from "@/lib/format";

type Comment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function CommentsThread({
  taskId,
  comments,
  authors,
}: {
  taskId: string;
  comments: Comment[];
  authors: { id: string; full_name: string | null; avatar_url: string | null }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const [state, action, pending] = useActionState<TaskState, FormData>(
    async (prev, fd) => {
      const r = await addComment(prev, fd);
      if (!r?.error && !r?.fieldErrors) formRef.current?.reset();
      return r;
    },
    undefined,
  );

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted italic">
          No comments yet. Start the thread.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const a = authorMap.get(c.author_id);
            return (
              <li
                key={c.id}
                className="bg-surface border border-border-soft rounded-[var(--radius-card)] p-3 flex gap-3"
              >
                <Avatar
                  name={a?.full_name}
                  src={a?.avatar_url ?? undefined}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">
                    <strong className="text-ink">
                      {a?.full_name ?? "—"}
                    </strong>{" "}
                    · {timeAgo(c.created_at)}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form ref={formRef} action={action} className="space-y-2">
        <input type="hidden" name="task_id" value={taskId} />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Add a comment…"
          className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {state?.error && (
          <p className="text-xs text-danger-700">{state.error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
