import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing-page";

export type { LandingPage, LandingPageCourse } from "./lib/landing-page";

/**
 * The public course catalog bound to a database. The app uses
 * `courseCatalog`; tests build their own against a test database.
 */
export function createCourseCatalog(database: Db) {
  return {
    /** The newest published courses and the catalog totals for `/`. */
    landingPage(limit: number) {
      return getLandingPage(database, limit);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const courseCatalog = /* @__PURE__ */ createCourseCatalog(db);
