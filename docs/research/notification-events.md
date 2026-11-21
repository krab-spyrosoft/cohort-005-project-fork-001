# Which events in Cadence could trigger a Notification?

Research for [#3](https://github.com/krab-spyrosoft/cohort-005-project-fork-001/issues/3), part of the map [#1 In-app notifications spec](https://github.com/krab-spyrosoft/cohort-005-project-fork-001/issues/1).

This is an inventory of candidates. It does **not** choose the starter set; a later grilling ticket does that.

## Sources and code baseline

- `GLOSSARY.md`, `docs/adr/0001`–`0004` (refund rules), `app/db/schema.ts`, and every action in `app/routes/` and `app/lib/`.
- **Baseline caveat:** the refund work (`app/lib/refunds.server.ts`, `app/lib/refund-rules.ts`, `app/lib/mailer.server.ts`, `app/lib/enrollments.ts`, `app/routes/admin.refunds.tsx`), `GLOSSARY.md` and `docs/adr/` are in the local working tree of `main` but are **not committed to `origin/main`** (which still holds only `61ac877 Initial commit`). The `file:line` references below are to that working tree, read on 2026-11-21. Once the code is committed, the line numbers may move.
- I found every write point with a grep for `.insert(` / `.update(` / `.delete(` across `app/`, then traced each one to the action that calls it.

## What already notifies people today

- **Email only, and only for refunds.** `sendEmail` is called in exactly two places: after a Refund Request is raised (`app/routes/courses.$slug.refund.ts:75`) and after one is decided (`app/routes/admin.refunds.tsx:130`). The email bodies are built in `app/lib/refunds.server.ts:390-408` (raised) and `:736-781` (decided). Delivery goes through Postmark, or `.outbox/` with no token (`app/lib/mailer.server.ts:4-7`).
- A welcome email is stubbed but never sent: `// Would send welcome email here` (`app/routes/courses.$slug.purchase.tsx:173-175`, always called with `sendEmail = false` at `:371`).
- Nothing in-app exists. `_internal/feature-ideas.md:23` lists "In-App Notifications — bell icon with unread count for announcements, quiz results, coupon activity" as an idea.

## Recipients as the code sees them

- **Student**: `users.role = "student"` (`app/db/schema.ts:11-15`).
- **Instructor**: `users.role = "instructor"`; owns a course through `courses.instructorId` (`schema.ts:73-75`).
- **Platform Admin**: `users.role = "admin"`. Only role that can decide a Refund Request (`app/routes/admin.refunds.tsx:56,95`). Also sees the unanswered-questions queue for every course (`app/routes/instructor.questions.tsx:72-74,175`).
- **Team Admin**: a `team_members` row with `role = "admin"` (`schema.ts:40-43,266-278`), created on the user's first Team Licence purchase (`app/routes/courses.$slug.purchase.tsx:210-220`). The code calls Seats "coupons" (`schema.ts:280-300`).
- **The buyer** of a Purchase (`purchases.userId`) is a Student for an Individual Purchase and a Team Admin for a Team Licence. A Purchase is a Team Licence if it has Seats (`kindOf(getSeats(...))`, `refunds.server.ts:336,393`).

## Inventory

"NI" means not implemented yet: the glossary or a constant describes it, but no code makes it happen.

### Refunds

| # | Event | Trigger | Recipient(s) | Where | Data a Notification would need |
|---|---|---|---|---|---|
| R1 | Refund Request raised | Buyer submits a reason for one Purchase (from the course page for an Individual Purchase, from the team page for a Team Licence). Refused outright if it breaks a rule (`refunds.server.ts:305`). | Platform Admin (something to decide); buyer: Student or Team Admin (confirmation; already emailed) | `app/lib/refunds.server.ts:357-409` (insert `:379-388`), called from `app/routes/courses.$slug.refund.ts:63-75` | Refund Request id, Purchase id + kind, course (title, slug), buyer (name), amount paid, reason |
| R2 | Refund Request approved | Platform Admin approves an Open Refund Request | Buyer: Student or Team Admin (already emailed) | `app/lib/refunds.server.ts:614-685` (status update `:669-678`), called from `app/routes/admin.refunds.tsx:110-130` | Refund Request id, course, amount refunded (= amount paid), Platform Admin's optional decision note, what was ended (Enrollment, or Unclaimed Seats) |
| R3 | Refund Request declined | Platform Admin declines an Open Refund Request; the note is required | Buyer: Student or Team Admin (already emailed). For a Team Licence, its Unclaimed Seats can be claimed again (ADR 0003). | `app/lib/refunds.server.ts:692-733` (status update `:713-721`), called from `app/routes/admin.refunds.tsx:117-130` | Refund Request id, course, decision note, whether the buyer may raise a new Refund Request (always yes) |
| R4 | Enrollment ends (Student becomes Lapsed) | Side effect of R2 on an Individual Purchase, unless the buyer also holds a Claimed Seat for that course (ADR 0002, 0004). The only path in the code that ends an Enrollment. | Student (lost Enrollment, kept progress per ADR 0001); Instructor (their roster now shows a Lapsed Student, `app/lib/enrollments.ts:2`) | `app/lib/refunds.server.ts:645-666` (delete `:658-665`) | Course, Student, the fact that progress is kept |
| R5 | Refund issued (Issued Refund) | Money confirmed as sent back | Buyer: Student or Team Admin | **NI.** `refunds.status` has only `open` / `approved` / `declined` (`schema.ts:34-38`); no column records Pending, Issued or Failed Refunds, and no code moves money. The approval email already says the money "is on its way back to you" (`refunds.server.ts:760`). | Refund Request id, course, amount, date issued |
| R6 | Refund failed (Failed Refund) | Money could not be sent; the Refund Request stays approved | Buyer: Student or Team Admin; Platform Admin (needs to act) | **NI**, same reason as R5 | Refund Request id, course, amount, failure reason |
| R7 | Refund Request already decided by another Platform Admin | A second Platform Admin tries to decide it and gets a 409 | Platform Admin (other admins could be told, so their queue stays current) | `app/lib/refunds.server.ts:587-595` | Refund Request id, who decided it, decision |

### Purchases, Seats and Enrollment

| # | Event | Trigger | Recipient(s) | Where | Data |
|---|---|---|---|---|---|
| P1 | Individual Purchase made (new Enrollment) | Student confirms a purchase for themselves | Student (welcome; email stubbed, not sent); Instructor (new sale and new Student) | `app/routes/courses.$slug.purchase.tsx:366-372` (purchase insert `:186-190`, Enrollment insert `:167-171`) | Purchase id, course, Student, amount paid (cents, ADR 0005), country |
| P2 | Team Licence purchased | Buyer confirms a team purchase of N Seats; buyer becomes Team Admin and gets no Enrollment | Team Admin (Seats are ready to share); Instructor (new sale) | `app/routes/courses.$slug.purchase.tsx:375-379` → `createTeamPurchase` `:245-256` (Seats generated `:222-243`) | Purchase id, course, number of Seats, amount paid, link to `/team` |
| P3 | Seat claimed (new Enrollment) | A Student redeems a Seat link | Claiming Student (welcome); Team Admin (a Seat was claimed, X of Y used, and it makes the Team Licence unrefundable per glossary); Instructor (new Student) | `app/routes/redeem.$code.tsx:47-113` (Seat update `:98-104`, Enrollment insert `:106-110`), action `:185-212` | Seat id, Team Licence (Purchase) id, course, claiming Student, claimed/total Seats |
| P4 | Course completed | Student finishes a course | Student; Instructor | **NI.** `enrollments.completedAt` exists (`schema.ts:134`) and is read (`app/routes/dashboard.tsx:213`, `app/routes/instructor.$courseId.tsx:375`) but nothing ever writes it | Course, Student, completion date |
| P5 | Lesson marked complete | Student clicks "mark complete" | Student (milestone; weak) | `app/routes/courses.$slug.lessons.$lessonId.tsx:947-950` → `markLessonComplete` `:218-243` | Lesson, course, progress count |

Seat claims refused while a Refund Request is Open, or after a Team Licence refund (`app/routes/redeem.$code.tsx:61-67`), are shown to the claiming Student inline; nothing records them.

### Quizzes

| # | Event | Trigger | Recipient(s) | Where | Data |
|---|---|---|---|---|---|
| L1 | Quiz attempt submitted (passed or failed) | Student submits answers | Student (result already shown inline); Instructor | `app/routes/courses.$slug.lessons.$lessonId.tsx:952-976` → `computeResult` `:531-640` (attempt insert `:602-611`) | Quiz, lesson, course, score, passed. Note: `passed` is `score > 0.7` (`:599`), not the quiz's `passingScore` |
| L2 | Quiz replaced or deleted, removing Students' attempts | Instructor saves a new quiz over an old one, or deletes it; `deleteQuiz` deletes every attempt and answer | Students who had attempted it | `app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx:386-430` → `deleteQuiz` `:201-219` | Quiz, lesson, course |

### Questions and comments

A "question" is a top-level lesson comment by someone who isn't staff. It counts as unanswered until the course's Instructor or a Platform Admin replies (`app/routes/instructor.questions.tsx:42-70`).

| # | Event | Trigger | Recipient(s) | Where | Data |
|---|---|---|---|---|---|
| Q1 | Student question asked | Non-staff posts a top-level comment on a lesson | Instructor who owns the course; Platform Admin (sees every course's queue) | `app/routes/courses.$slug.lessons.$lessonId.tsx:898-909` → `createComment` `:404-435` (insert `:430-434`) | Comment id, body excerpt, lesson, course, author |
| Q2 | Question answered | Instructor or Platform Admin replies, from the questions queue or the lesson page | Student who asked | `app/routes/instructor.questions.tsx:188-224` (`createComment` `:118-157`); also the lesson route `:898-909` with a `parentId` | Question id, reply excerpt, replier, lesson, course |
| Q3 | Reply to your comment | Anyone (often another Student) replies to a top-level comment | Author of the parent comment (any role, usually a Student) | `app/routes/courses.$slug.lessons.$lessonId.tsx:898-909` with `parentId` (one level deep, `:417-428`) | Parent comment, reply excerpt, replier, lesson, course |
| Q4 | Comment removed by staff | Instructor or Platform Admin soft-deletes someone else's comment | Comment author | `app/routes/courses.$slug.lessons.$lessonId.tsx:935` → `deleteComment` `:459-477` (`isStaff` check `:464`) | Comment, lesson, course |

### Course content

Lessons and modules have no draft or published state of their own (`schema.ts:93-119`). A new lesson shows up straight away, usually as a title with no content. So "new lesson published" can't be told apart from "lesson created" until such a state exists.

| # | Event | Trigger | Recipient(s) | Where | Data |
|---|---|---|---|---|---|
| C1 | Course published | Status set to `published` (new courses start as `draft`, `app/routes/instructor.new.tsx:68`) | Instructor (when a Platform Admin changed it); Platform Admin (when an Instructor published) | `app/routes/instructor.$courseId.tsx:695-698` (`updateCourseStatus` `:154-160`); `app/routes/admin.courses.tsx:141-144` (`:76-83`) | Course, old/new status, who changed it |
| C2 | Course archived or unpublished | Status set to `archived` or back to `draft` | Students with an Enrollment; Instructor (when a Platform Admin changed it) | Same as C1 | Course, new status |
| C3 | New lesson added | Instructor adds a lesson to a module | Students with an Enrollment (when the course is published) | `app/routes/instructor.$courseId.tsx:753-763` → `createLesson` `:265-293` | Lesson, module, course |
| C4 | New module added | Instructor adds a module | Students with an Enrollment | `app/routes/instructor.$courseId.tsx:722-725` → `createModule` `:207-225` | Module, course |
| C5 | Lesson content updated (e.g. video added) | Instructor edits title, content, video, duration or repo link | Students with an Enrollment | `app/routes/instructor.$courseId.lessons.$lessonId.tsx:226` → `updateLesson` `:66-91` | Lesson, course, which fields changed |
| C6 | Lesson or module deleted | Instructor deletes it | Students with an Enrollment (especially those with progress on it) | `app/routes/instructor.$courseId.tsx:740-751` (`deleteModule` `:236-240`), `:827-840` (`deleteLesson` `:304-306`) | Lesson/module title, course |
| C7 | Quiz added to a lesson | Instructor saves a quiz | Students with an Enrollment | `app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx:386-424` (`createQuiz` `:172-180`) | Quiz, lesson, course |

### Ratings and accounts

| # | Event | Trigger | Recipient(s) | Where | Data |
|---|---|---|---|---|---|
| X1 | Course rated | Student rates a course 1–5 (or changes their rating) | Instructor | `app/routes/courses.$slug.tsx:478` → `rateCourse` `:330-363` | Course, rating, Student |
| A1 | Role changed | Platform Admin changes a user's role | The affected user (e.g. a Student who is now an Instructor) | `app/routes/admin.users.tsx:128` → `updateUserRole` `:60-67` | Old/new role |
| A2 | Profile edited by a Platform Admin | Platform Admin changes a user's name or email | The affected user | `app/routes/admin.users.tsx:122` → `updateUser` `:46-58` | Changed fields |
| A3 | New Student signed up | Someone creates an account | Platform Admin (weak) | `app/routes/signup.tsx:76-81` | User |
| A4 | New course created | Instructor creates a course (as a draft) | Platform Admin (weak) | `app/routes/instructor.new.tsx:149` → `createCourse` `:46-73` | Course, Instructor |

### Time-based (none implemented)

Cadence has no scheduler or background job (one server process, ADR 0006). Each of these would need one.

| # | Event | Recipient(s) | Basis in the code |
|---|---|---|---|
| T1 | Refund window about to close | Buyer: Student or Team Admin | `REFUND_WINDOW_DAYS = 14` (`app/lib/refund-rules.ts:5`), counted in calendar days (`refunds.server.ts:44-56`) |
| T2 | Close to the Watch Limit | Student | `REFUND_WATCH_LIMIT_SECONDS = 3600` (`refund-rules.ts:6`); also the 50% completion limit (`:7`). Watch time grows through `app/routes/api.video-tracking.ts:30` |
| T3 | Question unanswered for 3+ days | Instructor; Platform Admin | `STALE_AFTER_DAYS = 3` (`app/routes/instructor.questions.tsx:160`), used only for visual call-out today |
| T4 | Open Refund Request waiting a long time | Platform Admin | Nothing; the admin queue lists oldest first (`app/routes/admin.refunds.tsx:164`) |

### Writes with no obvious recipient

These change data, but nobody else has a reason to hear about them: lesson progress and video watch events (`courses.$slug.lessons.$lessonId.tsx:218-268`, `api.video-tracking.ts:30`), comment edits (`:912-924`), reordering or moving modules and lessons (`instructor.$courseId.tsx:242-357`), course title, description, sales copy, price and PPP changes (`:145-192`), category CRUD (`admin.categories.tsx:90-132`), and a user editing their own settings (`settings.tsx:66-92`).

## Count by recipient

34 candidate events (27 implemented, 7 NI: R5, R6, P4, T1–T4). Many have more than one recipient, so the counts overlap.

| Recipient | Events | Count |
|---|---|---|
| Student | R1, R2, R3, R4, R5, R6, P1, P3, P4, P5, L1, L2, Q2, Q3, Q4, C2, C3, C4, C5, C6, C7, A1, A2, T1, T2 | 25 |
| Instructor | R4, P1, P2, P3, P4, L1, Q1, C1, C2, X1, A1, A2, T3 | 13 |
| Platform Admin | R1, R6, R7, Q1, C1, A3, A4, T3, T4 | 9 |
| Team Admin | R1, R2, R3, R5, R6, P2, P3, T1 | 8 |

## Things the spec will have to deal with

- **No Refund money-movement states.** Glossary terms Pending Refund, Issued Refund and Failed Refund have no columns or code behind them. A notification for R5 or R6 needs that model first.
- **No course completion.** `enrollments.completedAt` is never written, so P4 needs a rule for when a course counts as complete.
- **No lesson publish state**, so C3–C5 would fire on half-built lessons unless only published courses count, or a state is added.
- **Recipients that fan out.** C2–C7 go to every Student with an Enrollment on the course. R1 and Q1 go to every Platform Admin.
- **Refund events already have emails.** R1–R3 already go out as emails with copy (`refunds.server.ts:390-408,736-781`). An in-app Notification could reuse the same trigger points.
