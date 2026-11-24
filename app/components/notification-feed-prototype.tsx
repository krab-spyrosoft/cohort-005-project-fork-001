// PROTOTYPE, throwaway. "What does the Notification Feed look like in Cadence?"
// (krab-spyrosoft/cohort-005-project-fork-001#22). Lives on
// prototype/notification-feed only.
//
// Three variants of the Notification Feed, mounted in the real app layout and
// switchable with ?feedVariant=A|B|C (remembered in localStorage so normal
// navigation keeps it). Data comes from the real Knock feed of whichever user
// the DevUI selects, via Knock's headless REST API and a signed user token.
//
//   A  Bell popover:  bell in the sidebar header, badge = UNSEEN count.
//                     Opening marks everything seen; clicking a row marks it
//                     read and navigates.
//   B  Right drawer:  sidebar nav item with an UNREAD count pill. A full-height
//                     drawer with All/Unread tabs, Today/Earlier groups, and
//                     per-row hover actions (read/unread, archive).
//   C  Inbox:         sidebar nav item with an UNREAD count. Takes over the main
//                     area as a two-pane inbox; selecting a row marks it read and
//                     shows detail with an explicit "Open" button. New arrivals
//                     also pop a toast while you're elsewhere in the app.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Archive,
  Bell,
  BellDot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Inbox,
  Mail,
  MailOpen,
  MessageCircleQuestion,
  MessageSquareReply,
  Receipt,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import { Button } from "~/components/ui/button";

// ─── Knock headless feed ────────────────────────────────────────────────────

const KNOCK_API = "https://api.knock.app/v1";

export type FeedConfig = {
  knockUserId: string;
  publicApiKey: string;
  feedChannelId: string;
  userToken: string;
};

type FeedItem = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  data: Record<string, string | null | undefined>;
};

type Status = "read" | "unread" | "seen" | "archived";

function useKnockFeed(config: FeedConfig) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${config.publicApiKey}`,
      "X-Knock-User-Token": config.userToken,
      "Content-Type": "application/json",
    }),
    [config.publicApiKey, config.userToken]
  );

  const refresh = useCallback(async () => {
    const res = await fetch(
      `${KNOCK_API}/users/${config.knockUserId}/feeds/${config.feedChannelId}?page_size=50`,
      { headers }
    );
    if (!res.ok) return;
    const body = await res.json();
    setItems(body.entries);
    setLoaded(true);
  }, [config.knockUserId, config.feedChannelId, headers]);

  // Polling stands in for Knock's realtime socket; good enough to judge the UI.
  useEffect(() => {
    setItems([]);
    setLoaded(false);
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const mark = useCallback(
    async (status: Status, ids: string[]) => {
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      // Optimistic, so the UI reacts before the next poll.
      setItems((prev) =>
        status === "archived"
          ? prev.filter((i) => !ids.includes(i.id))
          : prev.map((i) =>
              !ids.includes(i.id)
                ? i
                : status === "read"
                  ? { ...i, read_at: now, seen_at: i.seen_at ?? now }
                  : status === "unread"
                    ? { ...i, read_at: null }
                    : { ...i, seen_at: i.seen_at ?? now }
            )
      );
      await fetch(`${KNOCK_API}/messages/batch/${status}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message_ids: ids }),
      });
    },
    [headers]
  );

  const unread = items.filter((i) => !i.read_at);
  const unseen = items.filter((i) => !i.seen_at);
  return { items, loaded, unread, unseen, mark, refresh };
}

type Feed = ReturnType<typeof useKnockFeed>;

// ─── What a Notification says, per catalogue entry ──────────────────────────

type Described = {
  icon: React.ReactNode;
  tone: string;
  actor: string;
  verb: string;
  object: string | null | undefined;
  excerpt?: string | null;
  label: string;
};

