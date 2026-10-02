# TechSkill Academy — Website + Portals (Netlify-Ready)

A complete, deployable web platform for **TechSkill Academy**, Millennium Housing Estate, Ginti, Ikorodu, Lagos.

- 🌐 **Public website** — home, courses (all 6 tracks, all levels), about, contact/enrollment form
- 📝 **Student self-signup** — students register themselves at `#/signup` (auto matric number, light per-IP rate limiting) and sign in immediately
- 🎓 **Student portal** — profile + passport photo, class enrollment, downloadable course materials, assessments & grades (Nigerian grading scale), change own password
- 👨‍🏫 **Facilitator portal** — upload topic materials, create assessments, grade all submissions, view student records & passports
- 🛠️ **Admin portal** — create/edit/delete student & facilitator accounts, reset passwords, manage classes & enrollment, read contact-form messages, and change its own password via **My Profile**

**Stack:** static vanilla-JS frontend (no build step) + Netlify Functions (API) + Netlify Blobs (database & file storage). No external database or service required — everything runs on Netlify's free tier.

---

## 📁 Project structure

```
techskill-academy/
├── public/                  ← the website (published as-is)
│   ├── index.html           ← single-page app shell
│   ├── css/styles.css       ← design system
│   ├── js/                  ← app + views (home, courses, login, portals…)
│   └── assets/              ← logo, hero & about images
├── netlify/functions/
│   ├── api.mjs              ← the entire backend API (one function)
│   └── _shared/             ← store, auth, seed, route handlers
├── netlify.toml             ← Netlify configuration (publish, redirects)
├── server.mjs               ← local dev/demo server (zero dependencies)
└── scripts/smoke-test.mjs   ← end-to-end API test (35 checks)
```

---

## 🔑 Accounts

### Admin (always created — on every deployment)

| Portal | Email | Password |
|---|---|---|
| Admin | `itsolutionsnoads@gmail.com` | `Admin@123` |

> ⚠️ **Change this password immediately after deploying** (Admin → My Profile → Change Password). The login pages never display any credentials.

### Sample data (only when `SEED_DEMO=true`)

A fresh **Netlify deployment starts clean**: the 6 courses, the admin account, and nothing else —
students self-sign up at `#/signup` and the admin creates facilitators and classes.

For exploring/demoing, set `SEED_DEMO=true` (the local `node server.mjs` does this automatically)
to also seed these sample accounts:

| Portal | Email | Password |
|---|---|---|
| Facilitator | `chinedu@techskillacademy.com` | `Facilitator@123` |
| Facilitator | `funmilayo@techskillacademy.com` | `Facilitator@123` |
| Facilitator | `adewale@techskillacademy.com` | `Facilitator@123` |
| Student | `emeka@student.techskillacademy.com` | `Student@123` |
| Student | `blessing@student.techskillacademy.com` | `Student@123` |

…plus 9 class batches, sample materials, assessments, grades and messages.
You can delete any of them from the Admin portal, or wipe and re-seed by clearing the Blob store.

### Changing passwords

- **Every account can change its own password** in its portal: **My Profile → Change Password**
  (admin portal included).
- **Admin can reset anyone's password** from the Students / Facilitators tabs.

> ⚠️ **Change these passwords after your first login** (Admin can also reset anyone's password from the portal).

---

## 💻 Run locally (zero setup)

```bash
node server.mjs          # → http://localhost:3000
```

No `npm install` needed. The local server uses a file-based datastore in `./.data`
(the exact same API code that runs on Netlify — only the storage layer swaps to
Netlify Blobs in production). Delete `./.data` to reset to a fresh seed.

Run the API test suite against it:

```bash
node scripts/smoke-test.mjs http://localhost:3000     # 35 checks
```

Or, if you have the Netlify CLI installed:

```bash
npm install -g netlify-cli
netlify dev            # serves site + functions exactly like production
```

---

## 🚀 Deploy to Netlify

### Option A — Git (recommended)

1. Push this folder to a GitHub/GitLab repository.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Netlify reads `netlify.toml` automatically — no build settings to enter.
4. **Deploy.** Done.

### Option B — Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init          # link/create the site
netlify deploy --prod
```

### After deploying (important)

1. **Set an `AUTH_SECRET`** — Site configuration → Environment variables →
   add `AUTH_SECRET` with a long random string (e.g. from `openssl rand -hex 32`).
   This signs login sessions. Redeploy after setting it (it invalidates old sessions).
2. **Log in as admin** (`itsolutionsnoads@gmail.com` / `Admin@123`) and **change the
   password immediately** — Admin → My Profile → Change Password.
3. Optional: set `SEED_DEMO=true` *before the site's first request* if you want the
   sample facilitators/students/classes seeded for exploring. By default the
   deployment starts clean: real students self-sign up at `#/signup`, and you create
   facilitators and classes from the Admin portal.

---

## 🗄️ Data & storage

- All records (users, classes, materials, assessments, submissions, grades, messages)
  and uploaded files (passports, materials, attachments) are stored in **Netlify Blobs**,
  keyed under store `tsa-db`. No setup or extra cost.
- File uploads are capped at **4 MB** (Netlify Function request limit).
- To wipe all data: Netlify CLI → `netlify blobs:list tsa-db`, or simply delete
  the `meta:seeded` entry / the store contents — the API re-seeds on next request.

## 🔒 Security notes

- Passwords hashed with PBKDF2-SHA256 (100k iterations, per-user salt).
- Session tokens are HMAC-SHA256 signed, 7-day expiry, sent as Bearer headers.
- Every API route is role-checked (student / facilitator / admin / public).
- Public student signup is rate-limited (max 5 accounts/hour per IP) and validates
  email format and password strength (min 6 characters).
- Files are only served to authenticated users.
- Client-side rendering escapes all user data (`esc()` helper) to prevent XSS.

## 🎨 Customising

| What | Where |
|---|---|
| Colours & branding | `public/css/styles.css` (CSS variables at the top) |
| Courses, contact info, texts | `public/js/data.js` (+ same course list in `netlify/functions/_shared/seed.mjs`) |
| Logo | replace `public/assets/logo.jpeg` |
| Grading scale | `gradeOf()` in `public/js/ui.js` |

## 📞 Academy contact

**TechSkill Academy** · Millennium Housing Estate, Ginti, Ikorodu, Lagos State
📞 0807 401 1416 · ✉️ itsolutionsnoads@gmail.com
