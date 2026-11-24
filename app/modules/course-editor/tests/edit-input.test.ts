import { describe, it, expect } from "vitest";
import { form, resultOf, setupEditor } from "./fixtures";

describe("courseEditor.perform input", () => {
  it("rejects an ID list that is not JSON", async () => {
    const { editor, target } = setupEditor();
    const result = await editor.perform(
      target,
      form({ intent: "reorder-modules", moduleIds: "nope" })
    );
    expect(resultOf(result)).toEqual({
      body: { error: "IDs must be valid JSON." },
      status: 400,
    });
  });

  it("rejects an ID list that is not a list of numbers", async () => {
    const { editor, target } = setupEditor();
    const result = await editor.perform(
      target,
      form({ intent: "reorder-lessons", moduleId: "1", lessonIds: '"x"' })
    );
    expect(resultOf(result)).toEqual({
      body: { error: "IDs must be a list of numbers." },
      status: 400,
    });
  });

  it("stamps an edit with the injected clock", async () => {
    const moment = new Date("2030-01-02T03:04:05.000Z");
    const { editor, target, base } = setupEditor(() => moment);
    await editor.perform(target, form({ intent: "update-title", title: "T" }));
    expect(editor.view(base.course.id).course.updatedAt).toBe(
      moment.toISOString()
    );
  });

  it("changes only the field that was edited", async () => {
    const { editor, target, base } = setupEditor();
    const stale = { ...target, description: "stale copy" };
    await editor.perform(stale, form({ intent: "update-title", title: "T" }));
    const { course } = editor.view(base.course.id);
    expect([course.title, course.description]).toEqual([
      "T",
      base.course.description,
    ]);
  });
});
