"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { localCityCatalog, type CityCatalog } from "@/lib/abuja-cities";

export function CityPicker({ value, onChange, onBlur, error, inputRef, disabled = false, name = "city" }: { value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; inputRef?: Ref<HTMLInputElement>; disabled?: boolean; name?: string }) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const catalog = useQuery<CityCatalog>({
    queryKey: ["abuja-cities"], staleTime: 3_600_000, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/locations/abuja", { signal });
      if (!response.ok) throw new Error("City list unavailable");
      const data = await response.json();
      if (!Array.isArray(data?.cities) || !data.cities.every((v: unknown) => typeof v === "string")) throw new Error("City list unavailable");
      return data;
    },
  });
  const data = catalog.data ?? localCityCatalog();
  const needle = query.trim().toLocaleLowerCase();
  const filtered = data.cities.filter((city) => city.toLocaleLowerCase().includes(needle));
  const options = filtered.slice(0, 40).map((city) => ({ value: city, custom: false }));
  if (query.trim().length >= 2 && !data.cities.some((city) => city.toLocaleLowerCase() === needle)) options.push({ value: query.trim(), custom: true });
  const selected = active >= 0 && active < options.length ? active : -1;
  function choose(city: string) { onChange(city); setQuery(city); setOpen(false); setActive(-1); }
  useEffect(() => { if (open && selected >= 0) list.current?.children[selected]?.scrollIntoView({ block: "nearest" }); }, [selected, open]);

  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[.8125rem] font-medium text-ink-secondary">City / area <span className="text-danger-500" aria-hidden>*</span><span className="ml-2 text-xs font-normal text-ink-muted">Abuja · FCT</span></label>
    <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); onBlur?.(); } }}>
      <MapPin className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-ink-muted" aria-hidden />
      <input id={id} ref={inputRef} value={query} disabled={disabled} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && selected >= 0 ? `${id}-option-${selected}` : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)} aria-required="true" autoComplete="off" placeholder="Search Lugbe, Kubwa, Wuse…" maxLength={100}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true); setActive(-1); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive((v) => Math.max(0, Math.min(options.length - 1, e.key === "ArrowDown" ? v + 1 : v - 1))); }
          if (e.key === "Enter" && open) { e.preventDefault(); if (selected >= 0) choose(options[selected].value); else { const exact = options.find((o) => o.value.toLowerCase() === needle); if (exact) choose(exact.value); } }
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
        }}
        className={cn("h-11 w-full rounded-[var(--kx-radius-sm)] border bg-surface pl-10 pr-10 text-[.9375rem] text-ink placeholder:text-ink-muted focus:border-gold-500 focus:outline-none focus:ring-4 focus:ring-gold-500/10 disabled:opacity-50", error ? "border-danger-500" : "border-line-strong")} />
      <input type="hidden" name={name} value={value} />
      <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-ink-muted" aria-hidden />
      {open ? <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-lg">
        <ul id={`${id}-list`} ref={list} role="listbox" aria-label="Cities and areas in Abuja" className="max-h-60 overflow-y-auto overscroll-contain p-1.5">
          {options.map((option, index) => <li id={`${id}-option-${index}`} key={`${option.custom}-${option.value}`} role="option" aria-selected={value === option.value} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(option.value)} className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-gold-500/10", index === selected && "bg-gold-500/10")}><span className="break-words">{option.custom ? `Use “${option.value}” — not listed` : option.value}</span>{value === option.value ? <Check className="size-4 shrink-0 text-gold-800 dark:text-gold-300" aria-hidden /> : null}</li>)}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[.7rem] text-ink-muted">{filtered.length > 40 ? "Keep typing to narrow the list. " : ""}Missing area? Type its full name to add it.</p>
      </div> : null}
    </div>
    <p id={`${id}-hint`} className="text-[.75rem] text-ink-muted">{data.source === "geonames" ? <>Local areas + <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline underline-offset-2">GeoNames</a>{!data.providerComplete ? " · list may be incomplete" : ""}. Choose where you live.</> : "Common Abuja areas. Search or enter an unlisted area."}</p>
    {error ? <p id={`${id}-error`} role="alert" className="text-[.8125rem] text-danger-600">{error}</p> : null}
  </div>;
}
