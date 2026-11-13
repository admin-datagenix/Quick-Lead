# QuickLeads Web (React)

The web version of the QuickLeads app. It has the same admin and salesman flows as the Flutter app, plus a lead-generation KPI dashboard for admins.
It uses the same .NET 8 API in `../backend`.

## Run

```bash
cd web
cp .env.example .env          # set VITE_API_BASE_URL to your API, e.g. http://localhost:5080
npm install
npm run dev                   # http://localhost:5173
npm run build                 # production files in dist/
```

The API allows any origin while `Cors:Origins` in `appsettings.json` is empty. For production, list the web app's domain there.
Development login: any 10-digit mobile number starting with 6–9, with OTP `123456`. The Fill button on the OTP screen enters it for you.

### Hosting `dist/`
This is a single-page app, so every route must serve `index.html`.
- **IIS:** add a URL Rewrite rule that sends anything that isn't a file to `/index.html`.
- **Nginx:** `try_files $uri /index.html;`

## Stack
React 18 · Vite 5 · React Router 6 · TanStack Query 5 · Axios · Recharts · lucide-react · qrcode. Plain CSS design system in `src/styles/global.css` (sky blue and white).

## Structure
```
src/
├── lib/            api.js (Axios client, JWT + silent refresh, every endpoint), format.js, config.js
├── context/        SessionContext (login → group → Admin or Salesman shell by role in the active group)
├── components/     ui.jsx (buttons, modal, drawer, toasts, confirm, states), layout/AppShell.jsx (sidebar, top bar, group switcher)
└── features/
    ├── auth/        Login + OTP
    ├── onboarding/  Create or join, invitations inbox (accept with name), create / edit group
    ├── admin/       Dashboard (KPIs), Leads (search, filters, 30 per page, export), Forms (cards, builder with templates,
    │                detail + analytics, assign, extend, duplicate), Salesmen (invite, detail drawer, activate, unassign,
    │                remove), Logs (exports with download, salesman login/logout)
    ├── salesman/    Home (today count, Add lead → primary form, My QR), My forms (set primary, preview, copy link, QR),
    │                Capture lead (required fields first → confirm screen with edit per field → save), My leads
    └── common/      A4 QR print (QR twice, salesman ID, print / save as PDF), notifications, profile, help
```

## Dashboard
It uses `GET /api/v1/groups/{groupId}/analytics?from=&to=&formId=`, which is new in the backend for this web app. It shows:
- Leads captured, with change vs the previous period
- Leads today vs yesterday, active salesmen, and the share of leads from QR scans and links
- Average per day, live forms, incomplete and duplicate leads, best day, peak hour
- Daily trend by source (app, QR, link), source mix, salesman leaderboard and enquiry breakdown
- Weekday × hour heatmap, latest leads feed and form performance

You can filter by date range (today, 7, 30 or 90 days, or custom) and by form. The data refreshes every 60 seconds.

## Notes
- Offline capture is available only in the mobile app. The web app needs a connection.
- QR PDFs come from the browser's print dialog. Choose A4, set margins to "None" and turn on background graphics.
