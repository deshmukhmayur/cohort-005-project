import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createCourseCatalog } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

// ─── Fixtures ───
// No module writes courses, modules or lessons yet, so rows go in directly.
// Kept in one place so a schema change touches only this block.

function addCategory(slug: string) {
  return db
    .insert(schema.categories)
    .values({ name: slug, slug })
    .returning()
    .get();
}

function addCourse(
  slug: string,
  createdAt: string,
  {
    status = CourseStatus.Published,
    categoryId = base.category.id,
  }: { status?: CourseStatus; categoryId?: number } = {}
) {
  return db
    .insert(schema.courses)
    .values({
      title: `Title ${slug}`,
      slug,
      description: `About ${slug}`,
      salesCopy: markdown("Sales copy"),
      instructorId: base.instructor.id,
      categoryId,
      status,
      coverImageUrl: `/covers/${slug}.png`,
      createdAt,
    })
    .returning()
    .get();
}

function addLessons(courseId: number, perModule: number[]) {
  perModule.forEach((lessonCount, index) => {
    const module = db
      .insert(schema.modules)
      .values({ courseId, title: `Module ${index}`, position: index })
      .returning()
      .get();
    for (let position = 0; position < lessonCount; position++) {
      db.insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .run();
    }
  });
}

function landingPage(limit = 4) {
  return createCourseCatalog(db).landingPage(limit);
}

describe("courseCatalog.landingPage", () => {
  it("lists published courses newest first, up to the limit", () => {
    addCourse("old", "2099-01-01T00:00:00.000Z");
    addCourse("new", "2099-03-01T00:00:00.000Z");
    addCourse("mid", "2099-02-01T00:00:00.000Z");

    const slugs = landingPage(3).newestCourses.map((course) => course.slug);

    expect(slugs).toEqual(["new", "mid", "old"]);
  });

  it("breaks a createdAt tie with the later course first", () => {
    const first = addCourse("first", "2099-01-01T00:00:00.000Z");
    const second = addCourse("second", "2099-01-01T00:00:00.000Z");

    const ids = landingPage(2).newestCourses.map((course) => course.id);

    expect(ids).toEqual([second.id, first.id]);
  });

  it("leaves out courses that are not published", () => {
    addCourse("draft", "2099-01-01T00:00:00.000Z", {
      status: CourseStatus.Draft,
    });
    addCourse("archived", "2099-01-02T00:00:00.000Z", {
      status: CourseStatus.Archived,
    });

    const page = landingPage();

    expect(page.newestCourses.map((course) => course.slug)).toEqual([
      base.course.slug,
    ]);
    expect(page.publishedCourseCount).toBe(1);
  });

  it("returns what the course card shows", () => {
    const course = addCourse("shown", "2099-01-01T00:00:00.000Z");

    expect(landingPage(1).newestCourses).toEqual([
      {
        id: course.id,
        title: "Title shown",
        slug: "shown",
        description: "About shown",
        coverImageUrl: "/covers/shown.png",
        instructorName: base.instructor.name,
        lessonCount: 0,
      },
    ]);
  });

  it("counts every lesson across a course's modules", () => {
    const course = addCourse("full", "2099-01-01T00:00:00.000Z");
    addLessons(course.id, [2, 3]);
    addLessons(base.course.id, [1]);

    const counts = landingPage().newestCourses.map((c) => [
      c.slug,
      c.lessonCount,
    ]);

    expect(counts).toEqual([
      ["full", 5],
      [base.course.slug, 1],
    ]);
  });

  it("counts every published course, not only the ones it lists", () => {
    for (let i = 0; i < 5; i++) {
      addCourse(`extra-${i}`, `2026-01-0${i + 1}T00:00:00.000Z`);
    }

    const page = landingPage(2);

    expect(page.newestCourses).toHaveLength(2);
    expect(page.publishedCourseCount).toBe(6);
  });

  it("counts only categories that hold a published course", () => {
    const design = addCategory("design");
    addCategory("empty");
    const drafts = addCategory("drafts");
    addCourse("designed", "2026-01-01T00:00:00.000Z", {
      categoryId: design.id,
    });
    addCourse("same-category", "2026-01-02T00:00:00.000Z", {
      categoryId: design.id,
    });
    addCourse("drafted", "2026-01-03T00:00:00.000Z", {
      categoryId: drafts.id,
      status: CourseStatus.Draft,
    });

    expect(landingPage().categoryCount).toBe(2);
  });

  it("returns empty totals when nothing is published", () => {
    const empty = createTestDb();

    expect(createCourseCatalog(empty).landingPage(4)).toEqual({
      newestCourses: [],
      publishedCourseCount: 0,
      categoryCount: 0,
    });
  });
});
