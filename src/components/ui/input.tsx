"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { AlertCircle, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const FIELD_BASE = [
  "w-full rounded-[var(--kx-radius-sm)] border bg-surface px-4 text-[0.9375rem] text-ink",
  "placeholder:text-ink-muted",
  "transition-[border-color,box-shadow,background-color] duration-[165ms]",
  "focus:outline-none focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

function fieldState(hasError: boolean) {
  return hasError
    ? "border-danger-500/60 focus:border-danger-500 focus:ring-4 focus:ring-danger-500/12"
    : "border-line-strong focus:border-gold-500 focus:ring-4 focus:ring-gold-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12";
}

export interface FieldWrapperProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-[0.8125rem] font-medium text-ink-secondary"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-500" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {error ? (
        <p className="flex items-start gap-1.5 text-[0.8125rem] text-danger-600 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  icon?: LucideIcon;
  suffix?: ReactNode;
  inputSize?: "md" | "lg";
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    icon: Icon,
    suffix,
    inputSize = "md",
    className,
    wrapperClassName,
    id,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error || hint ? `${inputId}-description` : undefined;

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 size-[1.05rem] -translate-y-1/2 text-ink-muted"
            strokeWidth={1.8}
            aria-hidden
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            FIELD_BASE,
            fieldState(Boolean(error)),
            inputSize === "lg" ? "h-13" : "h-11",
            Icon && "pl-10.5",
            suffix && "pr-11",
            className,
          )}
          {...props}
        />
        {suffix ? (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">{suffix}</div>
        ) : null}
      </div>
    </FieldWrapper>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput({ ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        suffix={
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="kx-tap inline-flex size-8 items-center justify-center rounded-[var(--kx-radius-xs)] text-ink-muted transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] hover:text-ink"
          >
            {visible ? (
              <EyeOff className="size-4" strokeWidth={1.8} aria-hidden />
            ) : (
              <Eye className="size-4" strokeWidth={1.8} aria-hidden />
            )}
          </button>
        }
        {...props}
      />
    );
  },
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, className, wrapperClassName, id, required, ...props },
    ref,
  ) {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <FieldWrapper
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={textareaId}
        className={wrapperClassName}
      >
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(
            FIELD_BASE,
            fieldState(Boolean(error)),
            "min-h-24 resize-y py-3 leading-relaxed",
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);

export interface SelectProps
  extends InputHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    options,
    placeholder,
    className,
    wrapperClassName,
    id,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(
            FIELD_BASE,
            fieldState(Boolean(error)),
            "h-11 cursor-pointer appearance-none pr-10",
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </FieldWrapper>
  );
});

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, error, className, id, ...props }, ref) {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-3 text-[0.875rem] text-ink-secondary"
        >
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            className={cn(
              "kx-tap mt-0.5 size-4.5 shrink-0 cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-surface",
              "transition-[background-color,border-color] duration-[165ms]",
              "checked:border-gold-500 checked:bg-gold-500",
              "dark:checked:border-gold-500 dark:checked:bg-gold-500",
              "bg-[length:14px_14px] bg-center bg-no-repeat",
              "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22><path d=%22M3.5 8.5 6.5 11.5 12.5 5%22 stroke=%22%23071513%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')]",
              "dark:checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22><path d=%22M3.5 8.5 6.5 11.5 12.5 5%22 stroke=%22%23111513%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')]",
              className,
            )}
            {...props}
          />
          <span className="leading-snug">{label}</span>
        </label>
        {error ? (
          <p className="flex items-start gap-1.5 pl-7.5 text-[0.8125rem] text-danger-600 dark:text-red-300">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
