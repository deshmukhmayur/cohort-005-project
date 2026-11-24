import { describe, it, expect } from "vitest";
import * as schema from "~/db/schema";
import { setupEditor } from "./fixtures";

describe("courseEditor.view roster", () => {
  it("reports each student's own progress and scores", () => {
    const { db, editor, base, addModule, addLesson, addStudent } =
      setupEditor();
    const mod = addModule("M", 1);
    const l1 = addLesson(mod.id, "One", 1);
    const l2 = addLesson(mod.id, "Two", 2);
    const quiz = db
      .insert(schema.quizzes)
      .values({ lessonId: l2.id, title: "Quiz", passingScore: 0.5 })
      .returning()
      .get();
    const idle = addStudent("idle@example.com");
    const active = addStudent("active@example.com");
    db.insert(schema.lessonProgress)
      .values({
        userId: active.id,
        lessonId: l1.id,
        status: schema.LessonProgressStatus.Completed,
      })
      .run();
    db.insert(schema.quizAttempts)
      .values({ userId: active.id, quizId: quiz.id, score: 0.3, passed: false })
      .run();

    const roster = editor.view(base.course.id).students;

    expect(roster.map((row) => [row.userId, row.progress])).toEqual([
      [idle.id, 0],
      [active.id, 50],
    ]);
    expect(roster.map((row) => row.quizScores[0].bestScore)).toEqual([
      null,
      0.3,
    ]);
    expect(roster[1].quizScores[0].passed).toBe(false);
  });

  it("uses the first quiz of a lesson that has several", () => {
    const { db, editor, base, addModule, addLesson, addStudent } =
      setupEditor();
    addStudent("s@example.com");
    const lesson = addLesson(addModule("M", 1).id, "One", 1);
    for (const title of ["First", "Second"]) {
      db.insert(schema.quizzes)
        .values({ lessonId: lesson.id, title, passingScore: 0.5 })
        .run();
    }

    const view = editor.view(base.course.id);

    expect(view.quizCount).toBe(1);
    expect(view.students[0].quizScores.map((quiz) => quiz.quizTitle)).toEqual([
      "First",
    ]);
  });
});
