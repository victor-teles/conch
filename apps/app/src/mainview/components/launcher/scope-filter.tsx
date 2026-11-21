import type { ChangeEvent, FocusEvent, MouseEvent } from "react";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useEffect, useId, useRef } from "react";

import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { useFilteredList } from "./actions/use-filtered-list";
import { KeyCombo } from "./key-combo";

export interface ScopeOption {
  id: string;
  label: string;
}

const EVERYTHING_ID = "everything";

// Field, divider and padding around `count` options, plus a little air, so
// the view can make room for the popover below the input row.
export const scopePopoverHeight = (count: number) => 70 + count * 32;

const labelOf = (option: ScopeOption) => option.label;
const optionDomId = (listId: string, id: string) => `${listId}-${id}`;

interface ScopeOptionRowProps {
  option: ScopeOption;
  domId: string;
  chosen: boolean;
  highlighted: boolean;
  onHighlight: (id: string) => void;
  onPick: (option: ScopeOption) => void;
}

const keepFocus = (event: MouseEvent<HTMLDivElement>) => event.preventDefault();

function ScopeOptionRow({
  option,
  domId,
  chosen,
  highlighted,
  onHighlight,
  onPick,
}: ScopeOptionRowProps) {
  const handleClick = useCallback(() => onPick(option), [onPick, option]);
  const handlePointerMove = useCallback(
    () => onHighlight(option.id),
    [onHighlight, option.id]
  );
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- keys go to the filter field, which points here with aria-activedescendant
    <div
      aria-selected={chosen}
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-[8px] px-2.5 type-body text-foreground",
        highlighted && "bg-row-active"
      )}
      id={domId}
      onClick={handleClick}
      onMouseDown={keepFocus}
      onPointerMove={handlePointerMove}
      role="option"
    >
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {chosen ? (
        <CheckIcon aria-hidden className="size-3.5 text-panel-muted" />
      ) : null}
    </div>
  );
}

interface ScopePopoverProps {
  options: readonly ScopeOption[];
  value: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}

function ScopePopover({ options, value, onPick, onClose }: ScopePopoverProps) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const listId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const handlePick = useCallback(
    (option: ScopeOption) =>
      onPick(option.id === EVERYTHING_ID ? null : option.id),
    [onPick]
  );
  const list = useFilteredList({
    items: options,
    labelOf,
    onClose,
    onPick: handlePick,
  });
  const { setQuery, select: handleHighlight } = list;

  // Hands focus back to whatever opened the popover once it has left, unless
  // the user already moved focus somewhere else.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const field = fieldRef.current;
    field?.focus();
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || active === field) {
        opener?.focus();
      }
    };
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [setQuery]
  );
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        onClose();
      }
    },
    [onClose]
  );
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  const current = value ?? EVERYTHING_ID;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-9 right-0 z-40 w-60 origin-top-right rounded-[12px] popover-material p-1.5 outline-none"
      data-motion={reduced ? "fade" : "pop"}
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      onBlur={handleBlur}
      onKeyDown={list.handleKeyDown}
      tabIndex={-1}
      transition={{ ...snappy, opacity: fadeIn }}
    >
      <input
        aria-activedescendant={
          list.selected ? optionDomId(listId, list.selected.id) : undefined
        }
        aria-controls={listId}
        aria-label="Filter connections"
        autoComplete="off"
        className="mb-1 h-8 w-full rounded-[8px] bg-transparent px-2.5 type-body text-foreground outline-none placeholder:text-panel-muted focus-visible:ring-1 focus-visible:ring-primary/50"
        onChange={handleChange}
        placeholder="Filter connections…"
        ref={fieldRef}
        spellCheck={false}
        type="text"
        value={list.query}
      />
      <div
        aria-label="Connections"
        className="border-t border-panel-border pt-1"
        id={listId}
        role="listbox"
      >
        {list.visible.length === 0 ? (
          <p className="flex h-8 items-center px-2.5 type-body text-panel-muted">
            No matching connections
          </p>
        ) : null}
        {list.visible.map((option, index) => (
          <Fragment key={option.id}>
            {index === 1 && list.visible[0]?.id === EVERYTHING_ID ? (
              <div
                className="mx-2.5 my-1 h-px bg-panel-border"
                role="separator"
              />
            ) : null}
            <ScopeOptionRow
              chosen={option.id === current}
              domId={optionDomId(listId, option.id)}
              highlighted={option.id === list.selected?.id}
              onHighlight={handleHighlight}
              onPick={handlePick}
              option={option}
            />
          </Fragment>
        ))}
      </div>
    </motion.div>
  );
}

interface ScopeFilterProps {
  label: string;
  options: readonly ScopeOption[];
  value: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (id: string | null) => void;
}

// A trigger at the end of the input row and a searchable popover under it;
// the first option (everything) clears the scope.
export function ScopeFilter({
  label,
  options,
  value,
  open,
  onOpenChange,
  onChange,
}: ScopeFilterProps) {
  const everything = { id: EVERYTHING_ID, label };
  const choices = [everything, ...options];
  const shown = options.find((option) => option.id === value)?.label ?? label;
  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open]);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const pick = useCallback(
    (id: string | null) => {
      onChange(id);
      onOpenChange(false);
    },
    [onChange, onOpenChange]
  );

  return (
    <div className="relative shrink-0">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Scope: ${shown}`}
        className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        onClick={toggle}
        type="button"
      >
        <SwapText className="max-w-36 truncate" value={shown} />
        <ChevronDownIcon aria-hidden className="size-3.5" />
        <KeyCombo className="ml-0.5" keys={["⌘", "P"]} />
      </button>
      <AnimatePresence>
        {open ? (
          <ScopePopover
            onClose={close}
            onPick={pick}
            options={choices}
            value={value}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
