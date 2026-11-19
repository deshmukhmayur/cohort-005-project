import { and, eq } from "drizzle-orm";
import { coupons, enrollments, teamMembers, TeamMemberRole } from "~/db/schema";
import type { Db } from "./landing-page";

/**
 * How a user already reaches a course. "enrolled" wins over "team": an
 * Enrollment (bought, or from a Claimed Seat) is what the learner opens.
 * A Team Licence buyer has no Enrollment, so they are pointed at the team.
 */
export type CourseAccess = "enrolled" | "team";

export function getCourseAccess(
  database: Db,
  userId: number
): Map<number, CourseAccess> {
  const access = new Map<number, CourseAccess>();

  const teamCourses = database
    .selectDistinct({ courseId: coupons.courseId })
    .from(coupons)
    .innerJoin(teamMembers, eq(teamMembers.teamId, coupons.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .all();
  for (const { courseId } of teamCourses) access.set(courseId, "team");

  const enrolled = database
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .all();
  for (const { courseId } of enrolled) access.set(courseId, "enrolled");

  return access;
}
