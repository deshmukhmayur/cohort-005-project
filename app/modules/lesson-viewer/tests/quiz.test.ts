import { describe, it, expect, vi } from "vitest";
import * as schema from "~/db/schema";

// lesson-viewer reads the app's shared `db` rather than taking one, so the
// tests swap that import for an in-memory database.
const { testDb } = await vi.hoisted(async () => {
  const { createTestDb } = await import("~/test/setup");
  return { testDb: createTestDb() };
});
vi.mock("~/db", () => ({ db: testDb }));

const { seedBaseData } = await import("~/test/setup");
const { getQuizForLesson } = await import("../quiz.server");

// ─── Fixtures ───
// The module has no function that writes lessons or quizzes, so rows go in
// directly. Kept in one place so a schema change touches only this block.

const { course } = seedBaseData(testDb);

const courseModule = testDb
  .insert(schema.modules)
  .values({ courseId: course.id, title: "Module", position: 1 })
  .returning()
  .get();

function addLessonWithQuiz(position: number) {
  const lesson = testDb
    .insert(schema.lessons)
    .values({
      moduleId: courseModule.id,
      title: `Lesson ${position}`,
      position,
    })
    .returning()
    .get();
  const quiz = testDb
    .insert(schema.quizzes)
    .values({ lessonId: lesson.id, title: "Quiz", passingScore: 0.7 })
    .returning()
    .get();
  return { lesson, quiz };
}

const first = addLessonWithQuiz(1);
const second = addLessonWithQuiz(2);

describe("getQuizForLesson", () => {
  it("returns the quiz when it belongs to the lesson", () => {
    expect(getQuizForLesson(first.quiz.id, first.lesson.id)).toEqual(
      first.quiz
    );
  });

  it("returns nothing for a quiz from another lesson", () => {
    expect(getQuizForLesson(second.quiz.id, first.lesson.id)).toBeUndefined();
  });

  it("returns nothing for a quiz that does not exist", () => {
    expect(getQuizForLesson(9999, first.lesson.id)).toBeUndefined();
  });
});