function describe(item: FeedItem): Described {
  const d = item.data;
  const actor = d.actorName ?? "Someone";
  switch (d.kind) {
    case "refund-approved":
      return { icon: <CircleCheck className="size-4" />, tone: "text-emerald-600", actor, verb: "approved your refund for", object: d.courseTitle, label: "Refund approved" };
    case "refund-declined":
      return { icon: <CircleX className="size-4" />, tone: "text-red-600", actor, verb: "declined your refund for", object: d.courseTitle, label: "Refund declined" };
    case "refund-request-new":
      return { icon: <Receipt className="size-4" />, tone: "text-amber-600", actor, verb: "requested a refund for", object: d.courseTitle, label: "Open Refund Request" };
    case "seat-claimed":
      return { icon: <UsersRound className="size-4" />, tone: "text-sky-600", actor, verb: "claimed a seat for", object: d.courseTitle, label: "Seat claimed" };
    case "new-enrollment":
      return { icon: <UserPlus className="size-4" />, tone: "text-violet-600", actor, verb: "enrolled in", object: d.courseTitle, label: "New Enrollment" };
    case "discussion-question":
      return { icon: <MessageCircleQuestion className="size-4" />, tone: "text-orange-600", actor, verb: "asked a question on", object: d.lessonTitle, excerpt: d.excerpt, label: "Discussion Question" };
    case "discussion-reply":
    default:
      return { icon: <MessageSquareReply className="size-4" />, tone: "text-primary", actor, verb: "replied to your question on", object: d.lessonTitle ?? d.courseTitle, excerpt: d.excerpt, label: "Discussion Reply" };
  }
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Sentence({ item, className }: { item: FeedItem; className?: string }) {
  const n = describe(item);
  return (
    <p className={cn("text-sm leading-snug", className)}>
      <span className="font-semibold">{n.actor}</span> {n.verb}{" "}
      {n.object && <span className="font-medium">{n.object}</span>}
    </p>
  );
}

function EmptyState({ loaded }: { loaded: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
      <Bell className="size-8 opacity-30" />
      {loaded ? "You're all caught up." : "Loading…"}
    </div>
  );
}

function useOpenItem(feed: Feed, after?: () => void) {
  const navigate = useNavigate();
  return (item: FeedItem) => {
    if (!item.read_at) feed.mark("read", [item.id]);
    after?.();
    if (item.data.url) navigate(item.data.url);
  };
}

// ─── Variant A: bell popover in the sidebar header ──────────────────────────

function VariantA({ feed }: { feed: Feed }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openItem = useOpenItem(feed, () => setOpen(false));

  // Opening the popover marks everything seen: the badge clears, the
  // per-row unread dots stay until clicked.
  useEffect(() => {
    if (open) feed.mark("seen", feed.unseen.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-5" />
        {feed.unseen.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {feed.unseen.length > 9 ? "9+" : feed.unseen.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notifications</span>
            <button
              disabled={feed.unread.length === 0}
              onClick={() => feed.mark("read", feed.unread.map((i) => i.id))}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {feed.items.length === 0 && <EmptyState loaded={feed.loaded} />}
            {feed.items.map((item) => {
              const n = describe(item);
              return (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-accent",
                    !item.read_at && "bg-primary/5"
                  )}
                >
                  <div className="relative shrink-0">
                    <UserAvatar name={n.actor} avatarUrl={item.data.actorAvatarUrl ?? null} />
                    <span className={cn("absolute -bottom-1 -right-1 rounded-full bg-popover p-0.5", n.tone)}>
                      {n.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Sentence item={item} />
                    {n.excerpt && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">“{n.excerpt}”</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.inserted_at)}</p>
                  </div>
                  {!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variant B: nav item + right-hand drawer ────────────────────────────────

function VariantBNav({ feed, onOpen }: { feed: Feed; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {feed.unread.length > 0 ? <BellDot className="size-4" /> : <Bell className="size-4" />}
      Notifications
      {feed.unread.length > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {feed.unread.length}
        </span>
      )}
    </button>
  );
}

function VariantBDrawer({ feed, open, onClose }: { feed: Feed; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const openItem = useOpenItem(feed, onClose);

  useEffect(() => {
    if (open) feed.mark("seen", feed.unseen.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = tab === "all" ? feed.items : feed.unread;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const groups = [
    { label: "Today", items: shown.filter((i) => new Date(i.inserted_at) >= startOfToday) },
    { label: "Earlier", items: shown.filter((i) => new Date(i.inserted_at) < startOfToday) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-black/30 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[26rem] flex-col border-l bg-background shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>
        <div className="flex items-center gap-1 border-b px-5 py-2">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded-full px-3 py-1 text-sm font-medium capitalize", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent")}
            >
              {t}{t === "unread" && feed.unread.length > 0 ? ` (${feed.unread.length})` : ""}
            </button>
          ))}
          <button
            disabled={feed.unread.length === 0}
            onClick={() => feed.mark("read", feed.unread.map((i) => i.id))}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Check className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 && <EmptyState loaded={feed.loaded} />}
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="sticky top-0 bg-background/95 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </h3>
              {g.items.map((item) => {
                const n = describe(item);
                return (
                  <div key={item.id} className="group relative mx-2 flex gap-3 rounded-lg px-3 py-3 hover:bg-accent">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted", n.tone)}>{n.icon}</span>
                    <button onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-xs font-semibold uppercase tracking-wide", n.tone)}>{n.label}</span>
                        <span className="text-xs text-muted-foreground">· {timeAgo(item.inserted_at)}</span>
                      </div>
                      <Sentence item={item} className={cn("mt-0.5", item.read_at && "text-muted-foreground")} />
                      {n.excerpt && (
                        <p className="mt-1.5 line-clamp-2 rounded border-l-2 pl-2 text-xs text-muted-foreground">{n.excerpt}</p>
                      )}
                    </button>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      {!item.read_at && <span className="mt-1.5 size-2 rounded-full bg-primary group-hover:hidden" />}
                      <div className="hidden flex-col gap-1 group-hover:flex">
                        <button
                          title={item.read_at ? "Mark as unread" : "Mark as read"}
                          onClick={() => feed.mark(item.read_at ? "unread" : "read", [item.id])}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          {item.read_at ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                        </button>
                        <button
                          title="Archive"
                          onClick={() => feed.mark("archived", [item.id])}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          <Archive className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─── Variant C: inbox takeover + toasts ─────────────────────────────────────

function VariantCNav({ feed, active, onToggle }: { feed: Feed; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Inbox className="size-4" />
      Inbox
      {feed.unread.length > 0 && (
        <span className="ml-auto text-xs font-semibold text-primary">{feed.unread.length} new</span>
      )}
    </button>
  );
}

function useArrivalToasts(feed: Feed, enabled: boolean, onView: () => void) {
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!feed.loaded) return;
    if (known.current === null) {
      known.current = new Set(feed.items.map((i) => i.id));
      return;
    }
    for (const item of feed.items) {
      if (known.current.has(item.id)) continue;
      known.current.add(item.id);
      if (!enabled) continue;
      const n = describe(item);
      toast(`${n.actor} ${n.verb} ${n.object ?? ""}`, {
        description: n.label,
        action: { label: "View", onClick: onView },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.items, feed.loaded]);
}

function VariantCInbox({ feed, onClose }: { feed: Feed; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const selected = feed.items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    feed.mark("seen", feed.unseen.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(item: FeedItem) {
    setSelectedId(item.id);
    if (!item.read_at) feed.mark("read", [item.id]);
  }

  return (
    <div className="fixed inset-y-0 left-56 right-0 z-30 flex bg-background">
      <div className="flex w-[24rem] shrink-0 flex-col border-r">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={feed.unread.length === 0}
              onClick={() => feed.mark("read", feed.unread.map((i) => i.id))}
            >
              Mark all read
            </Button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="size-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {feed.items.length === 0 && <EmptyState loaded={feed.loaded} />}
          {feed.items.map((item) => {
            const n = describe(item);
            return (
              <button
                key={item.id}
                onClick={() => select(item)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-l-4 px-4 py-3 text-left",
                  item.id === selectedId ? "border-l-primary bg-accent" : "border-l-transparent hover:bg-accent/50"
                )}
              >
                <span className={cn("mt-0.5", n.tone)}>{n.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", !item.read_at ? "font-semibold" : "text-muted-foreground")}>
                      {n.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.inserted_at)}</span>
                  </div>
                  <p className={cn("truncate text-xs", !item.read_at ? "text-foreground" : "text-muted-foreground")}>
                    {n.actor} · {n.object}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          (() => {
            const n = describe(selected);
            return (
              <div className="mx-auto max-w-2xl p-10">
                <span className={cn("inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold", n.tone)}>
                  {n.icon} {n.label}
                </span>
                <div className="mt-6 flex items-center gap-3">
                  <UserAvatar name={n.actor} avatarUrl={selected.data.actorAvatarUrl ?? null} className="size-10" />
                  <div>
                    <Sentence item={selected} className="text-base" />
                    <p className="text-sm text-muted-foreground">{new Date(selected.inserted_at).toLocaleString()}</p>
                  </div>
                </div>
                {n.excerpt && (
                  <blockquote className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm">{n.excerpt}</blockquote>
                )}
                <div className="mt-8 flex gap-2">
                  {selected.data.url && (
                    <Button
                      onClick={() => {
                        onClose();
                        navigate(selected.data.url!);
                      }}
                    >
                      Open
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => feed.mark("unread", [selected.id])}>Mark as unread</Button>
                  <Button variant="ghost" onClick={() => { feed.mark("archived", [selected.id]); setSelectedId(null); }}>
                    Archive
                  </Button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a Notification</div>
        )}
      </div>
    </div>
  );
}

// ─── Mount point + switcher ─────────────────────────────────────────────────

const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Right drawer" },
  { key: "C", name: "Inbox + toasts" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

function useVariant(): [VariantKey, (v: VariantKey) => void] {
  const [params, setParams] = useSearchParams();
  const fromParam = params.get("feedVariant") as VariantKey | null;
  const [stored, setStored] = useState<VariantKey>("A");
  useEffect(() => {
    try {
      const s = localStorage.getItem("prototype-feed-variant") as VariantKey | null;
      if (s) setStored(s);
    } catch {}
  }, []);
  const current = fromParam && VARIANTS.some((v) => v.key === fromParam) ? fromParam : stored;
  const set = (v: VariantKey) => {
    setStored(v);
    try {
      localStorage.setItem("prototype-feed-variant", v);
    } catch {}
    setParams((p) => { p.set("feedVariant", v); return p; }, { replace: true, preventScrollReset: true });
  };
  return [current, set];
}

/**
 * Renders the chosen variant. `slot` says where the layout is asking for UI:
 * the sidebar header, the sidebar nav, or the page overlay.
 */
export function useNotificationFeedPrototype(config: FeedConfig | null) {
  const [variant, setVariant] = useVariant();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  // Hooks can't be conditional, so feed with a dummy config when signed out.
  const feed = useKnockFeed(config ?? { knockUserId: "", publicApiKey: "", feedChannelId: "", userToken: "" });
  useArrivalToasts(feed, variant === "C", () => setInboxOpen(true));

  // Close overlays when switching variant.
  useEffect(() => { setDrawerOpen(false); setInboxOpen(false); }, [variant]);

  if (!config) return { header: null, nav: null, overlay: null, switcher: null };

  return {
    header: variant === "A" ? <VariantA feed={feed} /> : null,
    nav:
      variant === "B" ? <VariantBNav feed={feed} onOpen={() => setDrawerOpen(true)} /> :
      variant === "C" ? <VariantCNav feed={feed} active={inboxOpen} onToggle={() => setInboxOpen((o) => !o)} /> :
      null,
    overlay:
      variant === "B" ? <VariantBDrawer feed={feed} open={drawerOpen} onClose={() => setDrawerOpen(false)} /> :
      variant === "C" && inboxOpen ? <VariantCInbox feed={feed} onClose={() => setInboxOpen(false)} /> :
      null,
    switcher: import.meta.env.DEV ? <PrototypeSwitcher variant={variant} setVariant={setVariant} feed={feed} /> : null,
  };
}

function PrototypeSwitcher({ variant, setVariant, feed }: { variant: VariantKey; setVariant: (v: VariantKey) => void; feed: Feed }) {
  const seed = useFetcher<{ seeded: number }>();
  const i = VARIANTS.findIndex((v) => v.key === variant);
  const step = (d: number) => setVariant(VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (seed.data) setTimeout(feed.refresh, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.data]);

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => step(-1)} className="rounded-full p-1 hover:bg-white/15"><ChevronLeft className="size-4" /></button>
      <span className="min-w-40 text-center font-mono">
        {variant} ({VARIANTS[i].name})
      </span>
      <button onClick={() => step(1)} className="rounded-full p-1 hover:bg-white/15"><ChevronRight className="size-4" /></button>
      <span className="mx-1 h-4 w-px bg-white/25" />
      <seed.Form method="post" action="/prototype/notification-feed/seed">
        <button disabled={seed.state !== "idle"} className="rounded-full px-2 py-0.5 hover:bg-white/15 disabled:opacity-50">
          {seed.state !== "idle" ? "Seeding…" : "Seed feed"}
        </button>
      </seed.Form>
      <button
        onClick={() => feed.mark("archived", feed.items.map((x) => x.id))}
        className="rounded-full px-2 py-0.5 hover:bg-white/15"
      >
        Clear
      </button>
      <span className="pr-2 font-mono text-xs text-white/60">
        {feed.unread.length} unread · {feed.unseen.length} unseen
      </span>
    </div>
  );
}
