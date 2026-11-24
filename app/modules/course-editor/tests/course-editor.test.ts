import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createCourseEditor } from "../index.server";

let db: TestDb;
let editor: ReturnType<typeof createCourseEditor>;
let course: typeof schema.courses.$inferSelect;
let otherCourse: typeof schema.courses.$inferSelect;
let student: typeof schema.users.$inferSelect;

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function addModule(courseId: number, title: string, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId, title, position })
    .returning()
    .get();
}

function addLesson(moduleId: number, title: string, position: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get();
}

function modulesOf(courseId: number) {
  return editor.view(courseId).course.modules;
}

function lessonTitles(courseId: number) {
  return modulesOf(courseId).map((m) => m.lessons.map((l) => l.title));
}

async function thrownBy(fn: () => unknown) {
  try {
    await fn();
  } catch (error) {
    return resultOf(error);
  }
  throw new Error("expected a throw");
}

function resultOf(value: unknown) {
  const response = value as { data?: unknown; init?: { status: number } };
  return { body: response.data, status: response.init?.status };
}

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  course = base.course;
  student = base.user;
  editor = createCourseEditor(db);
  otherCourse = db
    .insert(schema.courses)
    .values({
      title: "Other",
      slug: "other",
      description: "Other course",
      salesCopy: markdown("x"),
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Draft,
    })
    .returning()
    .get();
});

describe("courseEditor.view", () => {
  it("throws a 404 for a course that does not exist", async () => {
    const error = await thrownBy(() => editor.view(999));
    expect(error).toEqual({ body: "Course not found.", status: 404 });
  });

  it("lists modules and lessons in position order with counts", () => {
    const second = addModule(course.id, "Second", 2);
    const first = addModule(course.id, "First", 1);
    addLesson(first.id, "B", 2);
    addLesson(first.id, "A", 1);
    addLesson(second.id, "C", 1);
    const elsewhere = addModule(otherCourse.id, "Elsewhere", 1);
    addLesson(elsewhere.id, "Not mine", 1);
    db.insert(schema.enrollments)
      .values({ userId: student.id, courseId: otherCourse.id })
      .run();

    const view = editor.view(course.id);

    expect(view.course.title).toBe("Test Course");
    expect(view.course.instructorName).toBe("Test Instructor");
    expect(view.course.categoryName).toBe("Programming");
    expect(view.course.modules.map((m) => m.title)).toEqual([
      "First",
      "Second",
    ]);
    expect(lessonTitles(course.id)).toEqual([["A", "B"], ["C"]]);
    expect(view.lessonCount).toBe(3);
    expect(view.enrollmentCount).toBe(0);
    expect(view.students).toEqual([]);
    expect(view.quizCount).toBe(0);
  });

  it("counts no lessons for a course without modules", () => {
    expect(editor.view(course.id).lessonCount).toBe(0);
  });

  it("reports each student's progress and best quiz score", () => {
    const mod = addModule(course.id, "M", 1);
    const l1 = addLesson(mod.id, "One", 1);
    addLesson(mod.id, "Two", 2);
    db.insert(schema.enrollments)
      .values({ userId: student.id, courseId: course.id })
      .run();
    db.insert(schema.lessonProgress)
      .values({
        userId: student.id,
        lessonId: l1.id,
        status: schema.LessonProgressStatus.Completed,
      })
      .run();
    const quiz = db
      .insert(schema.quizzes)
      .values({ lessonId: l1.id, title: "Quiz", passingScore: 0.5 })
      .returning()
      .get();
    for (const score of [0.2, 0.9, 0.6]) {
      db.insert(schema.quizAttempts)
        .values({
          userId: student.id,
          quizId: quiz.id,
          score,
          passed: score >= 0.5,
        })
        .run();
    }

    const foreignLesson = addLesson(
      addModule(otherCourse.id, "Other", 1).id,
      "Other lesson",
      1
    );
    db.insert(schema.lessonProgress)
      .values({
        userId: student.id,
        lessonId: foreignLesson.id,
        status: schema.LessonProgressStatus.Completed,
      })
      .run();

    const view = editor.view(course.id);

    expect(view.enrollmentCount).toBe(1);
    expect(view.quizCount).toBe(1);
    expect(view.students).toHaveLength(1);
    expect(view.students[0]).toMatchObject({
      userId: student.id,
      name: "Test User",
      email: "test@example.com",
      progress: 50,
      quizScores: [
        {
          quizId: quiz.id,
          quizTitle: "Quiz",
          lessonTitle: "One",
          bestScore: 0.9,
          passed: true,
        },
      ],
    });
  });

  it("shows zero progress for a course without lessons", () => {
    db.insert(schema.enrollments)
      .values({ userId: student.id, courseId: course.id })
      .run();
    expect(editor.view(course.id).students[0].progress).toBe(0);
  });

  it("gives a student with no attempts a null score", () => {
    const mod = addModule(course.id, "M", 1);
    const l1 = addLesson(mod.id, "One", 1);
    db.insert(schema.enrollments)
      .values({ userId: student.id, courseId: course.id })
      .run();
    db.insert(schema.quizzes)
      .values({ lessonId: l1.id, title: "Quiz", passingScore: 0.5 })
      .run();
    const [row] = editor.view(course.id).students;
    expect(row.progress).toBe(0);
    expect(row.quizScores[0]).toMatchObject({ bestScore: null, passed: null });
  });
});

