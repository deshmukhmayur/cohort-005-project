import { db } from "~/db";
import type { Db } from "./lib/queries";
import { performCourseEditorAction } from "./lib/perform";
import { loadCourseEditor } from "./lib/view";

/**
 * The course editor bound to a database. The app uses `courseEditor`, which
 * reads the app database; tests build their own against a test database.
 */
export function createCourseEditor(database: Db) {
  return {
    /**
     * Everything the editor page shows: the course with its modules and
     * lessons, counts, and the student roster with progress and quiz scores.
     * Throws a 404 when the course does not exist.
     */
    view(courseId: number) {
      return loadCourseEditor(database, courseId);
    },
    /**
     * Applies one posted editor form (the `intent` field says which edit) to
     * a course. Returns `{ success, field }`, or a 400/404 response carrying
     * `{ error }` when the input is invalid or points outside the course.
     */
    perform(
      course: { id: number; title: string; description: string },
      formData: FormData
    ) {
      return performCourseEditorAction(database, course, formData);
    },
  };
}

export const courseEditor = createCourseEditor(db);
