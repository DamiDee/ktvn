/** A non-exhaustive local starter list, not a claim of complete provider coverage. */
export const ABUJA_AREAS = [
  "Abaji", "Abuja", "Asokoro", "Bwari", "Central Area", "Dakibiyu", "Dei-Dei",
  "Durumi", "Dutse Alhaji", "Gaduwa", "Galadimawa", "Garki", "Garki II", "Gudu",
  "Guzape", "Gwagwalada", "Gwarinpa", "Jabi", "Jahi", "Jikwoyi", "Kado", "Karshi",
  "Karu", "Katampe", "Kaura", "Kubwa", "Kuje", "Kwali", "Life Camp", "Lokogoma",
  "Lugbe", "Mabushi", "Maitama", "Mpape", "Nyanya", "Orozo", "Rubochi", "Utako",
  "Wuse", "Wuse II", "Wuye",
] as const;

export interface CityCatalog {
  cities: string[];
  source: "local" | "geonames";
  /** Whether every page of the provider query was read, not geographic completeness. */
  providerComplete: boolean;
}

export const localCityCatalog = (): CityCatalog => ({ cities: [...ABUJA_AREAS], source: "local", providerComplete: false });
export function normalizeCityNames(names: unknown[]): string[] {
  const unique = new Map<string, string>();
  for (const item of names) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 100 || /[<>\u0000-\u001f]/.test(name)) continue;
    const key = name.normalize("NFKC").toLocaleLowerCase("en");
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "en"));
}

/** Shared cache/coalescing avoids an upstream lookup for every new registration. */
export function createAbujaCityLoader(username: string, request: (url: URL) => Promise<Response>, now = Date.now) {
  let cached: CityCatalog | null = null;
  let expires = 0;
  let pending: Promise<CityCatalog> | null = null;
  async function load(): Promise<CityCatalog> {
    if (!username.trim()) return localCityCatalog();
    const names: string[] = [];
    let offset = 0, total = Infinity;
    try {
      // GeoNames free search allows startRow up to 5000. Never loop without a bound.
      for (let page = 0; page < 6 && offset < total && offset <= 5000; page++) {
        const url = new URL("https://secure.geonames.org/searchJSON");
        url.search = new URLSearchParams({ username, q: "Nigeria", country: "NG", adminCode1: "11", featureClass: "P", style: "FULL", lang: "en", maxRows: "1000", startRow: String(offset) }).toString();
        const response = await request(url);
        if (!response.ok) throw new Error("Location service unavailable");
        const data = await response.json();
        if (data?.status || !Array.isArray(data?.geonames) || !Number.isFinite(data.totalResultsCount) || data.totalResultsCount < 0) throw new Error("Invalid location response");
        total = data.totalResultsCount;
        if (!data.geonames.length) break;
        for (const place of data.geonames) {
          if (place?.countryCode === "NG" && String(place.adminCode1) === "11" && place.fcl === "P" && typeof place.name === "string") names.push(place.name);
        }
        offset += data.geonames.length;
      }
      if (!names.length) throw new Error("No matching places");
      return { cities: normalizeCityNames([...ABUJA_AREAS, ...names]), source: "geonames", providerComplete: offset >= total };
    } catch {
      // Never discard a previously successful catalogue after a temporary outage.
      if (cached?.source === "geonames") return { ...cached, providerComplete: false };
      return names.length ? { cities: normalizeCityNames([...ABUJA_AREAS, ...names]), source: "geonames", providerComplete: false } : localCityCatalog();
    }
  }
  return async () => {
    if (cached && now() < expires) return cached;
    if (!pending) pending = load().then((catalog) => {
      cached = catalog;
      expires = now() + (catalog.providerComplete ? 86_400_000 : 300_000);
      return catalog;
    }).finally(() => { pending = null; });
    return pending;
  };
}
