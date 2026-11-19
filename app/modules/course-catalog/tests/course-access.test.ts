import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { TeamMemberRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createCourseCatalog } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

// No module writes these rows yet, so they go in directly, in one place.
function addCourse(slug: string) {
  return db
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: slug,
      salesCopy: markdown("Sales copy"),
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

function enroll(userId: number, courseId: number) {
  db.insert(schema.enrollments).values({ userId, courseId }).run();
}

function addTeamLicence(
  userId: number,
  courseId: number,
  role: TeamMemberRole
) {
  const team = db.insert(schema.teams).values({}).returning().get();
  db.insert(schema.teamMembers).values({ teamId: team.id, userId, role }).run();
  const purchase = db
    .insert(schema.purchases)
    .values({ userId, courseId, amountPaid: 100 })
    .returning()
    .get();
  db.insert(schema.coupons)
    .values({
      teamId: team.id,
      courseId,
      code: `code-${team.id}`,
      purchaseId: purchase.id,
    })
    .run();
}

function access(userId: number) {
  return createCourseCatalog(db).courseAccess(userId);
}

describe("courseAccess", () => {
  it("is empty for a user with nothing", () => {
    addCourse("a");
    expect(access(base.instructor.id).size).toBe(0);
  });

  it("marks enrolled courses, including ones with no progress", () => {
    const a = addCourse("a");
    addCourse("b");
    enroll(base.instructor.id, a.id);
    expect([...access(base.instructor.id)]).toEqual([[a.id, "enrolled"]]);
  });

  it("marks a Team Licence admin's course as team", () => {
    const a = addCourse("a");
    addTeamLicence(base.instructor.id, a.id, TeamMemberRole.Admin);
    expect(access(base.instructor.id).get(a.id)).toBe("team");
  });

  it("ignores team members who are not admins", () => {
    const a = addCourse("a");
    addTeamLicence(base.instructor.id, a.id, TeamMemberRole.Member);
    expect(access(base.instructor.id).size).toBe(0);
  });

  it("prefers enrolled over team", () => {
    const a = addCourse("a");
    addTeamLicence(base.instructor.id, a.id, TeamMemberRole.Admin);
    enroll(base.instructor.id, a.id);
    expect(access(base.instructor.id).get(a.id)).toBe("enrolled");
  });
});