describe("courseEditor.perform", () => {
  const target = () => ({
    id: course.id,
    title: course.title,
    description: course.description,
  });

  async function perform(fields: Record<string, string>, c = target()) {
    return editor.perform(c, form(fields));
  }

  function row(id = course.id) {
    return db
      .select()
      .from(schema.courses)
      .all()
      .filter((c) => c.id === id)[0];
  }

  it("rejects invalid input with the first message and a 400", async () => {
    expect(
      resultOf(await perform({ intent: "update-title", title: " " }))
    ).toEqual({ body: { error: "Title cannot be empty." }, status: 400 });
    expect(resultOf(await perform({ intent: "nope" })).status).toBe(400);
  });

  it("renames the course and keeps its description", async () => {
    expect(await perform({ intent: "update-title", title: "  New  " })).toEqual(
      {
        success: true,
        field: "title",
      }
    );
    expect(row()).toMatchObject({
      title: "New",
      description: "A test course",
    });
  });

  it("rewrites the description and keeps the title", async () => {
    expect(
      await perform({ intent: "update-description", description: "Fresh" })
    ).toEqual({ success: true, field: "description" });
    expect(row()).toMatchObject({ title: "Test Course", description: "Fresh" });
  });

  it("changes status", async () => {
    expect(await perform({ intent: "update-status", status: "draft" })).toEqual(
      { success: true, field: "status" }
    );
    expect(row().status).toBe(schema.CourseStatus.Draft);
  });

  it("stores the price in cents", async () => {
    expect(await perform({ intent: "update-price", price: "19.99" })).toEqual({
      success: true,
      field: "price",
    });
    expect(row().price).toBe(1999);
    await perform({ intent: "update-price", price: "0" });
    expect(row().price).toBe(0);
    await perform({ intent: "update-price", price: "9999.99" });
    expect(row().price).toBe(999999);
  });

  it("refuses a negative, non-numeric or too large price", async () => {
    expect(
      resultOf(await perform({ intent: "update-price", price: "-1" }))
    ).toEqual({
      body: { error: "Price must be a non-negative number." },
      status: 400,
    });
    expect(
      resultOf(await perform({ intent: "update-price", price: "abc" })).status
    ).toBe(400);
    expect(
      resultOf(await perform({ intent: "update-price", price: "10000" }))
    ).toEqual({
      body: { error: "Price cannot exceed $9,999.99." },
      status: 400,
    });
  });

  it("toggles purchasing power pricing", async () => {
    expect(
      await perform({ intent: "update-ppp-enabled", pppEnabled: "true" })
    ).toEqual({ success: true, field: "ppp-enabled" });
    expect(row().pppEnabled).toBe(true);
    await perform({ intent: "update-ppp-enabled", pppEnabled: "false" });
    expect(row().pppEnabled).toBe(false);
  });

  it("saves sales copy as markdown", async () => {
    expect(
      await perform({ intent: "update-sales-copy", salesCopy: "# Hi" })
    ).toEqual({ success: true, field: "sales-copy" });
    expect(row().salesCopy).toContain("Hi");
    expect(row().salesCopy).not.toBe("x");
  });

  it("refuses empty sales copy", async () => {
    expect(
      resultOf(await perform({ intent: "update-sales-copy", salesCopy: " " }))
    ).toEqual({
      body: { error: "Sales copy cannot be empty." },
      status: 400,
    });
    expect(row().salesCopy).toContain("Sales copy for the test course");
  });

  it("adds modules after the last one", async () => {
    expect(await perform({ intent: "add-module", title: "A" })).toEqual({
      success: true,
      field: "module",
    });
    await perform({ intent: "add-module", title: "B" });
    expect(modulesOf(course.id).map((m) => [m.title, m.position])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
  });

  it("renames and deletes only this course's modules", async () => {
    const mine = addModule(course.id, "Mine", 1);
    const theirs = addModule(otherCourse.id, "Theirs", 1);
    const notFound = {
      body: { error: "Module not found in this course." },
      status: 404,
    };

    expect(
      await perform({
        intent: "rename-module",
        moduleId: String(mine.id),
        title: "Renamed",
      })
    ).toEqual({ success: true, field: "module" });
    expect(modulesOf(course.id)[0].title).toBe("Renamed");
    expect(
      resultOf(
        await perform({
          intent: "rename-module",
          moduleId: String(theirs.id),
          title: "Hack",
        })
      )
    ).toEqual(notFound);
    expect(
      resultOf(
        await perform({ intent: "delete-module", moduleId: String(theirs.id) })
      )
    ).toEqual(notFound);
    expect(modulesOf(otherCourse.id)).toHaveLength(1);

    addLesson(mine.id, "Gone", 1);
    expect(
      await perform({ intent: "delete-module", moduleId: String(mine.id) })
    ).toEqual({ success: true, field: "module" });
    expect(modulesOf(course.id)).toEqual([]);
    expect(db.select().from(schema.lessons).all()).toEqual([]);
  });

  it("adds, renames and deletes lessons inside this course", async () => {
    const mine = addModule(course.id, "Mine", 1);
    const theirs = addModule(otherCourse.id, "Theirs", 1);
    const foreign = addLesson(theirs.id, "Foreign", 1);

    expect(
      await perform({
        intent: "add-lesson",
        moduleId: String(mine.id),
        title: "L1",
      })
    ).toEqual({ success: true, field: "lesson" });
    await perform({
      intent: "add-lesson",
      moduleId: String(mine.id),
      title: "L2",
    });
    const added = modulesOf(course.id)[0].lessons;
    expect(added.map((l) => [l.title, l.position])).toEqual([
      ["L1", 1],
      ["L2", 2],
    ]);
    expect(added[0].content).toBeNull();

    expect(
      resultOf(
        await perform({
          intent: "add-lesson",
          moduleId: String(theirs.id),
          title: "X",
        })
      )
    ).toEqual({
      body: { error: "Module not found in this course." },
      status: 404,
    });

    expect(
      await perform({
        intent: "rename-lesson",
        lessonId: String(added[0].id),
        title: "Renamed",
      })
    ).toEqual({ success: true, field: "lesson" });
    expect(lessonTitles(course.id)).toEqual([["Renamed", "L2"]]);

    for (const intent of ["rename-lesson", "delete-lesson"]) {
      const fields = { intent, lessonId: String(foreign.id), title: "X" };
      expect(resultOf(await perform(fields))).toEqual({
        body: { error: "Lesson not found in this course." },
        status: 404,
      });
      expect(resultOf(await perform({ ...fields, lessonId: "9999" }))).toEqual({
        body: { error: "Lesson not found." },
        status: 404,
      });
    }

    expect(
      await perform({ intent: "delete-lesson", lessonId: String(added[0].id) })
    ).toEqual({ success: true, field: "lesson" });
    expect(lessonTitles(course.id)).toEqual([["L2"]]);
  });

  it("reorders modules and lessons", async () => {
    const a = addModule(course.id, "A", 1);
    const b = addModule(course.id, "B", 2);
    const l1 = addLesson(a.id, "L1", 1);
    const l2 = addLesson(a.id, "L2", 2);

    expect(
      await perform({
        intent: "reorder-modules",
        moduleIds: JSON.stringify([b.id, a.id]),
      })
    ).toEqual({ success: true, field: "module-reorder" });
    expect(modulesOf(course.id).map((m) => [m.title, m.position])).toEqual([
      ["B", 1],
      ["A", 2],
    ]);

    expect(
      await perform({
        intent: "reorder-lessons",
        moduleId: String(a.id),
        lessonIds: JSON.stringify([l2.id, l1.id]),
      })
    ).toEqual({ success: true, field: "lesson-reorder" });
    expect(lessonTitles(course.id)).toEqual([[], ["L2", "L1"]]);
    expect(modulesOf(course.id)[1].lessons.map((l) => l.position)).toEqual([
      1, 2,
    ]);

    expect(
      resultOf(
        await perform({
          intent: "reorder-lessons",
          moduleId: "9999",
          lessonIds: "[]",
        })
      )
    ).toEqual({
      body: { error: "Module not found in this course." },
      status: 404,
    });
  });

  it("does not reorder another course's modules", async () => {
    const theirs = addModule(otherCourse.id, "Theirs", 5);
    await perform({
      intent: "reorder-modules",
      moduleIds: JSON.stringify([theirs.id]),
    });
    expect(modulesOf(otherCourse.id)[0].position).toBe(5);
  });

  it("moves a lesson to another module and closes the gap", async () => {
    const a = addModule(course.id, "A", 1);
    const b = addModule(course.id, "B", 2);
    addLesson(a.id, "A1", 1);
    const a2 = addLesson(a.id, "A2", 2);
    addLesson(a.id, "A3", 3);
    addLesson(b.id, "B1", 1);
    addLesson(b.id, "B2", 2);

    expect(
      await perform({
        intent: "move-lesson",
        lessonId: String(a2.id),
        targetModuleId: String(b.id),
        targetPosition: "2",
      })
    ).toEqual({ success: true, field: "lesson-move" });

    const [ma, mb] = modulesOf(course.id);
    expect(ma.lessons.map((l) => [l.title, l.position])).toEqual([
      ["A1", 1],
      ["A3", 2],
    ]);
    expect(mb.lessons.map((l) => [l.title, l.position])).toEqual([
      ["B1", 1],
      ["A2", 2],
      ["B2", 3],
    ]);
  });

  it("refuses to move lessons across courses or to nowhere", async () => {
    const mine = addModule(course.id, "Mine", 1);
    const theirs = addModule(otherCourse.id, "Theirs", 1);
    const own = addLesson(mine.id, "Own", 1);
    const foreign = addLesson(theirs.id, "Foreign", 1);
    const move = (lessonId: number, targetModuleId: number) =>
      perform({
        intent: "move-lesson",
        lessonId: String(lessonId),
        targetModuleId: String(targetModuleId),
        targetPosition: "1",
      }).then(resultOf);

    expect(await move(9999, mine.id)).toEqual({
      body: { error: "Lesson not found." },
      status: 404,
    });
    expect(await move(foreign.id, mine.id)).toEqual({
      body: { error: "Lesson not found in this course." },
      status: 404,
    });
    expect(await move(own.id, theirs.id)).toEqual({
      body: { error: "Target module not found in this course." },
      status: 404,
    });
  });

  it("throws a 400 for an intent it has no branch for", async () => {
    expect(resultOf(await perform({ intent: "bogus" })).status).toBe(400);
  });
});
