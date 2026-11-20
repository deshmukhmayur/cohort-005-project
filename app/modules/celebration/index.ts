const FLAG = "celebrate";

type Location = { pathname: string; search: string; hash: string };

export function welcomePathWithCelebration(slug: string): string {
  return `/courses/${slug}/welcome?${FLAG}=1`;
}

export function isCelebrating(location: Pick<Location, "search">): boolean {
  return new URLSearchParams(location.search).get(FLAG) === "1";
}

/** The same location without the flag, so a refresh does not replay it. */
export function withoutCelebration(location: Location): string {
  const params = new URLSearchParams(location.search);
  params.delete(FLAG);
  const search = params.toString();
  return `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
}
