import { data } from "react-router";
import { parseFormData } from "~/lib/validation";
import * as q from "./queries";
import { courseEditorActionSchema } from "./schema";
import type { z } from "zod";

type Action = z.infer<typeof courseEditorActionSchema>;
type Intent<T extends Action["intent"]> = Extract<Action, { intent: T }>;
type Course = { id: number; title: string; description: string };
type Context = { db: q.Db; course: Course };

const ok = (field: string) => ({ success: true, field });
const fail = (error: string, status: number) => data({ error }, { status });

const MODULE_MISSING = "Module not found in this course.";
const LESSON_MISSING = "Lesson not found in this course.";
const MAX_PRICE_DOLLARS = 9999.99;

function ownModule({ db, course }: Context, moduleId: number) {
  const mod = q.getModuleById(db, moduleId);
  return mod && mod.courseId === course.id ? mod : null;
}

function ownLesson(context: Context, lessonId: number) {
  const lesson = q.getLessonById(context.db, lessonId);
  if (!lesson) return { lesson: null, error: fail("Lesson not found.", 404) };
  if (!ownModule(context, lesson.moduleId)) {
    return { lesson: null, error: fail(LESSON_MISSING, 404) };
  }
  return { lesson, error: null };
}

function updatePrice({ db, course }: Context, input: Intent<"update-price">) {
  const dollars = parseFloat(input.price);
  if (isNaN(dollars) || dollars < 0) {
    return fail("Price must be a non-negative number.", 400);
  }
  if (dollars > MAX_PRICE_DOLLARS) {
    return fail("Price cannot exceed $9,999.99.", 400);
  }
  q.updateCoursePrice(db, course.id, Math.round(dollars * 100));
  return ok("price");
}

function renameModule(context: Context, input: Intent<"rename-module">) {
  if (!ownModule(context, input.moduleId)) return fail(MODULE_MISSING, 404);
  q.updateModuleTitle(context.db, input.moduleId, input.title);
  return ok("module");
}

function deleteModule(context: Context, input: Intent<"delete-module">) {
  if (!ownModule(context, input.moduleId)) return fail(MODULE_MISSING, 404);
  q.deleteModule(context.db, input.moduleId);
  return ok("module");
}

function addLesson(context: Context, input: Intent<"add-lesson">) {
  if (!ownModule(context, input.moduleId)) return fail(MODULE_MISSING, 404);
  q.createLesson(context.db, input.moduleId, input.title);
  return ok("lesson");
}

function renameLesson(context: Context, input: Intent<"rename-lesson">) {
  const { error } = ownLesson(context, input.lessonId);
  if (error) return error;
  q.updateLessonTitle(context.db, input.lessonId, input.title);
  return ok("lesson");
}

function deleteLesson(context: Context, input: Intent<"delete-lesson">) {
  const { error } = ownLesson(context, input.lessonId);
  if (error) return error;
  q.deleteLesson(context.db, input.lessonId);
  return ok("lesson");
}

function reorderLessons(context: Context, input: Intent<"reorder-lessons">) {
  if (!ownModule(context, input.moduleId)) return fail(MODULE_MISSING, 404);
  const lessonIds: number[] = JSON.parse(input.lessonIds);
  q.reorderLessons(context.db, input.moduleId, lessonIds);
  return ok("lesson-reorder");
}

function moveLesson(context: Context, input: Intent<"move-lesson">) {
  const { error, lesson } = ownLesson(context, input.lessonId);
  if (error) return error;
  if (!ownModule(context, input.targetModuleId)) {
    return fail("Target module not found in this course.", 404);
  }
  q.moveLessonToModule(context.db, lesson, {
    moduleId: input.targetModuleId,
    position: input.targetPosition,
  });
  return ok("lesson-move");
}

function dispatch(context: Context, input: Action) {
  const { db, course } = context;
  switch (input.intent) {
    case "update-title":
      q.updateCourse(db, course.id, {
        title: input.title,
        description: course.description,
      });
      return ok("title");
    case "update-description":
      q.updateCourse(db, course.id, {
        title: course.title,
        description: input.description,
      });
      return ok("description");
    case "update-status":
      q.updateCourseStatus(db, course.id, input.status);
      return ok("status");
    case "update-price":
      return updatePrice(context, input);
    case "update-ppp-enabled":
      q.updateCoursePppEnabled(db, course.id, input.pppEnabled === "true");
      return ok("ppp-enabled");
    case "update-sales-copy":
      q.updateCourseSalesCopy(db, course.id, input.salesCopy);
      return ok("sales-copy");
    case "add-module":
      q.createModule(db, course.id, input.title);
      return ok("module");
    case "reorder-modules":
      q.reorderModules(db, course.id, JSON.parse(input.moduleIds));
      return ok("module-reorder");
    case "rename-module":
      return renameModule(context, input);
    case "delete-module":
      return deleteModule(context, input);
    case "add-lesson":
      return addLesson(context, input);
    case "rename-lesson":
      return renameLesson(context, input);
    case "delete-lesson":
      return deleteLesson(context, input);
    case "reorder-lessons":
      return reorderLessons(context, input);
    case "move-lesson":
      return moveLesson(context, input);
  }
}

export function performCourseEditorAction(
  db: q.Db,
  course: Course,
  formData: FormData
) {
  const parsed = parseFormData(formData, courseEditorActionSchema);
  if (!parsed.success) {
    // Stryker disable next-line StringLiteral: a failed parse always has at least one error; the fallback only satisfies the type.
    return fail(Object.values(parsed.errors)[0] ?? "Invalid input.", 400);
  }
  return dispatch({ db, course }, parsed.data);
}
