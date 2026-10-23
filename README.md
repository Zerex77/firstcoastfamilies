# First Coast Families

Family events, all-ages concerts and kid-friendly places across Northeast Florida.
Live at https://firstcoastfamilies.com (GitHub Pages + Supabase).

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The public site: month calendar, Events list, Places list, newsletter signup, "List your event" form, ad rate card |
| `admin.html` | Private admin page: review queue, import sweep finds, feature/unpublish listings, copy newsletter emails |
| `css/site.css` | Shared styles (pastel-blue design, light and dark) |
| `js/config.js` | Your Supabase URL and anon key |
| `js/data.js` | Database client and row mapping shared by both pages |
| `js/trucks.js` | Food truck tab: map with truck icons, stops list, regular spots, owner form |
| `data/trucks.json` | Food truck spots and scheduled stops, refreshed weekly by a scheduled task |
| `data/sweep.json` | New events found by the twice-a-month scheduled task; imported from the admin page |
| `supabase/schema.sql` | Tables, security rules and nightly cleanup |
| `supabase/trucks.sql` | Table for stops posted by truck owners, plus nightly cleanup |
| `supabase/seed.sql` | The 77 listings moved over from the preview |
| `CNAME` | Tells GitHub Pages to serve firstcoastfamilies.com |

## One-time setup

1. **Supabase project.** In Supabase, create a new project named `firstcoastfamilies`.
2. **Database.** SQL Editor → New query → paste `supabase/schema.sql` → Run. Then do the same with `supabase/seed.sql`.
   If the cleanup block at the end of the schema errors, enable `pg_cron` under Database → Extensions and run that block again.
3. **Keys.** Project Settings → API. Copy the Project URL and the `anon` `public` key into `js/config.js`. (Never put the `service_role` key in this repo.)
4. **Sign-in links.** Authentication → URL Configuration: set Site URL to `https://firstcoastfamilies.com` and add `https://firstcoastfamilies.com/admin.html` to Redirect URLs.
5. **Make yourself admin.** Open `/admin.html`, sign in with your email link, and run the one line of SQL it shows you.
6. **GitHub Pages.** Repo Settings → Pages → Deploy from branch `main`, folder `/`. Custom domain: `firstcoastfamilies.com`, then tick Enforce HTTPS once it's offered.
7. **GoDaddy DNS.** Same as playsproutle.com:
   - Four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record: `www` → `zerex77.github.io`
   - Remove GoDaddy's default parked `A` record for `@` if there is one.

## How new events arrive

- On the 1st and 15th, a scheduled task finds upcoming family events and writes them to `data/sweep.json` in this repo.
- On `/admin.html`, tap **Import new finds**, then Approve or Reject each one.
- Venue submissions from the public form land in the same queue.
- Past events are removed automatically every morning by the database itself.

## Food trucks

- Every Thursday morning a scheduled task checks public sources (tourism and city calendars, markets, food truck parks, rallies, truck websites) and rewrites `data/trucks.json`. It publishes straight to the site, no review step.
- Most trucks only post on Facebook and Instagram, which can't be read automatically, so truck owners can post their own stops with the "Run a food truck?" form. Those land in the admin review queue; approving one looks up the address and pins it on the map.
- The map uses OpenStreetMap tiles, which are free for light use. If traffic grows a lot, switch to a hosted tile plan (for example MapTiler or Stadia Maps) in `js/trucks.js`.
