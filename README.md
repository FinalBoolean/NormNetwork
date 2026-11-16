# Norm's Network

## Description
Welcome to Norm's Network, a hub for UNCC Students who are looking for people to talk to. Whether it be as a study buddy, a gaming partner, or a friend, NormsNetwork allows UNCC students to create a main profile for finding friends and navigate other parts of app to find the specific part they want and add information depending on the section they chose. Unlike other UNCC social networks, NormsNetwork seamlessly blends everything in one place so UNCC students don't have to go searching through tons of different apps to try and find people to communicate with.

## Sprint 2 Progress

Sprint 1 set up the database, the Express server, and placeholder pages. Sprint 2 turned that into a working app: students can now create an account, sign in, and build a profile, and every main page has a finished design.

### Completed this sprint

**Accounts and authentication** (PR #35)
- Sign up with a UNC Charlotte email (`@charlotte.edu` or `@uncc.edu`), a unique username, and a password of at least 8 characters
- Log in with either your email or your username, and log out from the navigation bar
- Passwords are hashed with scrypt, and sessions are saved in a new `sessions` table and last 7 days
- Pages that need an account (`/profile`, `/friends`) send logged-out visitors to the login page, then back to the page they wanted
- Security checks: cross-site form posts are blocked, and a failed login never reveals whether an account exists

**React and TypeScript migration** (PR #36)
- Converted the whole app from JavaScript to TypeScript in strict mode
- Pages are now React components rendered on the server and hydrated in the browser, with Vite building the frontend assets
- Fixed a development server restart loop

**App screens and design** (PR #37)
- New sign-up and log-in screens
- Home page that links to each part of the app
- Designed pages for the Friend Finder, Study Buddy Finder, Gaming Partner Finder, Public Threads, and Friends, with top and bottom navigation

**Profiles** (PR #38)
- Create, view, edit, and delete your main profile at `/profile`
- Profile fields: age, class standing, gender, major, bio, and an uploaded profile photo
- The form is checked on the server and keeps what you typed when a field needs fixing
- JSON API for profiles: `GET`, `POST`, `PATCH`, and `DELETE /profile`

**Testing and automation**
- 71 automated tests covering sign-up, login, sessions, logout, security checks, page rendering, profiles, and database migrations
- GitHub Actions builds the app and runs every test against PostgreSQL 17 on each push and pull request
- `/health` endpoint reports whether the server can reach the database

### Feature status

| Page | Route | Status |
|---|---|---|
| Sign up / Log in | `/signup`, `/login` | Working |
| Home | `/` | Working |
| Profile | `/profile` | Working, saves to the database (login required) |
| What you're looking for | `/profile/companions` | Working, saves to the database (login required) |
| Study partner profile | `/profile/study` | Working, saves to the database (login required) |
| Gaming partner profile | `/profile/gaming` | Working, saves to the database (login required) |
| Dating preferences | `/profile/dating` | Working, 18+ only (login required) |
| Discover | `/discover` | Search student profiles and send connection requests (login required) |
| Friend Finder | `/finder/friends` | Design complete, shows sample data |
| Study Buddy Finder | `/finder/study` | Working: real students, search, and course filters (login required) |
| Gaming Partner Finder | `/finder/gaming` | Working: real students, search, and game and platform filters (login required) |
| Public Threads | `/threads` | Design complete, shows sample data |
| Friends | `/friends` | Incoming and sent requests, accept/decline, and accepted friends (login required) |

### Still to build
- Connect the Friend Finder to its database table (`friend_finder`: interests and hangouts)
- Show real students on the Friend Finder, like the Study Buddy and Gaming Partner finders now do
- A way to reach a study buddy or gaming partner you find (for example, sending a friend request from their card)
- Posting threads and replies (`threads`, `threads_reply` tables)
- Pronouns and concentration on the profile, which are listed in Intended Features but not in the form yet

## Intended Features
 ### Account & Verification
 - Sign-up with your verified UNC Charlotte email to ensure that only real UNCC students can join
 - Create a unique username and secure password.

 ### Main Profile
 - Profile picture
 - Personal Bio
 - Age, Gender, Pronouns
 - Class Standing
 - Major (option for concentration as well, if applicable)

 ### Finders for specialized interests (e.g. Study, Friend, Gaming)
 - Study Buddy finder: Input your subject, course, and additional info about what you need help with.
 - Gaming Partner finder: Input games you play, rank (or unranked), main character, main role, along with other important info for finding points of connection with other gamers. 
 - Friend Finder: Input hobbies/interests you have, places you like to go, and have the ability to filter by interests when looking for friends to make.

 ### Public Threads
 - Post public threads under a category (Study, Gaming, Friends, etc.) with a title and body.
 - Other students reply with thread posts, so you can find someone even if you don't know exactly where to look.
 - Ability to react to threads with likes and emoji reactions.
 - Threads track when they were created and last updated.

 ### Friend System
 - Send a friend request to another student.
 - Requests have a status (e.g., pending, accepted, declined) so senders and receivers can keep track.
 - Accepted requests will be added to your friends list.


## Technology Stack
- **Node.js 22.12+ and TypeScript (strict mode)**
- **React server-rendered pages with browser hydration; Vite for frontend assets**
- **Express 5 for routing and authentication**
- **PostgreSQL 17**
- **Kysely**
- **Docker Compose for local PostgreSQL**
- **Node's test runner + PGLite for local testing**
- **GitHub Actions for automated tests against PostgreSQL**

## Database

The database has thirteen tables, created by the migrations in `migrations/`:

| Table | Purpose |
|---|---|
| `users` | Accounts: username, email, and password hash |
| `profiles` | Each student's main profile, including who can see it |
| `profile_photos` | Validated profile photo uploads |
| `companion_types` | What each student is looking for: friends, study, gaming, dating |
| `friend_finder` | Friend Finder entries |
| `study_finder` | Study partner profiles |
| `gaming_finder` | Gaming partner profiles |
| `dating_preferences` | Dating preferences (18+ only) |
| `threads` | Public threads |
| `threads_reply` | Replies to threads |
| `friend_request` | Friend requests and their status |
| `friends` | Accepted friendships |
| `sessions` | Login sessions (added in Sprint 2) |

![Entity relationship diagram](erd.png)

The diagram was made in Sprint 1, so it doesn't show the `sessions`, `profile_photos`, `companion_types`, or `dating_preferences` tables,
or the columns migrations 013 and 014 added to `study_finder` and `gaming_finder`.

## Setup/Run Instructions
### 1. Clone the repository
```bash
git clone https://github.com/FinalBoolean/NormNetwork.git
cd NormNetwork
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```

### 4. Start the local PostgreSQL database
```bash
npm run db:up
```

### 5. Run database migrations
```bash
npm run db:migrate
```

### 6. Start the development server
```bash
npm run dev
```
Then, open http://localhost:3000/ in your browser.


### Running Tests
```bash
npm test
```

Tests run against an in-memory PostgreSQL (PGlite) locally and a real PostgreSQL in CI. Test files run one at a time because in CI they share a database.

## Accounts and authentication
- **Sign up** at `/signup` with a username, a UNC Charlotte email (`@charlotte.edu` or `@uncc.edu`, configurable with `ALLOWED_EMAIL_DOMAINS`), and a password of at least 8 characters. Emails and usernames are unique regardless of letter case.
- **Log in** at `/login` with your email or username. **Log out** with the button in the nav (a `POST /logout`).
- Passwords are hashed with scrypt (built into Node). Sessions are stored in the `sessions` table (migration 010); the browser only holds a random token in an `HttpOnly`, `SameSite=Lax` cookie, and the database only stores a SHA-256 hash of it. Sessions last 7 days.
- Cross-site form posts are rejected with 403.

### Using auth in routes
- `req.user` is the logged-in user (`{ id, username, email }`) or `null`. React pages receive it as `currentUser`.
- Put `requireAuth` (from `middleware/auth.ts`) in front of routes that need a login. Browsers are redirected to `/login?next=...` and returned afterwards; JSON clients get a 401. `/profile` and `/friends` already use it.

```ts
import { requireAuth } from "../middleware/auth.js";
router.get("/edit", requireAuth, (req, res) => { /* req.user.id */ });
```

### Stopping the Database
```bash
npm run db:down
```

Other database commands:
- `npm run db:status`: show which migrations have been applied
- `npm run db:rollback`: undo the most recent migration

## React and TypeScript development

`npm run dev` runs Express and Vite together at http://localhost:3000 (or `PORT`).
React components live in `src/App.tsx`; Express routes render them through
`lib/render.tsx`. Forms keep their existing POST/redirect behavior and work even
without JavaScript. `src/main.tsx` hydrates the server-rendered page in the browser.
The existing styling lives in `public/css/styles.css`.

- `npm run typecheck`: check frontend, server, migrations, and tests.
- `npm run build`: typecheck and build browser assets into `dist/`.
- `npm test`: run authentication, page, and migration tests.
- Production: run `npm run build`, then set `NODE_ENV=production` and run `npm start`.
  Deploy the source, `public/`, `dist/`, and production dependencies (including `tsx`).
  Production sessions require HTTPS because cookies are Secure.

Database code stays server-side. Never import `db/` into browser components or
expose `DATABASE_URL` in a `VITE_` variable. `db/types.ts` describes the current
schema; historical migrations use `Kysely<unknown>` independently of that schema.
Existing migration basenames are unchanged, so databases keep their
migration history. Migration 011 adds storage for uploaded profile photos. Migration 017 adds profile privacy settings. Run `npm run db:migrate` to apply any pending migrations.

Tests default to isolated PGlite databases. Only point `TEST_DATABASE_URL` at a
dedicated disposable database: the tests roll back the entire schema.


## Profiles

After signing in, open **You** (`/profile`) to create your profile. Saved profiles
show your own details; **Edit profile** opens the form again. Forms validate on
the server and keep entered values when a field needs correction.

The profile routes use the signed-in session's user ID, never an ID supplied in
the request body. API clients should send `Accept: application/json`:

- `GET /profile`: current profile, or 404 if one has not been created.
- `POST /profile`: create a profile; duplicates return 409.
- `PATCH /profile`: update supplied fields; empty updates return 400.
- `DELETE /profile`: delete the current profile. Existing database cascades also
  remove its related finder records, threads/replies, and friendships/requests.

Required creation fields are `age`, `class`, `gender`, and `major`; `bio` is optional.
Age must be an integer from 16 to 100. Class standing and gender must match the
shared choices in `src/profile.ts`. Major uses a searchable selection validated
against `src/majors.ts` (plus the explicit Undecided status). HTML forms use `POST /profile`
for creation and `POST /profile/edit` for updates, then redirect to the saved page.
After saving a profile, upload a photo using the profile page's file picker.
`POST /profile/photo` accepts one multipart field named `photo`: JPEG, PNG, or
WebP, at most 5 MiB and 20 million pixels. The server decodes the content, rejects
corrupt/animated/unsupported images, applies orientation, resizes to fit 1024 x
1024, and re-encodes as WebP without metadata. The processed bytes are stored in
PostgreSQL (`profile_photos`) and cascade-delete with the profile. A replacement
is atomic and failed uploads preserve the old photo. `GET /profile/photo` serves
the signed-in user's photo with private/no-store caching. The existing API's
external photo URL input remains supported for compatibility; the UI uses uploads.

Run `npm run db:migrate` before uploading photos. This is file validation, not
content moderation or verification that the photo depicts the account owner.
Hangouts and interests are not part of this profile form.

### Profile privacy

A profile's `visibility` controls who can open it:

- **Only me** (the default, including profiles created before this setting existed): other students get the same 404 as a missing profile, and the photo is not served to them.
- **Campus**: any signed-in student can open `/users/:username`.
- **Friends**: other students see the username, class standing, major, and photo. Age, gender, and bio are included only after a friendship is accepted.

`show_age`, `show_gender`, and `show_bio` hide those details from everyone except the owner, including friends. Major, class standing, username, and photo stay visible whenever the profile itself is visible. Email is never included. Unknown visibility values are treated as private. You always see and edit your full profile at `/profile`.

`GET /users/:username` returns that view as HTML, or as JSON with `Accept: application/json`. `GET /users/:username/photo` serves an uploaded photo only when the viewer is allowed to open the profile. Both routes require a login. Opening your own username in a browser returns you to `/profile`.

Major choices are a checked-in snapshot of UNC Charlotte's official bachelor's,
master's and doctoral program titles, with duplicates and certificates excluded:
https://assessment.charlotte.edu/accreditation/sacscoc/program-list-with-cip-codes
The source and retrieval date are recorded in `src/majors.ts`; refresh the list
when the university changes its offerings.

## What you're looking for, and partner profiles

After saving a main profile, students choose what they're looking for at
`/profile/companions`: **Friends**, **Study partners**, **Gaming partners**, and/or
**Dating** (any combination, at least one). New profiles are sent there right after
they're created. The profile page shows the choices and a card for each partner
profile, with its status: **On**, **Not set up**, or **Paused** (turned off, details kept).

Partner profiles hold the details for each companion type:

| Profile | Page | Fields |
|---|---|---|
| Study partner | `/profile/study` | subject, courses (up to 5 codes like `ITSC 3155`), what you need help with, when you can meet, favorite study spot |
| Gaming partner | `/profile/gaming` | games (up to 5), platforms, rank (blank = unranked), main role, main character, play style, comms, when you play |
| Dating preferences | `/profile/dating` | interested in, youngest and oldest age (18–100), looking for |

- Saving one of these profiles turns its companion type on. **Remove** deletes it and
  turns the type off. Unchecking a type on `/profile/companions` only pauses it.
- **Dating is 18+ only.** Students under 18 can't choose Dating, open its page, or save
  preferences (403). If a profile edit sets the age below 18, dating preferences are
  deleted and Dating is turned off in the same transaction. The database also requires
  dating age ranges to be within 18–100.
- Lists (courses, games, platforms, interested in) are stored as comma-separated text,
  cleaned up on save: course codes are normalized to `ITSC 3155`, duplicates are removed,
  and "Everyone" replaces the other "interested in" choices.
  Choices and limits are shared between the forms and the server in
  `src/companions.ts`; server checks are in `lib/companion-validation.ts`.

JSON API (send `Accept: application/json`; all routes use the signed-in user and need a
saved main profile, otherwise writes return 409):

- `GET /profile/companions`: `{ "companion_types": ["friends", "study"] }`
- `PUT /profile/companions`: replace the choices with `{ "companion_types": [...] }`
  (an array or a comma-separated string)
- `GET`, `PUT`, `DELETE /profile/study`, `/profile/gaming`, `/profile/dating`: read,
  create or replace, and remove each profile. `GET` returns 404 until one is saved.

HTML forms `POST` to the same paths and to `/profile/<type>/delete`, then redirect to
`/profile`. Run `npm run db:migrate` to apply the new migrations before using these pages.

## Study Buddy Finder

`/finder/study` (login required) lists students who have a study partner profile
with **Study partners** turned on. Your own card is never shown, and paused profiles
stay hidden until they're turned back on. Students who share the most courses with
you come first, then alphabetically by username. Each card shows the student's
username, class standing, major, bio, courses (the shared ones under **WE SHARE**),
subject, availability, meeting place, and what they want help with.

- **Search** (`?q=`) matches subject, courses, major, username, and "looking for help
  with". Typing a course code in any format (`itsc3155`) also finds that course.
- **Course filter** (`?course=`) shows only students taking that course. Your own
  courses appear as quick-filter chips. Codes are normalized the same way as the study
  profile form (`itsc-3155` becomes `ITSC 3155`); anything else returns 400.
- **Pages** (`?page=`) show 10 students at a time.
- **Privacy:** cards never include email, age, or gender. Only photos uploaded to
  Norm's Network are shown, through `GET /finder/study/:userId/photo`, which returns
  404 unless that student can currently be found on the finder. External photo URLs
  are never shown to other students.

JSON API: send `Accept: application/json` to `GET /finder/study` (same query
parameters) for `{ "results": [...], "page": 1, "has_more": false, "q": "", "course": "" }`.
The query code is in `lib/study-finder.ts`, the route in `routes/finder.ts`, and the
page in `src/StudyFinder.tsx`.

## Gaming Partner Finder

`/finder/gaming` (login required) works like the Study Buddy Finder, using gaming
partner profiles. It lists students who have a gaming partner profile with **Gaming
partners** turned on, never yourself, and hides paused profiles. Students who play the
most of your games come first (game names match in any letter case), then those on
the most of your platforms, then alphabetically by username. Each card shows rank
("Unranked" if blank), comms and when they play, the games you both play, their other
games, role, main character, play style, and platforms.

- **Search** (`?q=`) matches games, platforms, rank, role, main character, play style,
  when they play, major, and username.
- **Game filter** (`?game=`) shows only students who play that game, in any letter case
  (your own games are quick-filter chips). **Platform filter** (`?platform=`) must be
  one of PC, PlayStation, Xbox, Nintendo Switch, or Mobile; anything else returns 400.
- **Pages** (`?page=`) show 10 students at a time.
- **Privacy:** the same rules as the Study Buddy Finder. Photos come from
  `GET /finder/gaming/:userId/photo`, which returns 404 unless that student can
  currently be found on the Gaming Partner Finder.

JSON API: send `Accept: application/json` to `GET /finder/gaming` for
`{ "results": [...], "page": 1, "has_more": false, "q": "", "game": "", "platform": "" }`.
The query code is in `lib/gaming-finder.ts` (search helpers shared with the study finder
are in `lib/finder-query.ts`), the route in `routes/finder.ts`, and the page in
`src/GamingFinder.tsx`.

## User discovery and connections

Open **Discover** (`/discover`) after signing in to browse saved student profiles.
Search by username, major, or bio; results show 12 profiles per page and exclude
your own account. Create your profile at `/profile` before sending or responding
to requests. Uploaded profile photos are served through authenticated discovery
URLs; other students' email addresses and account credentials are never included
in discovery results.

**Connect** sends a request. Both students can see its status in Discover and
**Friends** (`/friends`); the recipient can accept or decline it. Accepting adds
each student to the other's circle. Sending the same pending request again does
not duplicate it, and an incoming request must be answered before sending one
back. These forms also work without JavaScript.

For JSON responses, send `Accept: application/json`:

- `GET /discover?q=biology&page=1`: profiles, relationship states, and pagination.
- `GET /friends`: incoming requests, outgoing requests, and accepted friends.
- `GET /friends/request`: PR #44's incoming-request list, including each request
  ID and sender's profile details.
- `GET /friends/list`: PR #44's accepted-friends list.
- `POST /friends/requests/:profileId`: PR #44's request endpoint, used by
  Discover's Connect forms. JSON clients receive `{ "message": "Friend request sent!",
  "requestId": 123 }`. HTML forms return to Discover or Friends after sending.
- `POST /friends/requests` with `{ "receiver_id": 123 }`: send a request to that
  **profile ID** (not an account ID).
- `POST /friends/requests/:id/accept` or `/decline`: respond to a pending request
  addressed to the signed-in student's profile.

Run `npm run db:migrate` before using connections: migration 016 from PR #45
enforces valid request statuses, prevents self-requests, and allows only one
pending request per pair. PR #44's routes and list queries are retained alongside
PR #45's request API; both send routes use the same transaction-safe helper, and
the Friends page uses the shared list queries. Uploaded photos in both list APIs
use the listed student's authenticated photo URL.

Run `npm test` for discovery, connection, authentication, profile, and migration
coverage, and `npm run build` for TypeScript and browser-build validation. Study
and gaming finders show real students; the specialized Friend Finder remains a
sample screen.

## Team

- [@FinalBoolean](https://github.com/FinalBoolean)
- [@zagog629](https://github.com/zagog629)
- [@wilmer-4](https://github.com/wilmer-4)
- [@scoobig](https://github.com/scoobig)
- [@elephantcubed](https://github.com/elephantcubed)
