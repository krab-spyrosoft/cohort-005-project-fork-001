// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Lives on the prototype/knock-spike branch only. Never merge.
// Open /prototype/knock, switch users in the DevUI panel, and work the four checks.
import { useEffect, useRef, useState } from "react";
import { Form, useActionData } from "react-router";
import Knock, {
  type Feed,
  type FeedItem,
  type FeedMetadata,
  type PreferenceSet,
} from "@knocklabs/client";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { requireUserId } from "~/lib/access.server";
import { db } from "~/db";
import { comments, users, UserRole } from "~/db/schema";
import { knock, knockPublic, signKnockToken } from "~/lib/prototype-knock.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;

  // Keep the recipient in sync with Cadence (fog: "User sync").
  await knock.users.update(String(user.id), { name: user.name });

  const token = await signKnockToken(String(user.id));

  // Latest live question by someone else — the current user replies to it.
  const question = db
    .select({ id: comments.id, body: comments.body, authorId: comments.userId, authorName: users.name })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt), ne(comments.userId, userId)))
    .orderBy(desc(comments.createdAt))
    .get();

  const instructors = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, UserRole.Instructor))
    .all();

  return {
    user: { id: String(user.id), name: user.name, role: user.role },
    token,
    ...knockPublic,
    question: question ?? null,
    instructors,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "discussion-reply") {
      const authorId = String(form.get("authorId"));
      await knock.users.update(authorId, {});
      const res = await knock.workflows.trigger("discussion-reply", {
        recipients: [authorId],
        actor: String(userId),
        data: { questionId: Number(form.get("questionId")), excerpt: String(form.get("excerpt")) },
      });
      return { ok: true, intent, recipient: authorId, res };
    }
    if (intent === "new-enrollment") {
      const instructorId = String(form.get("instructorId"));
      await knock.users.update(instructorId, {});
      const res = await knock.workflows.trigger("new-enrollment", {
        recipients: [instructorId],
        actor: String(userId),
        data: { courseTitle: "PROTOTYPE course" },
      });
      return { ok: true, intent, recipient: instructorId, res };
    }
  } catch (error) {
    return { ok: false, intent, error: String(error) };
  }
  return { ok: false, intent, error: "unknown intent" };
}

export default function PrototypeKnock({ loaderData }: Route.ComponentProps) {
  const { user, token, publicApiKey, feedChannelId, question, instructors } = loaderData;
  const actionData = useActionData<typeof action>();
  const feedRef = useRef<Feed | null>(null);
  const knockRef = useRef<Knock | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<FeedMetadata | null>(null);
  const [prefs, setPrefs] = useState<PreferenceSet | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 30));

  // Check 1: authenticate the headless client with our signed token. Re-runs when the DevUI user changes.
  useEffect(() => {
    const client = new Knock(publicApiKey);
    client.authenticate({ id: user.id }, token);
    const feed = client.feeds.initialize(feedChannelId);
    const unsubscribe = feed.store.subscribe((state) => {
      setItems(state.items);
      setMeta(state.metadata);
    });
    feed.listenForUpdates();
    feed.fetch().then(
      () => say(`feed fetched for user ${user.id}`),
      (e) => say(`feed fetch FAILED: ${e}`)
    );
    client.user.getPreferences().then(setPrefs, (e) => say(`prefs FAILED: ${e}`));
    knockRef.current = client;
    feedRef.current = feed;
    return () => {
      unsubscribe();
      feed.dispose();
      client.teardown();
    };
  }, [user.id, token, publicApiKey, feedChannelId]);

  useEffect(() => {
    if (actionData) say(`${actionData.intent}: ${actionData.ok ? `triggered → user ${actionData.recipient}` : actionData.error}`);
    // Server-side trigger is async in Knock; refetch shortly after.
    const t = setTimeout(() => feedRef.current?.fetch(), 1500);
    return () => clearTimeout(t);
  }, [actionData]);

  async function setEnrollmentOptIn(on: boolean) {
    const client = knockRef.current!;
    const next = await client.user.setPreferences({
      ...(prefs ?? {}),
      categories: { ...(prefs?.categories ?? {}), "new-enrollment": { channel_types: { in_app_feed: on } } },
    } as never);
    setPrefs(next);
    say(`new-enrollment in_app_feed → ${on}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
        PROTOTYPE — Knock spike. Throwaway; lives on <code>prototype/knock-spike</code> only.
      </div>
      <h1 className="text-2xl font-bold">
        Knock spike — signed in as {user.name} (#{user.id}, {user.role})
      </h1>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">2 · Trigger</h2>
          {question ? (
            <Form method="post" className="space-y-2">
              <input type="hidden" name="intent" value="discussion-reply" />
              <input type="hidden" name="questionId" value={question.id} />
              <input type="hidden" name="authorId" value={question.authorId} />
              <input type="hidden" name="excerpt" value={question.body.slice(0, 80)} />
              <p className="text-sm">
                Reply to question #{question.id} by {question.authorName} (#{question.authorId})
              </p>
              <button className="rounded bg-black px-3 py-1 text-white">Trigger Discussion Reply</button>
            </Form>
          ) : (
            <p className="text-sm">No question by another user found.</p>
          )}
          <Form method="post" className="space-y-2">
            <input type="hidden" name="intent" value="new-enrollment" />
            <select name="instructorId" className="rounded border p-1 text-sm">
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (#{i.id})
                </option>
              ))}
            </select>{" "}
            <button className="rounded bg-black px-3 py-1 text-white">Trigger new Enrollment</button>
          </Form>
        </div>

        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">4 · Preferences (this user, via signed token)</h2>
          <p className="text-sm">
            new-enrollment in_app_feed:{" "}
            <b>{String(prefs?.categories?.["new-enrollment"] ?? "unset (falls back to default set)")}</b>
          </p>
          <div className="space-x-2">
            <button className="rounded border px-3 py-1" onClick={() => setEnrollmentOptIn(true)}>
              Opt in
            </button>
            <button className="rounded border px-3 py-1" onClick={() => setEnrollmentOptIn(false)}>
              Opt out
            </button>
          </div>
          <pre className="max-h-48 overflow-auto bg-gray-100 p-2 text-xs">{JSON.stringify(prefs, null, 2)}</pre>
        </div>
      </section>

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">
          1 + 3 · Feed — unread {meta?.unread_count ?? "?"} · unseen {meta?.unseen_count ?? "?"} · total{" "}
          {meta?.total_count ?? "?"}
        </h2>
        <div className="space-x-2">
          <button className="rounded border px-3 py-1" onClick={() => feedRef.current?.fetch()}>
            Refetch
          </button>
          <button className="rounded border px-3 py-1" onClick={() => feedRef.current?.markAllAsSeen()}>
            Mark all seen
          </button>
          <button className="rounded border px-3 py-1" onClick={() => feedRef.current?.markAllAsRead()}>
            Mark all read
          </button>
        </div>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <b>{item.source.key}</b> · actor {item.actors[0] && "id" in item.actors[0] ? item.actors[0].id : "?"} ·{" "}
                {JSON.stringify(item.data)} · {item.seen_at ? "seen" : "unseen"} / {item.read_at ? "read" : "unread"}
              </span>
              <span className="space-x-1">
                <button className="rounded border px-2" onClick={() => feedRef.current?.markAsSeen(item)}>
                  seen
                </button>
                <button className="rounded border px-2" onClick={() => feedRef.current?.markAsRead(item)}>
                  read
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-semibold">Log</h2>
        <pre className="text-xs">{log.join("\n")}</pre>
      </section>
    </div>
  );
}
