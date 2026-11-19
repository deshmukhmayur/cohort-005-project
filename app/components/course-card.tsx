import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { StarRating } from "~/components/star-rating";
import { formatPrice } from "~/lib/utils";

export type CourseCardData = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  categoryName: string;
  instructorId: number;
  instructorName: string;
  instructorAvatarUrl: string | null;
  price: number;
  pppPrice: number;
  progress: number | null;
  completedLessons: number | null;
  lessonCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  access: "enrolled" | "team" | null;
};

function CourseCardAction({ course }: { course: CourseCardData }) {
  if (course.access === "enrolled") {
    return (
      <span className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
        Continue
      </span>
    );
  }
  if (course.access === "team") {
    return (
      <span className="rounded-md border px-3 py-1 text-xs font-medium text-foreground">
        Manage team
      </span>
    );
  }
  return (
    <span className="font-semibold text-foreground">
      {course.pppPrice < course.price ? (
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-normal text-muted-foreground line-through">
            {formatPrice(course.price)}
          </span>
          {formatPrice(course.pppPrice)}
        </span>
      ) : (
        formatPrice(course.price)
      )}
    </span>
  );
}

function CourseProgress({ course }: { course: CourseCardData }) {
  if (course.progress === null || course.progress <= 0) return null;
  return (
    <CardContent className="pt-0">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {course.completedLessons} / {course.lessonCount} lessons
        </span>
        <span className="font-medium">{course.progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${course.progress}%` }}
        />
      </div>
    </CardContent>
  );
}

function CourseCardFooter({ course }: { course: CourseCardData }) {
  return (
    <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <UserAvatar
          name={course.instructorName}
          avatarUrl={course.instructorAvatarUrl}
          className="size-5"
        />
        {course.instructorName}
      </span>
      <CourseCardAction course={course} />
    </CardFooter>
  );
}

export function CourseCard({
  course,
  currentUserId,
}: {
  course: CourseCardData;
  currentUserId: number | null;
}) {
  return (
    <Link
      to={course.access === "team" ? "/team" : `/courses/${course.slug}`}
      className="group"
    >
      <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
        <div className="aspect-video overflow-hidden">
          <CourseImage
            src={course.coverImageUrl}
            alt={course.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium">
            <span className="text-primary">{course.categoryName}</span>
            {currentUserId !== null &&
              course.instructorId === currentUserId && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Your Course
                </span>
              )}
          </div>
          <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
            {course.title}
          </h3>
          <StarRating
            average={course.ratingAverage}
            count={course.ratingCount}
            className="mt-1"
          />
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        </CardContent>
        <CourseProgress course={course} />
        <CourseCardFooter course={course} />
      </Card>
    </Link>
  );
}
