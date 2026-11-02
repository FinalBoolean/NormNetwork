# Norm's Network

## Description
Welcome to Norm's Network, a hub for UNCC Students who are looking for people to talk to. Whether it be as a study buddy, a gaming partner, or a friend, NormsNetwork allows UNCC students to create a main profile for finding friends and navigate other parts of app to find the specific part they want and add information depending on the section they chose. Unlike other UNCC social networks, NormsNetwork seamlessly blends everything in one place so UNCC students don’t have to go searching through tons of different apps to try and find people to communicate with.

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
- **Node.js 22+**
- **PostgreSQL 17**
- **Kysely**
- **Docker Compose for local PostgreSQL**
- **Node's test runner + PGLite for local testing**
- **GitHub Actions for automated tests against PostgreSQL**

## Setup/Run Instructions
### 1. Clone the repository
git clone https://github.com/FinalBoolean/NormNetwork.git
cd NormNetwork

### 2. Install dependencies
npm install

### 3. Set up environment variables
cp .env.example .env

### 4. Start the local PostgreSQL database
npm run db:up

### 5. Run database migrations
npm run db:migrate

### 6. Start the development server
npm run dev
Then, open http://localhost:3000/ in your browser.


### Running Tests
npm test

Tests run against an in-memory PostgreSQL (PGlite) locally and a real PostgreSQL in CI. Test files run one at a time because in CI they share a database.

## Accounts and authentication
- **Sign up** at `/signup` with a username, a UNC Charlotte email (`@charlotte.edu` or `@uncc.edu`, configurable with `ALLOWED_EMAIL_DOMAINS`), and a password of at least 8 characters. Emails and usernames are unique regardless of letter case.
- **Log in** at `/login` with your email or username. **Log out** with the button in the nav (a `POST /logout`).
- Passwords are hashed with scrypt (built into Node). Sessions are stored in the `sessions` table (migration 010); the browser only holds a random token in an `HttpOnly`, `SameSite=Lax` cookie, and the database only stores a SHA-256 hash of it. Sessions last 7 days.
- Cross-site form posts are rejected with 403.

### Using auth in routes
- `req.user` is the logged-in user (`{ id, username, email }`) or `null`. Templates can read it as `currentUser`.
- Put `requireAuth` (from `middleware/auth.js`) in front of routes that need a login. Browsers are redirected to `/login?next=...` and returned afterwards; JSON clients get a 401. `/profile` and `/friends` already use it.

```js
import { requireAuth } from "../middleware/auth.js";
router.get("/edit", requireAuth, (req, res) => { /* req.user.id */ });
```

### Stopping the Database
docker compose down