// True when the selection overlaps or touches the boundary of [from, to),
// meaning a decoration over that range should be suppressed so the user can
// see and edit the raw source text.
export function rangeTouchesSelection(
  selectionFrom: number,
  selectionTo: number,
  from: number,
  to: number,
): boolean {
  return selectionFrom <= to && selectionTo >= from
}
