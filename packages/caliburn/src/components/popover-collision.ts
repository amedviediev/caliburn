/** an axis' extent, in viewport coordinates */
export interface CollisionBounds {
  start: number;
  end: number;
}

/**
 * Radix's `collisionBoundary={container}` handling, for the `position: fixed`
 * divs that stand in for `Popover.Content` here: along the side axis the
 * content flips to the other side of its trigger when the preferred side
 * would overflow the boundary, and along the align axis it is shifted back
 * inside it.
 *
 * A boundary with no extent — jsdom, and the frame before the container has a
 * layout — collides with nothing, so both fall through unmeasured.
 */
export const flipAtBoundary = (
  preferred: number,
  opposite: number,
  size: number,
  bounds: CollisionBounds,
) =>
  bounds.end > bounds.start &&
  preferred + size > bounds.end &&
  opposite >= bounds.start
    ? opposite
    : preferred;

export const shiftIntoBoundary = (
  position: number,
  size: number,
  bounds: CollisionBounds,
) =>
  bounds.end > bounds.start && size > 0
    ? Math.max(bounds.start, Math.min(position, bounds.end - size))
    : position;
