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
const { getCommentById, getLessonThread, renderThread } = await import(
  "../thread.server"
);

// ─── Fixtures ───
// The module has no function that writes lessons or comments, so rows go in
// directly. Kept in one place so a schema change touches only this block.

const { course, user, instructor } = seedBaseData(testDb);

const admin = testDb
  .insert(schema.users)
  .values({
    name: "Admin",
    email: "admin@example.com",
    role: schema.UserRole.Admin,
  })
  .returning()
  .get();

const courseModule = testDb
  .insert(schema.modules)
  .values({ courseId: course.id, title: "Module", position: 1 })
  .returning()
  .get();

function addLesson(position: number) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId: courseModule.id, title: `L${position}`, position })
    .returning()
    .get();
}

let clock = 0;
function comment({
  lessonId,
  userId,
  body,
  parentId,
  deleted,
  edited,
}: {
  lessonId: number;
  userId: number;
  body: string;
  parentId?: number;
  deleted?: boolean;
  edited?: boolean;
}) {
  clock += 1;
  const at = `2026-01-01T00:00:${String(clock).padStart(2, "0")}Z`;
  return testDb
    .insert(schema.comments)
    .values({
      lessonId,
      userId,
      body: markdown(body),
      parentId: parentId ?? null,
      createdAt: at,
      editedAt: edited ? at : null,
      deletedAt: deleted ? at : null,
    })
    .returning()
    .get();
}

const lesson = addLesson(1);
const on = { lessonId: lesson.id };
const question = comment({
  ...on,
  userId: user.id,
  body: "How?",
  edited: true,
});
const answer = comment({
  ...on,
  userId: instructor.id,
  body: "Like **this**",
  parentId: question.id,
});
comment({
  ...on,
  userId: user.id,
  body: "gone",
  parentId: question.id,
  deleted: true,
});
const adminNote = comment({ ...on, userId: admin.id, body: "Note" });
const deletedWithReply = comment({
  ...on,
  userId: user.id,
  body: "secret",
  deleted: true,
  edited: true,
});
const orphanReply = comment({
  ...on,
  userId: admin.id,
  body: "Still here",
  parentId: deletedWithReply.id,
});
comment({ ...on, userId: user.id, body: "lonely", deleted: true });
comment({ lessonId: addLesson(2).id, userId: user.id, body: "Other lesson" });

describe("getCommentById", () => {
  it("finds a comment and returns nothing for an unknown id", () => {
    expect(getCommentById(question.id)?.body).toBe("How?");
    expect(getCommentById(9999)).toBeUndefined();
  });
});

describe("getLessonThread", () => {
  const thread = getLessonThread(lesson.id);

  it("lists this lesson's questions in order, hiding deleted ones without replies", () => {
    expect(thread.map((c) => c.id)).toEqual([
      question.id,
      adminNote.id,
      deletedWithReply.id,
    ]);
  });

  it("nests live replies under their question", () => {
    expect(thread[0].replies.map((r) => r.id)).toEqual([answer.id]);
    expect(thread[0].replies[0].replies).toEqual([]);
  });

  it("marks the course instructor and platform admins", () => {
    expect(thread[0].author).toMatchObject({
      id: user.id,
      name: user.name,
      isInstructor: false,
      isPlatformAdmin: false,
    });
    expect(thread[0].replies[0].author).toMatchObject({
      isInstructor: true,
      isPlatformAdmin: false,
    });
    expect(thread[1].author).toMatchObject({
      isInstructor: false,
      isPlatformAdmin: true,
    });
  });

  it("keeps a live comment's body and edit time", () => {
    expect(thread[0]).toMatchObject({
      body: "How?",
      editedAt: question.editedAt,
      createdAt: question.createdAt,
      deleted: false,
    });
  });

  it("blanks a deleted question that still has replies", () => {
    expect(thread[2]).toMatchObject({
      body: "",
      editedAt: null,
      deleted: true,
    });
    expect(thread[2].replies.map((r) => r.id)).toEqual([orphanReply.id]);
  });

  it("returns nothing for a lesson that does not exist", () => {
    expect(getLessonThread(9999)).toEqual([]);
  });
});

describe("renderThread", () => {
  it("renders each body to HTML and leaves deleted bodies empty", async () => {
    const rendered = await renderThread(getLessonThread(lesson.id));
    expect(rendered[0].replies[0].bodyHtml).toContain("<strong>this</strong>");
    expect(rendered[0].bodyHtml).toContain("How?");
    expect(rendered[2].bodyHtml).toBe("");
    expect(rendered[2].replies[0].bodyHtml).toContain("Still here");
  });
});
