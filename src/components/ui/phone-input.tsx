"use client";

import { forwardRef, useId, useState } from "react";
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { ChevronDown } from "lucide-react";
import { FieldWrapper } from "./input";
import { cn } from "@/lib/cn";
import { phoneInputValue, PHONE_COUNTRIES } from "@/lib/phone";

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  name?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput({
  value, onChange, onBlur, label = "Phone", name, error, required, disabled,
}, ref) {
  const inputId = useId();
  const [country, setCountry] = useState<CountryCode>(() => parsePhoneNumberFromString(value, "NG")?.country ?? "NG");
  const [input, setInput] = useState(() => {
    const parsed = parsePhoneNumberFromString(value, country);
    return parsed?.isPossible() ? parsed.formatNational() : value;
  });

  function updatePhone(next: string, selected: CountryCode) {
    setInput(next);
    // A pasted international number carries its own country code.
    const international = next.trim().replace(/^00/, "+");
    const parsed = international.startsWith("+") ? parsePhoneNumberFromString(international) : undefined;
    if (parsed?.country) setCountry(parsed.country);
    if (parsed?.isPossible()) setInput(parsed.formatNational());
    onChange(phoneInputValue(next, selected));
  }

  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} required={required} className="min-w-0">
      <div className={cn(
        "flex h-11 items-center rounded-[var(--kx-radius-sm)] border bg-surface text-[0.9375rem] text-ink transition-[border-color,box-shadow] focus-within:ring-4",
        error ? "border-danger-500/60 focus-within:border-danger-500 focus-within:ring-danger-500/12" : "border-line-strong focus-within:border-gold-500 focus-within:ring-gold-500/10",
        disabled && "cursor-not-allowed opacity-50",
      )}>
        <div className="relative flex h-full shrink-0 items-center gap-1.5 rounded-l-[var(--kx-radius-sm)] px-3 focus-within:bg-gold-500/10">
          <span aria-hidden className="tabular-nums">+{getCountryCallingCode(country)}</span>
          <ChevronDown aria-hidden className="size-3.5 text-ink-muted" />
          <select
            aria-label={`${label} country code`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-description` : undefined}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            value={country} disabled={disabled} autoComplete="tel-country-code" onBlur={onBlur}
            onChange={(event) => {
              const selected = event.target.value as CountryCode;
              // Keep the national portion when changing the selected country.
              const parsed = parsePhoneNumberFromString(input, country);
              const national = parsed?.nationalNumber ?? input;
              setCountry(selected);
              setInput(national);
              onChange(phoneInputValue(national, selected));
            }}
          >
            {PHONE_COUNTRIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <span aria-hidden className="h-5 w-px shrink-0 bg-line-strong" />
        <input
          ref={ref} id={inputId} name={name} type="tel" autoComplete="tel-national"
          className="h-full min-w-0 flex-1 rounded-r-[var(--kx-radius-sm)] bg-transparent px-3 outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
          placeholder="Phone number" value={input} required={required} disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-description` : undefined}
          onBlur={onBlur} onChange={(event) => updatePhone(event.target.value, country)}
        />
      </div>
    </FieldWrapper>
  );
});
