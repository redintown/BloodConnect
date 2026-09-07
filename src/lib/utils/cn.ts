import clsx, { type ClassValue } from "clsx";

/** Small className combinator. Kept as a one-liner utility, not a dependency
 * on a heavier styling library, per the "minimal dependencies" rule. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
