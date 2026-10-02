/** Completion is local until the backend adds an authenticated tracking endpoint. */
export const GUIDE_VERSION = 2;
export const GUIDE_STEPS = 5;
export interface GuideProgress { version: number; step: number; completed_at: string | null }
export const guideKey = (userId: string) => `kr-member-guide:v${GUIDE_VERSION}:${userId}`;
export function parseGuideProgress(raw: string | null): GuideProgress {
  const empty = { version: GUIDE_VERSION, step: 0, completed_at: null };
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.version !== GUIDE_VERSION || !Number.isInteger(value.step) || value.step < 0 || value.step >= GUIDE_STEPS) return empty;
    const completed_at = value.step === GUIDE_STEPS - 1 && typeof value.completed_at === "string" && Number.isFinite(Date.parse(value.completed_at)) ? value.completed_at : null;
    return { version: GUIDE_VERSION, step: value.step, completed_at };
  } catch { return empty; }
}
