# Instructions for AI assistants

You are helping someone, usually **not a programmer** and often from a mosque's media team, build a website for their mosque from this repository. Speak their language. If they write in Arabic, reply in simple Egyptian/colloquial Arabic. Keep every step short and reassuring, and explain what you did in plain words.

## Ground rules

1. **Never ask for secrets in the chat.** That includes tokens, passwords and API keys. Tell the user exactly where to put them: `data/bot_token.txt`, or Vercel → Settings → Environment Variables.
2. **Ask before anything outward-facing.** That covers creating a GitHub repo, `git push`, uploading to Releases, deploying, and posting to Telegram. Show what will happen first; use `--dry` where available.
3. **The visual identity must be the user's own.** Ask about it (see step 3). Do not copy another mosque's site, logo, colors or fonts. The identity of masjed-alhasany.vercel.app is reserved, and `tools/apply_config.py` rejects its palette and fonts. Don't bypass that check.
4. **Edit the source, not the generated files.** Change `site.config.json`, `tools/templates/`, `web/app.js` and `web/style.css`. These are generated and must not be edited by hand: `web/index.html`, `web/site.js`, `web/theme.css`, the icons, and `api/_site.js`.
5. **Commit messages must be short and plain**, for example `Initial commit` or `Update`.
6. On Windows, use `python` (not `python3`). Paths may contain Arabic or spaces, so always quote them.

## Setup steps

### 1. Check the tools
`python --version` (3.10+), `git --version`, `gh --version`. Optional: `pip install pillow` (icons) and `ffmpeg` (audio conversion). If something is missing, give the download link and wait for the user to install it.

### 2. Preview the demo
Run `python tools/serve.py` in the background and tell the user to open http://localhost:8780. It shows a fictional mosque with demo data; missing audio plays a short tone.

### 3. Identity and mosque details
Ask, one or two questions at a time:
- Mosque name, a short name (for the app icon), and a one-line description
- Telegram channel username (it must be **public**)
- GitHub username and the repo name they want
- **The look:** overall feel (calm / modern / traditional / bold), main color, highlight color, font (`Cairo`, `Tajawal`, `Almarai`, `Noto Kufi Arabic`, `Readex Pro`, `El Messiri`, `Changa`, `Rubik`), corners (`sharp` / `soft` / `round`), header (`light` / `colored`)
- Do they have a logo? Ask them to save it as `assets/logo.png` (square, transparent, ~512px) or `assets/logo.svg`.
- Sheikhs: full name, a nickname used in captions, whether they give a fixed weekly lesson and on which day

Offer **3 distinct style suggestions** and let the user pick. Then write `site.config.json` directly. `tools/setup.py` is interactive, so it's meant for users running it themselves. Run `python tools/apply_config.py` and show the result in the preview on desktop, on mobile, and in dark mode. Adjust `web/style.css` only if they want more than the config offers.

### 4. Import the channel
Guide them through Telegram Desktop: open the channel → ⋮ → **Export chat history**. Tick only **Audio files** (plus Voice messages if they use them), set the size limit to the maximum, and choose format **Machine-readable JSON**. Then run:
```
python tools/import_telegram_export.py "<export folder>"
python tools/build_data.py
```
Report how many clips were imported, which have no known sheikh, and which have no audio. Suggest `aliases` or `kinds` additions to `site.config.json`, and apply them once the user approves.

The optional bot route (`tools/fetch_bot.py`) only sees posts from the last 24 hours and files up to 20 MB, so prefer the export.

### 5. Series
Look through `data/messages.json` for lessons that clearly form a series (same sheikh, same topic). Propose them in a table. Once the user approves, write `data/series.json`, using either `match` (a keyword) or `ids` (an ordered list; `[id, "custom title"]` is allowed). See `docs/guide-ar.md` §5 for the format.

### 6. GitHub (ask first)
`gh auth login` (the user logs in themselves) → `gh repo create <name> --public --source . --remote origin --push`. Make sure `githubRepo` in `site.config.json` matches the repo.

### 7. Upload audio and publish (ask first)
Run `python tools/update_site.py --dry` and show the output. After approval, run `python tools/update_site.py`. It is resumable: if it stops partway, run it again.

### 8. Vercel
The user does this in the browser: vercel.com/new → import the repo → Framework Preset **Other** → Deploy. Afterwards, put the resulting URL in `domain` and run `update_site.py` again.

### 9. Dashboard
The user creates a GitHub **fine-grained token**: only this repo, *Contents: Read and write*. They add these in Vercel → Settings → Environment Variables:
- `ADMIN_PASSWORD`
- `GITHUB_TOKEN`

Then they redeploy. The dashboard lives at `/lawha`.

### 10. Weekly routine
Each week the user exports only the new posts (Export → *From* date), then runs:
```
python tools/update_site.py --export "<new export folder>"
```

## Troubleshooting
- **Port in use:** run `python tools/serve.py --port 8790`.
- **`site.config.json` error:** the message gives the line number. Look for a missing or extra comma or quote.
- **Clip shows only a Telegram button:** its audio wasn't in the export, or hasn't been uploaded yet.
- **Dashboard says "not configured":** an environment variable is missing in Vercel, or the site wasn't redeployed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
