import { data } from "react-router";
import {
  getAttemptsBestFirst,
  getCompletedLessonCounts,
  getCourseEnrolledStudents,
  getCourseWithDetails,
  getEnrollmentCountForCourse,
  getLessonCountForCourse,
  getQuizzesByLessonIds,
  type Db,
} from "./queries";

type CourseLesson = { id: number; title: string };

function quizzesOf(db: Db, lessons: CourseLesson[]) {
  const quizByLesson = new Map<number, { id: number; title: string }>();
  for (const quiz of getQuizzesByLessonIds(
    db,
    lessons.map((lesson) => lesson.id)
  )) {
    if (!quizByLesson.has(quiz.lessonId)) quizByLesson.set(quiz.lessonId, quiz);
  }
  return lessons.flatMap((lesson) => {
    const quiz = quizByLesson.get(lesson.id);
    if (!quiz) return [];
    return [
      { lessonTitle: lesson.title, quizId: quiz.id, quizTitle: quiz.title },
    ];
  });
}

function bestAttempts(db: Db, quizIds: number[]) {
  const best = new Map<string, { score: number; passed: boolean }>();
  for (const attempt of getAttemptsBestFirst(db, quizIds)) {
    const key = `${attempt.userId}:${attempt.quizId}`;
    if (!best.has(key)) best.set(key, attempt);
  }
  return best;
}

function rosterOf(
  db: Db,
  courseId: number,
  lessonQuizzes: ReturnType<typeof quizzesOf>
) {
  const lessonCount = getLessonCountForCourse(db, courseId);
  const completed = getCompletedLessonCounts(db, courseId);
  const best = bestAttempts(
    db,
    lessonQuizzes.map((quiz) => quiz.quizId)
  );

  return getCourseEnrolledStudents(db, courseId).map((enrollment) => ({
    ...enrollment,
    progress:
      lessonCount === 0
        ? 0
        : Math.round(
            ((completed.get(enrollment.userId) ?? 0) / lessonCount) * 100
          ),
    quizScores: lessonQuizzes.map((quiz) => {
      const attempt = best.get(`${enrollment.userId}:${quiz.quizId}`);
      return {
        ...quiz,
        bestScore: attempt?.score ?? null,
        passed: attempt?.passed ?? null,
      };
    }),
  }));
}

export function loadCourseEditor(db: Db, courseId: number) {
  const course = getCourseWithDetails(db, courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonQuizzes = quizzesOf(
    db,
    course.modules.flatMap((mod) => mod.lessons)
  );

  return {
    course,
    lessonCount: getLessonCountForCourse(db, courseId),
    enrollmentCount: getEnrollmentCountForCourse(db, courseId),
    students: rosterOf(db, courseId, lessonQuizzes),
    quizCount: lessonQuizzes.length,
  };
}
