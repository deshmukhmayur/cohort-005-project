import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { UserRole } from "~/db/schema";
import { UserMenu } from "~/components/user-menu";

function renderTrigger(name: string) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <UserMenu user={{ name, role: UserRole.Student, avatarUrl: null }} />
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/"]} />);
}

describe("UserMenu", () => {
  it("shows the full name, wrapped rather than truncated", () => {
    const html = renderTrigger("Bartholomew Montgomery-Fitzwilliam");
    const nameClasses = html.match(
      /<div class="([^"]*)">Bartholomew Montgomery-Fitzwilliam<\/div>/
    )?.[1];

    expect(nameClasses).toContain("break-words");
    expect(nameClasses).not.toContain("truncate");
  });

  it("shows the role under the name", () => {
    expect(renderTrigger("Emma Wilson")).toContain(">student</div>");
  });
});
