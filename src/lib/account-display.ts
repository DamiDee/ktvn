/** Presentation only: preserve the spelling and stored account records. */
export function displayName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase().replace(/(^|[\s\-'’])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

export function displayPhone(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const original = value.trim();
  const compact = original.replace(/[\s().-]/g, "");
  // Normalize Nigerian mobile numbers; don't guess or truncate other numbers.
  const match = /^(?:\+234|00234|234|0)?([789]\d{9})$/.exec(compact);
  if (!match) return original;
  const digits = match[1];
  return `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
