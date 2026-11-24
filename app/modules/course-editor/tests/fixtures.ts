import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { createCourseEditor } from "../index.server";

export function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

export function resultOf(value: unknown) {
  const response = value as { data?: unknown; init: { status: number } };
  return { body: response.data, status: response.init.status };
}

export function setupEditor(clock?: () => Date) {
  const db = createTestDb();
  const base = seedBaseData(db);
  const editor = createCourseEditor(db, clock);
  const target = {
    id: base.course.id,
    title: base.course.title,
    description: base.course.description,
  };

  function addModule(title: string, position: number) {
    return db
      .insert(schema.modules)
      .values({ courseId: base.course.id, title, position })
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

  function addStudent(email: string) {
    const user = db
      .insert(schema.users)
      .values({ name: email, email, role: schema.UserRole.Student })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: user.id, courseId: base.course.id })
      .run();
    return user;
  }

  return { db, editor, base, target, addModule, addLesson, addStudent };
}
