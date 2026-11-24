// PROTOTYPE, throwaway (#22). POST: fills the current user's real Knock feed
// with one of each catalogue Notification, sent by other seeded users.
//
// Only the `discussion-reply` workflow exists in the Knock Development
// environment, so every seed goes through it and carries `data.kind` to say
// which catalogue Notification it stands in for. The feed UI renders from
// `data` alone, so this is enough to judge the look.
import { data } from "react-router";
import type { Route } from "./+types/prototype.notification-feed.seed";
import { requireUserId } from "~/lib/access.server";
import { knock, knockUserId } from "~/lib/notification-feed-prototype.server";
import { db } from "~/db";
import { comments, courses, lessons, modules, users } from "~/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const me = db.select().from(users).where(eq(users.id, userId)).get()!;
  const others = db.select().from(users).where(ne(users.id, userId)).all();
  const pick = (i: number) => others[i % others.length];

  const question = db
    .select({
      id: comments.id,
      body: comments.body,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(comments)
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
    .get();
  const course = db.select().from(courses).limit(2).all();
  if (!question || course.length === 0) {
    throw data("PROTOTYPE: seed the DB first", { status: 400 });
  }
  const lessonUrl = `/courses/${question.courseSlug}/lessons/${question.lessonId}#comment-${question.id}`;

  // Oldest first, so the feed ends up newest-first in catalogue order.
  const seeds = [
    {
      kind: "seat-claimed",
      actor: pick(0),
      courseTitle: course[0].title,
      url: "/team",
    },
    {
      kind: "new-enrollment",
      actor: pick(1),
      courseTitle: course[0].title,
      url: `/instructor/${course[0].id}/students`,
    },
    {
      kind: "refund-request-new",
      actor: pick(2),
      courseTitle: course[1]?.title ?? course[0].title,
      url: "/admin/refunds",
    },
    {
      kind: "refund-declined",
      actor: pick(3),
      courseTitle: course[1]?.title ?? course[0].title,
      url: `/courses/${course[1]?.slug ?? course[0].slug}`,
    },
    {
      kind: "refund-approved",
      actor: pick(3),
      courseTitle: course[0].title,
      url: `/courses/${course[0].slug}`,
    },
    {
      kind: "discussion-question",
      actor: pick(4),
      courseTitle: question.courseTitle,
      lessonTitle: question.lessonTitle,
      excerpt: question.body.slice(0, 140),
      url: lessonUrl,
    },
    {
      kind: "discussion-reply",
      actor: pick(5),
      courseTitle: question.courseTitle,
      lessonTitle: question.lessonTitle,
      excerpt: "Good question! You can pass the generic explicitly here, it narrows the return type.",
      url: lessonUrl,
    },
  ];

  for (const { actor, ...rest } of seeds) {
    await knock.workflows.trigger("discussion-reply", {
      recipients: [{ id: knockUserId(me.id), name: me.name, email: me.email }],
      actor: { id: knockUserId(actor.id), name: actor.name, email: actor.email },
      data: { ...rest, actorName: actor.name, actorAvatarUrl: actor.avatarUrl },
    });
  }
  return { seeded: seeds.length };
}
