import { data } from "react-router";
import {
  calculateProgress,
  getBestAttempt,
  getCourseEnrolledStudents,
  getCourseWithDetails,
  getEnrollmentCountForCourse,
  getLessonCountForCourse,
  getQuizByLessonId,
  type Db,
} from "./queries";

type CourseLesson = { id: number; title: string };

function quizzesOf(db: Db, lessons: CourseLesson[]) {
  return lessons.flatMap((lesson) => {
    const quiz = getQuizByLessonId(db, lesson.id);
    if (!quiz) return [];
    return [
      {
        lessonTitle: lesson.title,
        quizId: quiz.id,
        quizTitle: quiz.title,
      },
    ];
  });
}

function rosterOf(
  db: Db,
  courseId: number,
  lessonQuizzes: ReturnType<typeof quizzesOf>
) {
  return getCourseEnrolledStudents(db, courseId).map((enrollment) => {
    return {
      ...enrollment,
      progress: calculateProgress(db, enrollment.userId, courseId),
      quizScores: lessonQuizzes.map((quiz) => {
        const best = getBestAttempt(db, enrollment.userId, quiz.quizId);
        return {
          ...quiz,
          bestScore: best?.score ?? null,
          passed: best?.passed ?? null,
        };
      }),
    };
  });
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
