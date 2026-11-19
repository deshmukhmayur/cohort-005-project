import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteDraft", () => {
  it("cannot save an empty box when there is no note yet", () => {
    expect(noteDraft("", null)).toEqual({
      length: 0,
      limit: MAX_NOTE_LENGTH,
      tooLong: false,
      unsaved: false,
      canSave: false,
    });
  });

  it("cannot save whitespace only", () => {
    const draft = noteDraft("   \n ", null);
    expect(draft.length).toBe(0);
    expect(draft.canSave).toBe(false);
  });

  it("can save new text", () => {
    const draft = noteDraft("Result types beat throwing", null);
    expect(draft).toMatchObject({ length: 26, unsaved: true, canSave: true });
  });

  it("has nothing to save when the box matches the saved note", () => {
    const draft = noteDraft("Remember never", "Remember never");
    expect(draft).toMatchObject({ unsaved: false, canSave: false });
  });

  it("ignores surrounding whitespace, as the server trims it", () => {
    const draft = noteDraft("  Remember never \n", "Remember never");
    expect(draft).toMatchObject({ length: 14, unsaved: false });
  });

  it("can save an edit to a saved note", () => {
    const draft = noteDraft("Remember never again", "Remember never");
    expect(draft).toMatchObject({ unsaved: true, canSave: true });
  });

  it("cannot save a cleared box over a saved note", () => {
    const draft = noteDraft("  ", "Remember never");
    expect(draft).toMatchObject({ unsaved: true, canSave: false });
  });

  it("allows a note exactly at the limit", () => {
    const draft = noteDraft("abcde", null, 5);
    expect(draft).toMatchObject({ limit: 5, tooLong: false, canSave: true });
  });

  it("refuses a note one over the limit", () => {
    const draft = noteDraft("abcdef", null, 5);
    expect(draft).toMatchObject({ tooLong: true, canSave: false });
  });

  it("defaults the limit to the note length limit", () => {
    const atLimit = "a".repeat(MAX_NOTE_LENGTH);
    expect(noteDraft(atLimit, null).tooLong).toBe(false);
    expect(noteDraft(`${atLimit}a`, null).tooLong).toBe(true);
  });
});
