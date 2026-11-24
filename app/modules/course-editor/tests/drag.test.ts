import { describe, it, expect } from "vitest";
import { courseEditorDrag } from "../index";

const modules = [
  { id: 10, lessons: [{ id: 1 }, { id: 2 }, { id: 3 }] },
  { id: 20, lessons: [{ id: 4 }] },
  { id: 30, lessons: [] },
];

describe("courseEditorDrag", () => {
  it("does nothing when dropped outside a list", () => {
    expect(
      courseEditorDrag(
        { type: "module", source: { droppableId: "modules", index: 0 } },
        modules
      )
    ).toBeNull();
    expect(
      courseEditorDrag(
        {
          type: "module",
          source: { droppableId: "modules", index: 0 },
          destination: null,
        },
        modules
      )
    ).toBeNull();
  });

  it("does nothing when dropped where it started", () => {
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-10", index: 1 },
          destination: { droppableId: "lessons-10", index: 1 },
        },
        modules
      )
    ).toBeNull();
  });

  it("reorders modules", () => {
    expect(
      courseEditorDrag(
        {
          type: "module",
          source: { droppableId: "modules", index: 0 },
          destination: { droppableId: "modules", index: 2 },
        },
        modules
      )
    ).toEqual({
      fetcher: "modules",
      fields: { intent: "reorder-modules", moduleIds: "[20,30,10]" },
    });
  });

  it("reorders lessons inside a module", () => {
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-10", index: 2 },
          destination: { droppableId: "lessons-10", index: 0 },
        },
        modules
      )
    ).toEqual({
      fetcher: "lessons",
      fields: {
        intent: "reorder-lessons",
        moduleId: "10",
        lessonIds: "[3,1,2]",
      },
    });
  });

  it("moves a lesson to another module at a 1-based position", () => {
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-10", index: 1 },
          destination: { droppableId: "lessons-20", index: 0 },
        },
        modules
      )
    ).toEqual({
      fetcher: "lessons",
      fields: {
        intent: "move-lesson",
        lessonId: "2",
        targetModuleId: "20",
        targetPosition: "1",
      },
    });
  });

  it("ignores a lesson from an unknown module or slot", () => {
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-99", index: 0 },
          destination: { droppableId: "lessons-20", index: 0 },
        },
        modules
      )
    ).toBeNull();
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-20", index: 5 },
          destination: { droppableId: "lessons-10", index: 0 },
        },
        modules
      )
    ).toBeNull();
  });

  it("ignores an unknown drag type", () => {
    expect(
      courseEditorDrag(
        {
          type: "other",
          source: { droppableId: "lessons-10", index: 2 },
          destination: { droppableId: "lessons-10", index: 0 },
        },
        modules
      )
    ).toBeNull();
  });

  it("moves a lesson to the same index of another module", () => {
    expect(
      courseEditorDrag(
        {
          type: "lesson",
          source: { droppableId: "lessons-10", index: 0 },
          destination: { droppableId: "lessons-20", index: 0 },
        },
        modules
      )
    ).toMatchObject({
      fetcher: "lessons",
      fields: { intent: "move-lesson", lessonId: "1", targetPosition: "1" },
    });
  });
});
