import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the note editor should show for the text in the box, given the note
 * as last saved (`null` when the Student has none yet).
 */
export function noteDraft(
  draft: string,
  savedBody: string | null,
  limit: number = MAX_NOTE_LENGTH
): NoteDraft {
  return describeDraft(draft, savedBody, limit);
}
