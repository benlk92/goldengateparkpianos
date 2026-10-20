# Golden Gate Park Pianos: setup

## How it fits together

- **`site/`**: the website (plain HTML/CSS/JS), hosted on GitHub Pages.
- **Google Sheet**: the control panel. Edit it from the Google Sheets app on your phone.
  - **Pianos** tab: one row per piano. Uncheck `open` to grey a piano out; `status` is the text people see.
  - **Submissions** tab: every form entry lands here.
- **`google-apps-script/Code.gs`**: runs inside the Sheet and connects it to the website.

| Page | URL |
|---|---|
| Home and live piano status (QR codes land here) | `/` |
| Access form | `/access/` (the piano card buttons add `?piano=…` so Submissions records which piano) |
| Combination | `/code/` (only reachable after submitting the form) |

## One-time Google setup (about 5 minutes, signed in as benlk92@gmail.com)

1. Go to https://sheets.new and name the sheet **Golden Gate Park Pianos**.
2. **Extensions → Apps Script**. Delete what's there, paste the contents of `google-apps-script/Code.gs`, and click **Save**.
3. In the function dropdown at the top, choose **setup** and click **Run**. Approve the permissions: click **Advanced → Go to (project) → Allow**. Google warns because the script is yours and unverified.
4. Back in the sheet you'll now see the **Pianos** and **Submissions** tabs. Check the rows look right.
5. In Apps Script, click **Deploy → New deployment**, then the gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Paste that URL into `site/js/config.js` as `apiUrl` (or send it to Claude).

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** so the URL stays the same.

## Day to day (from your phone)

Open the sheet in the Google Sheets app → **Pianos** tab:
- **Close a piano:** uncheck `open`, and set `status` to e.g. "Rain forecast tonight" or "Closed for repair".
- **Reopen:** check `open`, and set `status` back to "Open unless rain is forecast". Keep it short; nobody reads long text.
- **New combination:** edit `combination`.

Changes show up on the site immediately.

The home page shows the pianos instantly as **open** (or as each visitor last saw them), then updates a few seconds later once the sheet answers. If you add, rename or remove a piano in the sheet, also update `defaultPianos` in `site/js/config.js`.

## Local preview

With `apiUrl` empty, the site uses the sample data in `site/data/preview.json`, and submissions aren't saved.

```bash
python3 -m http.server 8080 --directory site
```
