"use client";

import { useState } from "react";
import type { RecipeIngredient } from "@/lib/types";

/** Tick-off list for cooking. State is local to this page view. */
export function IngredientChecklist({ items }: { items: RecipeIngredient[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const done = checked.has(item.ingredientId);
        return (
          <li key={item.ingredientId}>
            <label className="flex min-h-12 cursor-pointer items-start gap-3 py-2.5">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[var(--herb)]"
                checked={done}
                onChange={() => toggle(item.ingredientId)}
              />
              <span className={`flex flex-1 flex-wrap items-baseline justify-between gap-x-3 ${done ? "text-muted line-through" : ""}`}>
                <span className="font-medium">
                  {item.sourceName}
                  {item.isOptional && <span className="ml-2 text-xs font-semibold tracking-wide text-muted uppercase no-underline">optional</span>}
                </span>
                <span className="text-sm text-muted">{item.measure ?? "amount not given"}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
