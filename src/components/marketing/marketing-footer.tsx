import Link from "next/link";
import { FOOTER_LINKS } from "@/constants/navigation";
import { KoinoniaMark } from "@/components/ui/route-loader";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-canvas-subtle px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          <div>
            <Link href="/" className="kx-tap inline-flex items-center gap-2.5">
              <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
              <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
                Koinonia
                <span className="ml-1.5 font-normal text-ink-muted">VTN</span>
              </span>
            </Link>

            <p className="type-meta mt-4 max-w-xs text-ink-secondary">
              A members-only verified transportation network connecting the
              Koinonia community to and from ministry events.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_LINKS.map((group) => (
              <div key={group.heading}>
                <p className="type-micro text-ink-muted">{group.heading}</p>
                <ul className="mt-3.5 space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="type-meta text-ink-secondary transition-colors hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-meta text-ink-muted">
            © {new Date().getFullYear()} Koinonia Verified Transportation Network
          </p>
          <p className="type-meta max-w-xl text-ink-muted sm:text-right">
            Verification reduces risk; it does not guarantee a safe journey. The
            network does not provide insurance for rides.
          </p>
        </div>
      </div>
    </footer>
  );
}
