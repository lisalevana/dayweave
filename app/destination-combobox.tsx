"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { searchDestinationSuggestions } from "@/lib/dayweave/destinations";

interface DestinationComboboxProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function DestinationCombobox({
  value,
  disabled = false,
  onChange,
  onSubmit,
}: DestinationComboboxProps) {
  const listboxId = useId();
  const hintId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(
    () => searchDestinationSuggestions(value),
    [value],
  );
  const activeSuggestion =
    activeIndex >= 0 ? suggestions[activeIndex] : undefined;

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  function choose(label: string) {
    onChange(label);
    setActiveIndex(-1);
    setOpen(false);
    onSubmit(label);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        Math.min(
          current < 0 ? 0 : current + 1,
          Math.max(0, suggestions.length - 1),
        ),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current < 0
          ? Math.max(0, suggestions.length - 1)
          : Math.max(0, current - 1),
      );
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    if (open && activeSuggestion) {
      choose(activeSuggestion.label);
      return;
    }
    onSubmit(value);
  }

  return (
    <div
      className="destination-combobox"
      ref={rootRef}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !nextTarget ||
          !rootRef.current?.contains(nextTarget as Node)
        ) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label className="destination-field" htmlFor="destination-input">
        <span>
          Destination
          <small>Choose a city, island or compact region</small>
        </span>
        <input
          id="destination-input"
          className="text-input"
          role="combobox"
          aria-label="Destination"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeSuggestion
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={hintId}
          value={value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Hong Kong"
          autoComplete="off"
        />
      </label>
      <span className="sr-only" id={hintId}>
        Choose one city, island or compact region. Add individual places in the next field.
      </span>

      {open && (
        <div className="destination-combobox__popup">
          <ul id={listboxId} role="listbox" aria-label="Destination suggestions">
            {suggestions.map((suggestion, index) => (
              <li
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? "is-active" : undefined}
                key={suggestion.label}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(suggestion.label)}
              >
                <strong>{suggestion.label}</strong>
                <small>{suggestion.kind}</small>
              </li>
            ))}
          </ul>
          {suggestions.length === 0 && (
            <p className="destination-combobox__empty">
              No exact match. Keep typing any city, island or region.
            </p>
          )}
          <p className="destination-combobox__hint">
            {value.trim()
              ? "Choose a match or keep your own destination."
              : "Start typing to search every country and region."}
          </p>
        </div>
      )}
    </div>
  );
}
