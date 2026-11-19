import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { count, countDistinct, desc, eq, inArray } from "drizzle-orm";
import * as schema from "~/db/schema";
import { courses, CourseStatus, lessons, modules, users } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export type LandingPageCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  lessonCount: number;
};

export type LandingPage = {
  /** Newest published course first, at most `limit` of them. */
  newestCourses: LandingPageCourse[];
  publishedCourseCount: number;
  /** Categories that hold at least one published course. */
  categoryCount: number;
};

const isPublished = eq(courses.status, CourseStatus.Published);

export function getLandingPage(database: Db, limit: number): LandingPage {
  const newest = database
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .where(isPublished)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(limit)
    .all();

  // An aggregate with no GROUP BY returns exactly one row, even over no rows.
  const [{ publishedCourseCount, categoryCount }] = database
    .select({
      publishedCourseCount: count(),
      categoryCount: countDistinct(courses.categoryId),
    })
    .from(courses)
    .where(isPublished)
    .all();

  const lessonCounts = new Map(
    database
      .select({ courseId: modules.courseId, lessonCount: count() })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(
        inArray(
          modules.courseId,
          newest.map((course) => course.id)
        )
      )
      .groupBy(modules.courseId)
      .all()
      .map((row) => [row.courseId, row.lessonCount])
  );

  return {
    newestCourses: newest.map((course) => ({
      ...course,
      lessonCount: lessonCounts.get(course.id) ?? 0,
    })),
    publishedCourseCount,
    categoryCount,
  };
}
