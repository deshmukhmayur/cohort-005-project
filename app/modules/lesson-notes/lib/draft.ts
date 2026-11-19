export type NoteDraft = {
  length: number;
  limit: number;
  tooLong: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null,
  limit: number
): NoteDraft {
  // The server trims before it stores, so compare the trimmed draft: trailing
  // whitespace alone is not an unsaved change.
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > limit;
  const unsaved = trimmed !== (savedBody ?? "");
  return {
    length,
    limit,
    tooLong,
    unsaved,
    canSave: unsaved && length > 0 && !tooLong,
  };
}
