"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-black/30 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[6px] font-mono tracking-[0.1em] uppercase transition-colors duration-150",
              size === "sm" ? "px-2 py-[3px] text-[9.5px]" : "px-2.5 py-1 text-[10px]",
              active
                ? "bg-cyan/12 text-cyan shadow-[inset_0_0_0_1px_rgba(79,227,255,0.28)]"
                : "text-faint hover:text-muted"
            )}
          >
            {option.label}
          </button>
        );
      })}
      <span id={id} className="sr-only">
        {ariaLabel}
      </span>
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  activeClassName?: string;
}

export function ToggleButton({
  active,
  onClick,
  children,
  className,
  title,
  activeClassName = "text-cyan bg-cyan/12 shadow-[inset_0_0_0_1px_rgba(79,227,255,0.28)]",
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded-[6px] px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase transition-colors duration-150",
        active ? activeClassName : "text-faint hover:bg-white/5 hover:text-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

interface IconButtonProps {
  onClick: () => void;
  children: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  variant?: "ghost" | "solid";
}

export function IconButton({
  onClick,
  children,
  label,
  className,
  disabled,
  variant = "ghost",
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35",
        variant === "solid"
          ? "border-cyan/30 bg-cyan/10 text-cyan hover:bg-cyan/18"
          : "border-white/[0.07] bg-white/[0.02] text-muted hover:border-white/15 hover:text-txt",
        className
      )}
    >
      {children}
    </button>
  );
}
