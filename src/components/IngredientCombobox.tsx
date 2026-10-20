"use client";

import { useId, useMemo, useRef, useState } from "react";
import { searchIngredients } from "@/lib/discovery/search";
import type { Ingredient } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Accessible ingredient search (WAI-ARIA combobox with listbox popup).
 * Arrow keys move, Enter picks, Escape closes.
 */
export function IngredientCombobox({
  ingredients,
  aliases,
  exclude,
  onPick,
  label,
  placeholder = "Search ingredients, e.g. garlic",
  disabled = false,
}: {
  ingredients: Ingredient[];
  aliases: Record<string, string>;
  exclude: string[];
  onPick: (ingredient: Ingredient) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const skip = new Set(exclude);
    return searchIngredients(query, ingredients, aliases, 12).filter((i) => !skip.has(i.id)).slice(0, 8);
  }, [query, ingredients, aliases, exclude]);

  const showList = open && query.trim().length > 0;

  const pick = (ingredient: Ingredient) => {
    onPick(ingredient);
    setQuery("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          disabled={disabled}
          className="field pl-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, Math.max(options.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              if (showList && options[active]) {
                e.preventDefault();
                pick(options[active]);
              }
            } else if (e.key === "Escape") {
              if (showList) {
                e.preventDefault();
                setOpen(false);
              } else {
                setQuery("");
              }
            }
          }}
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!showList}
        className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-[0_12px_32px_-12px_rgba(36,31,26,0.35)]"
      >
        {options.length === 0 ? (
          <li className="px-3 py-2.5 text-sm text-muted" role="presentation">
            No ingredient called “{query.trim()}” in this catalogue yet.
          </li>
        ) : (
          options.map((ing, i) => (
            <li
              key={ing.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 aria-selected:bg-surface-2"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(ing)}
            >
              <IngredientThumb ingredient={ing} size={28} />
              <span className="flex-1 font-medium">{ing.name}</span>
              <span className="text-xs text-muted">{ing.recipeCount} recipes</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function IngredientThumb({ ingredient, size = 40 }: { ingredient: Pick<Ingredient, "iconUrl" | "name">; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!ingredient.iconUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-semibold text-muted"
        style={{ width: size, height: size }}
      >
        {ingredient.name.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ingredient.iconUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
