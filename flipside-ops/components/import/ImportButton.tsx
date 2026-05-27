"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { ImportChat } from "./ImportChat";
import type { ImportDomain } from "@/lib/import/schemas";

export function ImportButton({
  domain,
  label = "Import",
}: {
  domain: ImportDomain;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="md"
        onClick={() => setOpen(true)}
        title="Bulk import from Excel or CSV (AI-assisted)"
      >
        <Upload size={16} /> {label}
      </Button>
      {open && (
        <ImportChat
          domain={domain}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
