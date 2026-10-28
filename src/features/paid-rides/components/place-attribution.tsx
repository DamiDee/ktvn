import { getMapProvider } from "../services";

/** Compact text attribution for space-constrained suggestion lists. */
export function PlaceAttribution() {
  const provider = getMapProvider();
  return <p className="px-3 py-2 text-xs text-[var(--text-secondary)]">{provider.name === "Google Maps" ? <span className="whitespace-nowrap font-normal not-italic tracking-normal text-[#5e5e5e] dark:text-white" lang="en" translate="no">Google Maps</span> : `Place data © ${provider.name} contributors`}</p>;
}
