"use client";

import { forwardRef, useState } from "react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Input, Select } from "./input";
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
    <div className="min-w-0 space-y-2">
      <Select label={`${label} country code`} value={country} options={PHONE_COUNTRIES} disabled={disabled}
        autoComplete="tel-country-code" onBlur={onBlur}
        onChange={(event) => {
          const selected = event.target.value as CountryCode;
          // Keep the national portion when changing the selected country.
          const parsed = parsePhoneNumberFromString(input, country);
          const national = parsed?.nationalNumber ?? input;
          setCountry(selected);
          setInput(national);
          onChange(phoneInputValue(national, selected));
        }} />
      <Input ref={ref} label={label} name={name} type="tel" autoComplete="tel-national"
        placeholder="Phone number" value={input} required={required} disabled={disabled}
        error={error} onBlur={onBlur} onChange={(event) => updatePhone(event.target.value, country)} />
    </div>
  );
});
