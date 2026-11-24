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
} from "~/db/schema";

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

type CourseEdit = Partial<
  Pick<
    typeof courses.$inferInsert,
    "title" | "description" | "status" | "price" | "pppEnabled" | "salesCopy"
  >
> & { updatedAt: string };

export function updateCourse(db: Db, id: number, edit: CourseEdit) {
  return db
    .update(courses)
    .set(edit)
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
  return db.transaction((tx) => {
    tx.delete(lessons).where(eq(lessons.moduleId, id)).run();
    return tx.delete(modules).where(eq(modules.id, id)).returning().get();
  });
}

export function reorderModules(db: Db, courseId: number, moduleIds: number[]) {
  db.transaction((tx) => {
    moduleIds.forEach((moduleId, index) => {
      tx.update(modules)
        .set({ position: index + 1 })
        .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
        .run();
    });
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
  db.transaction((tx) => {
    lessonIds.forEach((lessonId, index) => {
      tx.update(lessons)
        .set({ position: index + 1 })
        .where(and(eq(lessons.id, lessonId), eq(lessons.moduleId, moduleId)))
        .run();
    });
  });
}

type LessonRow = typeof lessons.$inferSelect;

export function moveLessonToModule(
  db: Db,
  lesson: LessonRow,
  target: { moduleId: number; position: number }
) {
  return db.transaction((tx) => {
    tx.update(lessons)
      .set({ position: sql`${lessons.position} - 1` })
      .where(
        and(
          eq(lessons.moduleId, lesson.moduleId),
          gt(lessons.position, lesson.position)
        )
      )
      .run();
    tx.update(lessons)
      .set({ position: sql`${lessons.position} + 1` })
      .where(
        and(
          eq(lessons.moduleId, target.moduleId),
          gte(lessons.position, target.position)
        )
      )
      .run();
    return tx
      .update(lessons)
      .set({ moduleId: target.moduleId, position: target.position })
      .where(eq(lessons.id, lesson.id))
      .returning()
      .get();
  });
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

/** Lessons each student has completed in this course, in one query. */
export function getCompletedLessonCounts(db: Db, courseId: number) {
  const rows = db
    .select({
      userId: lessonProgress.userId,
      count: sql<number>`count(*)`,
    })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIdsOfCourse(db, courseId))
      )
    )
    .groupBy(lessonProgress.userId)
    .all();
  return new Map(rows.map((row) => [row.userId, row.count]));
}

/** The quiz attached to each of these lessons, in one query. */
export function getQuizzesByLessonIds(db: Db, lessonIds: number[]) {
  return db
    .select()
    .from(quizzes)
    .where(inArray(quizzes.lessonId, lessonIds))
    .all();
}

/** Every attempt at these quizzes, highest score first. */
export function getAttemptsBestFirst(db: Db, quizIds: number[]) {
  return db
    .select()
    .from(quizAttempts)
    .where(inArray(quizAttempts.quizId, quizIds))
    .orderBy(desc(quizAttempts.score))
    .all();
}
