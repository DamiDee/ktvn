"use client";

import { useCallback, useState, type RefCallback } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Measure an element with a ResizeObserver.
 *
 * Returns a ref callback rather than a ref object so measurement starts the
 * moment the node mounts, and state is only written from the observer
 * callback — never synchronously inside an effect.
 */
export function useElementSize(): [RefCallback<HTMLElement>, ElementSize] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  const ref = useCallback<RefCallback<HTMLElement>>((node) => {
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        // Sub-pixel churn would otherwise re-render on every scroll.
        Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      );
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
