import { eq, and, inArray, sql, desc, gt, gte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  courses,
  categories,
  users,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  LessonProgressStatus,
  quizzes,
  quizAttempts,
  type CourseStatus,
} from "~/db/schema";
import { markdown } from "~/lib/text";

export type Db = BetterSQLite3Database<typeof schema>;

function getCourseRow(db: Db, id: number) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      instructorBio: users.bio,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, id))
    .get();
}

export function getCourseWithDetails(db: Db, id: number) {
  const course = getCourseRow(db, id);
  if (!course) return null;

  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(modules.position)
    .all();

  const courseLessons = db
    .select({ lesson: lessons })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, id))
    .orderBy(lessons.position)
    .all()
    .map((row) => row.lesson);

  return {
    ...course,
    modules: courseModules.map((mod) => ({
      ...mod,
      lessons: courseLessons.filter((l) => l.moduleId === mod.id),
    })),
  };
}

function lessonIdsOfCourse(db: Db, courseId: number) {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId));
}

export function getLessonCountForCourse(db: Db, courseId: number) {
  return lessonIdsOfCourse(db, courseId).all().length;
}

export function updateCourse(
  db: Db,
  id: number,
  fields: { title: string; description: string }
) {
  return db
    .update(courses)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCourseStatus(db: Db, id: number, status: CourseStatus) {
  return db
    .update(courses)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCourseSalesCopy(db: Db, id: number, salesCopy: string) {
  return db
    .update(courses)
    .set({
      salesCopy: markdown(salesCopy),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCoursePrice(db: Db, id: number, price: number) {
  return db
    .update(courses)
    .set({ price, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCoursePppEnabled(
  db: Db,
  id: number,
  pppEnabled: boolean
) {
  return db
    .update(courses)
    .set({ pppEnabled, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function getModuleById(db: Db, id: number) {
  return db.select().from(modules).where(eq(modules.id, id)).get();
}

export function createModule(db: Db, courseId: number, title: string) {
  const [last] = db
    .select({ max: sql<number>`coalesce(max(${modules.position}), 0)` })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  return db
    .insert(modules)
    .values({ courseId, title, position: last.max + 1 })
    .returning()
    .get();
}

export function updateModuleTitle(db: Db, id: number, title: string) {
  return db
    .update(modules)
    .set({ title })
    .where(eq(modules.id, id))
    .returning()
    .get();
}

export function deleteModule(db: Db, id: number) {
  // Delete all lessons in this module first
  db.delete(lessons).where(eq(lessons.moduleId, id)).run();
  return db.delete(modules).where(eq(modules.id, id)).returning().get();
}

export function reorderModules(db: Db, courseId: number, moduleIds: number[]) {
  moduleIds.forEach((moduleId, index) => {
    db.update(modules)
      .set({ position: index + 1 })
      .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
      .run();
  });
}

export function getLessonById(db: Db, id: number) {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export function createLesson(db: Db, moduleId: number, title: string) {
  const [last] = db
    .select({ max: sql<number>`coalesce(max(${lessons.position}), 0)` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .all();

  return db
    .insert(lessons)
    .values({ moduleId, title, position: last.max + 1 })
    .returning()
    .get();
}

export function updateLessonTitle(db: Db, id: number, title: string) {
  return db
    .update(lessons)
    .set({ title })
    .where(eq(lessons.id, id))
    .returning()
    .get();
}

export function deleteLesson(db: Db, id: number) {
  return db.delete(lessons).where(eq(lessons.id, id)).returning().get();
}

export function reorderLessons(db: Db, moduleId: number, lessonIds: number[]) {
  lessonIds.forEach((lessonId, index) => {
    db.update(lessons)
      .set({ position: index + 1 })
      .where(and(eq(lessons.id, lessonId), eq(lessons.moduleId, moduleId)))
      .run();
  });
}

type LessonRow = typeof lessons.$inferSelect;

export function moveLessonToModule(
  db: Db,
  lesson: LessonRow,
  target: { moduleId: number; position: number }
) {
  // 1. Close the gap in the source module
  db.update(lessons)
    .set({ position: sql`${lessons.position} - 1` })
    .where(
      and(
        eq(lessons.moduleId, lesson.moduleId),
        gt(lessons.position, lesson.position)
      )
    )
    .run();

  // 2. Open a gap in the destination module
  db.update(lessons)
    .set({ position: sql`${lessons.position} + 1` })
    .where(
      and(
        eq(lessons.moduleId, target.moduleId),
        gte(lessons.position, target.position)
      )
    )
    .run();

  // 3. Move the lesson to the target module at the target position
  return db
    .update(lessons)
    .set({ moduleId: target.moduleId, position: target.position })
    .where(eq(lessons.id, lesson.id))
    .returning()
    .get();
}

export function getEnrollmentCountForCourse(db: Db, courseId: number) {
  const [row] = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();
  return row.count;
}

export function getCourseEnrolledStudents(db: Db, courseId: number) {
  return db
    .select({
      userId: enrollments.userId,
      name: users.name,
      email: users.email,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId))
    .all();
}

/** Percentage of the course's lessons this student has completed. */
export function calculateProgress(db: Db, userId: number, courseId: number) {
  const lessonIds = lessonIdsOfCourse(db, courseId);
  const total = getLessonCountForCourse(db, courseId);
  if (total === 0) return 0;

  const [row] = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .all();
  return Math.round((row.count / total) * 100);
}

export function getQuizByLessonId(db: Db, lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

export function getBestAttempt(db: Db, userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}
