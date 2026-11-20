const FLAG = "celebrate";

export function welcomePathWithCelebration(slug: string): string {
  return `/courses/${slug}/welcome?${FLAG}=1`;
}

export function isCelebrating(url: URL): boolean {
  return url.searchParams.get(FLAG) === "1";
}

/** The same location without the flag, so a refresh does not replay it. */
export function withoutCelebration(url: URL): string {
  const next = new URL(url);
  next.searchParams.delete(FLAG);
  return `${next.pathname}${next.search}${next.hash}`;
}
