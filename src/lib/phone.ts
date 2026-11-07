import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const PHONE_COUNTRIES = getCountries().map((country) => ({
  value: country,
  label: `${names.of(country) ?? country} (+${getCountryCallingCode(country)})`,
})).sort((a, b) => a.label.localeCompare(b.label, "en"));

/** Store one international number, including its calling code. */
export function normalizePhone(value: string, country: CountryCode = "NG"): string | undefined {
  const input = value.trim();
  if (!input || !/^\+?[\d\s().-]+$/.test(input)) return undefined;
  const parsed = parsePhoneNumberFromString(input.startsWith("00") ? `+${input.slice(2)}` : input, country);
  return parsed?.isPossible() && !parsed.ext ? parsed.number : undefined;
}

/** Keep incomplete input tied to the selected country so validation cannot guess another one. */
export function phoneInputValue(value: string, country: CountryCode): string {
  if (!value.trim()) return "";
  return normalizePhone(value, country) ?? (value.trim().startsWith("+") ? value.trim() : `+${getCountryCallingCode(country)}${value.trim()}`);
}
