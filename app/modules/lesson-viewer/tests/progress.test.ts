import { describe, it, expect, vi } from "vitest";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { LessonProgressStatus } from "~/db/schema";

// lesson-viewer reads the app's shared `db` rather than taking one, so the
// tests swap that import for an in-memory database.
const { testDb } = await vi.hoisted(async () => {
  const { createTestDb } = await import("~/test/setup");
  return { testDb: createTestDb() };
});
vi.mock("~/db", () => ({ db: testDb }));

const { seedBaseData } = await import("~/test/setup");
const {
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
  getLastWatchPosition,
  calculateWatchProgress,
} = await import("../progress.server");

// ─── Fixtures ───
// The module has no function that writes lessons or watch events, so rows go
// in directly. Kept in one place so a schema change touches only this block.

const { course, user, instructor, category } = seedBaseData(testDb);

const courseModule = testDb
  .insert(schema.modules)
  .values({ courseId: course.id, title: "Module", position: 1 })
  .returning()
  .get();

function addLesson(moduleId: number, position: number) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId, title: `Lesson ${position}`, position })
    .returning()
    .get();
}

function addCourse(slug: string) {
  return testDb
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: slug,
      salesCopy: markdown(""),
      instructorId: instructor.id,
      categoryId: category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

function watch(event: {
  userId: number;
  lessonId: number;
  positionSeconds: number;
  createdAt: string;
}) {
  testDb
    .insert(schema.videoWatchEvents)
    .values({ ...event, eventType: "progress" })
    .run();
}

describe("markLessonInProgress and markLessonComplete", () => {
  const lesson = addLesson(courseModule.id, 1);

  it("starts with no progress", () => {
    expect(getLessonProgress(user.id, lesson.id)).toBeUndefined();
  });

  it("records a lesson as in progress", () => {
    const row = markLessonInProgress(user.id, lesson.id);
    expect(row.status).toBe(LessonProgressStatus.InProgress);
    expect(row.completedAt).toBeNull();
    expect(getLessonProgress(user.id, lesson.id)).toEqual(row);
  });

  it("completes the existing row rather than adding a second", () => {
    const started = getLessonProgress(user.id, lesson.id);
    const row = markLessonComplete(user.id, lesson.id);
    expect(row.id).toBe(started?.id);
    expect(row.status).toBe(LessonProgressStatus.Completed);
    expect(row.completedAt).not.toBeNull();
  });

  it("does not move a completed lesson back to in progress", () => {
    const row = markLessonInProgress(user.id, lesson.id);
    expect(row.status).toBe(LessonProgressStatus.Completed);
    expect(getLessonProgress(user.id, lesson.id)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("completes a lesson with no earlier progress", () => {
    const fresh = addLesson(courseModule.id, 2);
    const row = markLessonComplete(user.id, fresh.id);
    expect(row.status).toBe(LessonProgressStatus.Completed);
    expect(row.completedAt).not.toBeNull();
    expect(getLessonProgress(user.id, fresh.id)).toEqual(row);
  });

  it("keeps each learner's progress separate", () => {
    expect(getLessonProgress(instructor.id, lesson.id)).toBeUndefined();
  });
});

describe("getLessonProgressForCourse", () => {
  it("returns only this learner's progress on this course", () => {
    const other = addCourse("other");
    const otherModule = testDb
      .insert(schema.modules)
      .values({ courseId: other.id, title: "M", position: 1 })
      .returning()
      .get();
    const mine = addLesson(otherModule.id, 1);
    const elsewhere = addLesson(courseModule.id, 3);
    markLessonComplete(user.id, mine.id);
    markLessonComplete(user.id, elsewhere.id);
    markLessonComplete(instructor.id, mine.id);

    expect(
      getLessonProgressForCourse(user.id, other.id).map((p) => p.lessonId)
    ).toEqual([mine.id]);
  });

  it("returns nothing for a course with no modules", () => {
    expect(getLessonProgressForCourse(user.id, addCourse("bare").id)).toEqual(
      []
    );
  });

  it("returns nothing for a course whose modules have no lessons", () => {
    const hollow = addCourse("hollow");
    testDb
      .insert(schema.modules)
      .values({ courseId: hollow.id, title: "M", position: 1 })
      .run();
    expect(getLessonProgressForCourse(user.id, hollow.id)).toEqual([]);
  });
});

describe("watch position", () => {
  const lesson = addLesson(courseModule.id, 10);
  watch({
    userId: user.id,
    lessonId: lesson.id,
    positionSeconds: 30,
    createdAt: "2026-01-01T00:00:01Z",
  });
  watch({
    userId: user.id,
    lessonId: lesson.id,
    positionSeconds: 90,
    createdAt: "2026-01-01T00:00:02Z",
  });
  watch({
    userId: user.id,
    lessonId: lesson.id,
    positionSeconds: 45,
    createdAt: "2026-01-01T00:00:03Z",
  });
  watch({
    userId: instructor.id,
    lessonId: lesson.id,
    positionSeconds: 200,
    createdAt: "2026-01-01T00:00:04Z",
  });

  it("resumes from the learner's latest event, not their furthest", () => {
    expect(getLastWatchPosition(user.id, lesson.id)).toBe(45);
  });

  it("starts at zero when the learner has not watched", () => {
    expect(getLastWatchPosition(user.id, 9999)).toBe(0);
  });

  it("measures progress from the furthest position reached", () => {
    expect(calculateWatchProgress(user.id, lesson.id, 300)).toBe(30);
  });

  it("rounds to a whole percentage", () => {
    expect(calculateWatchProgress(user.id, lesson.id, 270)).toBe(33);
  });

  it("caps progress at 100", () => {
    expect(calculateWatchProgress(user.id, lesson.id, 60)).toBe(100);
  });

  it("returns 0 for a video with no duration", () => {
    expect(calculateWatchProgress(user.id, lesson.id, 0)).toBe(0);
    expect(calculateWatchProgress(user.id, lesson.id, -5)).toBe(0);
  });

  it("returns 0 when the learner has not watched", () => {
    expect(calculateWatchProgress(user.id, 9999, 100)).toBe(0);
  });
});
