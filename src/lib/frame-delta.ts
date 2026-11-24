/**
 * Longest step an animation may advance in a single frame (seconds).
 *
 * A long frame (React commit, GPU stall, tab resume) otherwise makes delta-driven
 * animations jump ahead. Capping the step keeps motion continuous: a slow frame
 * briefly slows the animation instead of skipping part of it.
 */
export const MAX_FRAME_DELTA = 1 / 30;

export function clampFrameDelta(delta: number): number {
  return Math.min(delta, MAX_FRAME_DELTA);
}
