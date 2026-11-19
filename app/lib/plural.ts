/** "1 lesson", "2 lessons"; pass `plural` for a noun that is not just + "s". */
export function countOf(
  count: number,
  singular: string,
  plural = `${singular}s`
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
