import { describe, it, expect, vi } from "vitest";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";

// lesson-viewer reads the app's shared `db` rather than taking one, so the
// tests swap that import for an in-memory database.
const { testDb } = await vi.hoisted(async () => {
  const { createTestDb } = await import("~/test/setup");
  return { testDb: createTestDb() };
});
vi.mock("~/db", () => ({ db: testDb }));

const { seedBaseData } = await import("~/test/setup");
const {
  getCourseWithDetails,
  getLessonById,
  getModuleById,
  getUserById,
  getCourseForLesson,
  flattenCourseLessons,
} = await import("../course.server");

// ─── Fixtures ───
// The module has no function that writes modules or lessons, so rows go in
// directly. Kept in one place so a schema change touches only this block.

const { course, instructor, category } = seedBaseData(testDb);

function addModule(courseId: number, title: string, position: number) {
  return testDb
    .insert(schema.modules)
    .values({ courseId, title, position })
    .returning()
    .get();
}

function addLesson(moduleId: number, title: string, position: number) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get();
}

// Inserted out of order so the tests see the sort, not the insert order.
const secondModule = addModule(course.id, "Second", 2);
const firstModule = addModule(course.id, "First", 1);
const lessonB = addLesson(firstModule.id, "B", 2);
const lessonA = addLesson(firstModule.id, "A", 1);
const lessonC = addLesson(secondModule.id, "C", 1);

const emptyCourse = testDb
  .insert(schema.courses)
  .values({
    title: "Empty",
    slug: "empty",
    description: "No modules",
    salesCopy: markdown(""),
    instructorId: instructor.id,
    categoryId: category.id,
    status: schema.CourseStatus.Published,
  })
  .returning()
  .get();

describe("getCourseWithDetails", () => {
  it("returns the course with instructor and category names", () => {
    const details = getCourseWithDetails(course.id);
    expect(details).toMatchObject({
      id: course.id,
      title: course.title,
      instructorName: instructor.name,
      categoryName: category.name,
    });
  });

  it("nests each module's lessons, both ordered by position", () => {
    const details = getCourseWithDetails(course.id);
    expect(
      details?.modules.map((m) => ({
        title: m.title,
        lessons: m.lessons.map((l) => l.title),
      }))
    ).toEqual([
      { title: "First", lessons: ["A", "B"] },
      { title: "Second", lessons: ["C"] },
    ]);
  });

  it("returns a course with no modules as an empty list", () => {
    expect(getCourseWithDetails(emptyCourse.id)?.modules).toEqual([]);
  });

  it("returns null for a course that does not exist", () => {
    expect(getCourseWithDetails(9999)).toBeNull();
  });
});

describe("single-row lookups", () => {
  it("finds a lesson, a module and a user by id", () => {
    expect(getLessonById(lessonA.id)).toEqual(lessonA);
    expect(getModuleById(firstModule.id)).toEqual(firstModule);
    expect(getUserById(instructor.id)?.name).toBe(instructor.name);
  });

  it("returns nothing for ids that do not exist", () => {
    expect(getLessonById(9999)).toBeUndefined();
    expect(getModuleById(9999)).toBeUndefined();
    expect(getUserById(9999)).toBeUndefined();
  });
});

describe("getCourseForLesson", () => {
  it("returns the course the lesson belongs to", () => {
    expect(getCourseForLesson(lessonC.id)).toEqual({
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      instructorId: instructor.id,
    });
  });

  it("returns nothing for a lesson that does not exist", () => {
    expect(getCourseForLesson(9999)).toBeUndefined();
  });
});

describe("flattenCourseLessons", () => {
  it("lists every lesson in course order with its module", () => {
    const details = getCourseWithDetails(course.id);
    expect(details && flattenCourseLessons(details)).toEqual([
      {
        id: lessonA.id,
        title: "A",
        moduleId: firstModule.id,
        moduleTitle: "First",
      },
      {
        id: lessonB.id,
        title: "B",
        moduleId: firstModule.id,
        moduleTitle: "First",
      },
      {
        id: lessonC.id,
        title: "C",
        moduleId: secondModule.id,
        moduleTitle: "Second",
      },
    ]);
  });
});
