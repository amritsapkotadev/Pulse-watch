"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface KeyValueRowData {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface KeyValueEditorProps<T extends KeyValueRowData> {
  rows: T[];
  onChange: (rows: T[]) => void;
  createRow: () => T;
  label: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor<T extends KeyValueRowData>({
  rows,
  onChange,
  createRow,
  label,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueEditorProps<T>) {
  function updateRow(id: string, patch: Partial<T>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1.4fr)_36px] items-center gap-2 border-b bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground">
            <span className="sr-only">Enabled</span>
            <span>Key</span>
            <span>Value</span>
            <span className="sr-only">Remove</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} yet. Add one below.
            </p>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1.4fr)_36px] items-center gap-2 border-b px-2 py-2 last:border-b-0"
              >
                <Checkbox
                  checked={row.enabled}
                  onCheckedChange={(checked) => updateRow(row.id, { enabled: checked } as Partial<T>)}
                  aria-label={`Enable ${label} row ${index + 1}`}
                />
                <Input
                  value={row.key}
                  onChange={(event) => updateRow(row.id, { key: event.target.value } as Partial<T>)}
                  placeholder={keyPlaceholder}
                  aria-label={`${label} key ${index + 1}`}
                />
                <Input
                  value={row.value}
                  onChange={(event) => updateRow(row.id, { value: event.target.value } as Partial<T>)}
                  placeholder={valuePlaceholder}
                  aria-label={`${label} value ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove ${label} row ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, createRow()])}>
        <Plus />
        Add {label === "headers" ? "header" : "parameter"}
      </Button>
    </div>
  );
}
