# Friend AI

A small, login-protected personal assistant web app. You create a login for your friend, he signs in on his phone, connects his own Google Calendar, and talks to an AI by typing or speaking. The AI can read it back out loud, and an animated thinking orb shows what it is doing.

- **Login:** invite-only, up to five people. The admin sends an invite link; the person chooses their username and password. Passwords are stored as scrypt hashes.
- **AI:** Claude Haiku 5.5 through [Hack Club AI](https://ai.hackclub.com) (OpenAI-compatible API). The key stays on the server. Two models only: Haiku for chat, `openai/gpt-audio-mini` for the spoken replies.
- **Google Calendar:** each user connects his own account with OAuth. The app asks only for `calendar.events`, never sees a Google password, and writes nothing without a confirmation click.
- **Chats:** many persistent conversations per user, with rename and delete. Each chat keeps its own history.
- **Photos and PDFs:** attach up to 4 files per message (JPEG, PNG, WebP, GIF, or PDF, 6 MB max each). Photos are resized in the browser before upload. Claude Haiku 5.5 reads them directly.
- **Conversation mode:** the Talk button opens a full-screen voice loop: it listens, sends, waits for the reply, speaks it, then listens again. Tap the orb to pause, or to interrupt a reply.
- **Light and dark mode:** follows the phone or computer setting, with a toggle in the top bar.
- **Voice in:** speech-to-text uses a dedicated audio model on Hack Club AI (`mistralai/voxtral-small-24b-2507`). The browser records, converts the audio to WAV, and sends it to the server.
- **Voice out:** read-aloud uses an audio model on Hack Club AI (`openai/gpt-audio-mini`), with the browser voice as fallback.
- **Orb:** [`@yogesharc/thinking-orbs`](https://www.npmjs.com/package/@yogesharc/thinking-orbs) (MIT). States: idle, listening, thinking, speaking, error.

## Run it on your computer first

Requirements: Node.js 22.13 or newer (the app uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env        # then fill in the values, see below
npm run user:add -- AB      # creates the login "ab" and asks for a password
npm run dev                 # app at http://localhost:5173 (API on :8787)
```

Minimum `.env` to chat: `HACKCLUB_API_KEY`. Without it the app runs, but chat shows a clear "AI is not set up" message.

`ENCRYPTION_KEY` is needed before Google can be connected. Generate it once and keep it safe; if you lose it, users have to reconnect Google:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Accounts and invites

Nishiki is invite-only, for up to **5 people** in total.

1. Create the first admin on the server: `npm run user:add -- AB --admin` (asks for a password twice).
2. In the app, go to **Settings → Admin → Users → Create invite link**, and send the link to the person.
3. They open the link, choose a username and a password, and are signed in right away.

Each link works once and expires after 7 days. Open links count towards the five places, so you can't invite more people than there is room for. The link is shown once; only its hash is stored.

Logins last **90 days**. After that the person signs in again with their username and password.

Admin tools in the same page: switch an account off, reset a password (this signs that person out everywhere), and choose which features each person may use. Usernames are 2–20 letters, digits, `-` or `_`; they are stored lowercase.

Command line, if the app is not reachable: `npm run user:passwd -- AB` resets a password.

## Hack Club AI

The app uses one provider only: Hack Club AI. Setup is two values in `.env`:

1. Sign in at [ai.hackclub.com](https://ai.hackclub.com) and create an API key.
2. Put it in `.env` as `HACKCLUB_API_KEY`. Never commit `.env`. `HACKCLUB_BASE_URL` already points to the right address.
3. Start the server, then pick the models under **Settings → Admin → AI models**. The list comes from `https://ai.hackclub.com/proxy/v1/models`. Search it, and by default it only shows models that fit the job: text in and out for chat, audio in for speech to text, audio out for the read-aloud voice.

The starting models come from `HACKCLUB_MODEL`, `STT_MODEL` and `TTS_MODEL` in `.env`. The model list is cached for 10 minutes.

The API is OpenAI-compatible: `POST https://ai.hackclub.com/proxy/v1/chat/completions` with `Authorization: Bearer <key>`. The app strips `<think>…</think>` blocks from replies so they are never shown or spoken.

**Input types:** Claude Haiku 5.5 accepts text, images and files (PDF) on Hack Club. It does **not** accept video, and video uploads are refused for now.

## What the assistant can do

The assistant calls tools when they help. Read-only tools run at once. Anything that changes data becomes a card in the chat, and it only runs after a tap on **Confirm**.

| Tool | What it does | Confirmation |
|---|---|---|
| `get_time` | Current date and time in `TIMEZONE`, so "tomorrow" works | No |
| `web_search` | Web search through Exa (via the Hack Club proxy), with links | No |
| `read_web_page` | Reads one public http(s) page. Private and local addresses are refused | No |
| `calendar_upcoming` | Lists the next 7 days (only when Google Calendar is connected) | No |
| `calendar_add` | Proposes a calendar event (only when Google Calendar is connected) | **Yes** |
| `create_pdf` | Writes a PDF and attaches it to the reply | No |
| `create_presentation` | Builds a 16:9 PowerPoint (title slide plus up to 12 slides with bullet points) and attaches it to the reply | No |
| `save_note` / `list_notes` | Short personal notes | No |
| `delete_note` | Deletes a note | **Yes** |
| `show_widget` | Shows a chart (bar, line, area, pie), a table, key numbers (stats) or a list of items (cards) under the answer | No |
| `remember` / `forget` | Saves or removes a fact about you (Settings → Memory) | No / **Yes** |
| `mail_recent` | Lists recent mail headers, only with mail consent | No |
| `search_past_chats` | Searches the user's earlier chats for a word or phrase | No |
| `weather_forecast`, `convert_currency`, `wikipedia_summary`, `find_place`, `route_distance` | The ready apps above | No |
| `drive_search`, `todoist_tasks`, `github_inbox`, `notion_search` | Read-only app tools | No |
| `todoist_add_task` | Adds a Todoist task | **Yes** |
| `gmail_search` | Searches Gmail (Gmail search syntax) and shows sender, subject, date and a preview | No |
| `gmail_send` | Writes a plain-text email from the user's Gmail | **Yes** |
| `mcp_<connector>_<tool>` | Tools from the connectors the user switched on (see below) | Read-only: No. Anything else: **Yes** |

The user never sees tool calls. Under each answer a short line says what was used (for example "Searched your Gmail"). Tool results stay out of the chat.

Limits: up to 6 tool steps per reply, 24 KB of tool output, PDFs up to 30,000 characters. Text from web pages and connectors is treated as information, not instructions.

Confirmations happen in the chat. In conversation mode the orb covers the chat, so close it to tap Confirm.

Each feature can be switched off per user by the admin (web, memory, mail, calendar, Gmail, connectors). When it is off, the assistant does not even see its tools.

Scheduled tasks are described under **Scheduled tasks** below. Reminders as separate items are not included yet.

## Scheduled tasks

Open **Geplante Aufgaben** (Scheduled tasks) in the sidebar. A task is a question the assistant answers by itself: once, every day or every week, at a time you choose in your own time zone. Each run opens its own chat with the answer, and the assistant can use your connectors (MCP) and apps like in any chat. If you set up a phone topic in Settings (ntfy), you get a notice when a task finishes. Tasks that would change data still wait for a tap on **Confirm** in their chat.

The scheduler checks once a minute (`SCHEDULER=0` turns it off). **Run now** starts a task at once. A task that fails keeps its last error on the card.

## File types

The assistant and the viewer read these uploads: photos, PDF, CSV (semicolon, comma or tab separated), text, Markdown, JSON, Word (`.docx`) and PowerPoint (`.pptx`). Word files can be saved as a PDF with **Save as PDF** in the viewer; the PDF is kept as a new file. PowerPoint files open as slide cards.

## Apps

Settings → Apps lists everything the assistant can use. Each app can be switched off, and the admin can switch any of them off for a user (Admin → Users).

| App | Setup | What the assistant can do |
|---|---|---|
| Weather | none, on by default | Current weather and a 3-day forecast for any place (Open-Meteo) |
| Currency converter | none, on by default | Convert between currencies at ECB rates (Frankfurter) |
| Wikipedia | none, on by default | Short summaries of articles, in any language |
| Maps and routes | none, on by default | Find places and driving distance and time (OpenStreetMap, OSRM) |
| Gmail | Install with Google | Search mail and draft emails; sending needs Confirm |
| Google Calendar | Install with Google | See upcoming events; adding one needs Confirm |
| Google Drive | Install with Google | Find files by name (names, dates and links only) |
| Todoist | Paste a personal token | List tasks; adding one needs Confirm |
| GitHub | Paste a personal token | Issues and pull requests assigned to you, and notifications (read-only) |
| Notion | Paste an integration token | Search pages and databases (read-only) |
| Connectors | Set up by the admin (MCP) | Whatever the connector offers; changes need Confirm |

**Install with Google** uses one sign-in for Gmail, Calendar and Drive. The Drive scope is new, so accounts connected earlier press **Reconnect Google** once.

**Paste a personal token** (Todoist, GitHub, Notion): the user creates a token at the service (the app links to the right page), pastes it once, and the server checks it with the service before storing it encrypted with `ENCRYPTION_KEY`. A wrong token is refused at once.

**Not supported yet:** Microsoft 365 and Outlook (needs an Azure app registration), iCloud Calendar (needs CalDAV), Spotify, Slack. They can be added the same way as Google or as token apps, or as admin connectors if they offer an MCP server.

## Sidebar, projects and library

The sidebar works like the ChatGPT one:
- **New chat**, **Library** and **Apps** at the top.
- **Pinned**: chats you pinned (chat menu, then Pin). They stay on top.
- **Projects**: folders with their own instructions. Every chat in a project follows them. Create one with the + next to Projects, then use **Move to project** in a chat's menu, or **New chat in project** on the project.
- **Recent**: the other chats, grouped as Today, Yesterday, Previous 7 days and Older.

**Library** lists every photo and PDF you sent or received, with the chat it belongs to. Files are stored on your server in `DATA_DIR/files`, one folder per user, so you can back them up or open them directly. There is one storage room for everyone (`STORAGE_LIMIT_MB`, 500 MB by default). Deleting a chat deletes its files. Older uploads that are still in the database keep working.

**Voice input** works like ChatGPT's bar: the **X** cancels the recording, the **square** stops it and puts the words in the box, and the **arrow** stops and sends them.

Not built yet: attaching library files to a project.

## Memory across chats

- **Earlier chats:** when the user refers to something said before, the assistant searches the other chats (`search_past_chats`) and quotes the matching text. It never loads all history.
- **Learning from chats:** after a reply, the assistant can save up to three durable facts (a preference, a person, a routine) as memories, marked "From a chat". At most one check runs every 10 minutes per user, in the background. Switch it off under Settings → Memory. Every fact can be deleted there.
- Nothing sensitive is kept on purpose: the prompt skips health, money and passwords.

## Languages

The interface starts in **German**. Settings → Appearance → Interface language switches it to English. The reply language is a separate setting (Personalisation → Reply language, default: match my message). The choice is stored on the account.

Known gap: error messages from the server are still in English.

## Home screen suggestions

The empty chat shows four suggestions taken from what the assistant knows: the next two days of calendar events (if Calendar is on), saved memories and recent chat titles. Each suggestion is labelled with its source, and the suggestions are written in the interface language. The server makes one small AI call and keeps the result for 30 minutes per user. Without any context, the suggestions are generic.

## Connectors (MCP)

A connector is an external tool server that speaks the Model Context Protocol over Streamable HTTP (https, or http for localhost only). The admin adds it under Settings → Admin → Connectors, with a name, an address and an optional access token. The token is stored encrypted and never shown again. **Test** lists the tools the server offers. Each user then switches the connectors they want under Settings → Apps.

- Tools the server marks as read-only (`readOnlyHint`) run at once. All other tools create a card in the chat that runs only after **Confirm**.
- Up to 40 tools per server are offered to the model. The tool list is cached for 10 minutes.
- Connector addresses are fetched by the server. Use only servers you trust.

## Interface

- **Layout:** on a wide screen (and on an iPad) the chats sit in a sidebar. On a phone, the menu button slides the page to the side and shows the chats behind it, like the ChatGPT app. Tap the page, or press Escape, to close it. The account row at the bottom of that list opens Settings.
- **Other file types:** Word (.docx), CSV, Markdown, text and JSON files can be attached. The app reads them once at upload, so the assistant can answer questions about them. CSV opens as a table (semicolon or comma), Word and text open as text. The text is kept for the model, not the binary.
- **Search and export:** the sidebar searches all chats by title and message text. Any chat can be exported as a Markdown file (chat menu, Export as Markdown).
- **Files:** a photo or PDF opens next to the chat on an iPad or a computer, and full screen on a phone. PDFs are drawn page by page in the browser (pdf.js), so they also show on iPhone and iPad.
- **Thinking:** the Denkstufe button in the message box (Aus, Niedrig, Mittel, Hoch) sets how much the chat model thinks. It is saved on the account. Low is the default, which keeps voice fast.
- **Attaching:** the + button offers Take Photo (camera), Photo Library and Choose Files (PDF or image), like the iOS attach sheet.
- **Account menu (top right):** light or dark mode, read-aloud, calendar, Settings, sign out.
- **Answers:** Markdown (headings, lists, tables, code with highlighting), sources as chips, and charts or tables the assistant creates. Hover an answer on a computer, or tap the copy button on a phone.
- **Components:** Tailwind CSS for the design, Radix for accessible dialogs, tabs, switches and menus, Lucide for icons, Recharts for charts, react-markdown with highlight.js (common languages only), and sonner for notices.
- **Heavy parts load on demand:** the charts and the settings panel are fetched the first time they are needed.

To rebuild after changing the code: `npm run build`. Vite 7 and @vitejs/plugin-react 5 are used now, which also clears the earlier dev-server advisory.

## Settings

Open the account menu (top right) and choose Settings. It is a full page, and every change is saved on the server, so it follows you to other devices.

- **Account:** change your username or password, and sign out other devices. Changing the password signs you out everywhere.
- **Appearance:** system, light or dark.
- **Personalisation:** your own instructions (up to 1,500 characters) for every new chat, answer style, language, memory and web search. Memory and web search can be switched off by the admin.
- **Voice:** read replies aloud by default, and pick the voice (with a sample).
- **Apps:** install and switch on Gmail, Google Calendar and connectors.
- **Memory**, **Mail and notifications**, **Usage**.
- **Data controls:** export all your data as JSON, delete all chats, or delete all memories.

**Memory.** Say "remember that…" and the assistant saves the fact at once. Every fact is listed under Settings → Memory, where you can delete it. Nothing is saved on its own, and the assistant uses the list in every chat. Up to 200 facts.

**Sources.** When an answer used web search or a web page, the links appear under it as chips.

**Mail and phone notifications (optional, off by default).**
1. Yahoo: create an *app password* (Account security → Generate app password). Do not use your normal password.
2. ntfy: install the ntfy app on the phone, subscribe to a long random topic name, and enter that name under Settings → Mail.
3. Enter the mail address and app password, tick the consent box, then tick the notification box and save.
4. "Check now" runs a check straight away. Otherwise the server checks every 10 minutes.

What is read: sender, subject and date of mail, read-only. Nothing is marked, moved or sent. With consent, those headers go to the AI, which decides whether each mail is important. The notification shows the sender and the subject, so pick a topic only you know. The first run only records where the inbox is, so old mail is not announced. Set `NTFY_URL` to use your own ntfy server, and `SCHEDULER=0` to switch the background checks off.

**Usage.** Settings → Usage shows your last 24 hours.

## Admin

Users with the admin flag see an **Admin** entry in Settings.
- **Users:** create invite links, switch accounts off, set a password, and choose what each person may use: web search, memory, mail reports, Google Calendar, Gmail, Google Drive, apps and connectors. There are no daily caps; the usage page shows what was used.
- **Connectors:** add, test and remove MCP connectors (see above).
- **General:** the assistant's name, and which features new users start with. Existing users keep their own switches.
- **AI models:** the model for each job (chat, speech to text, read-aloud voice) and the voice. The address and key come from `.env`; the page only shows whether the key is set. "Test" checks the chat model with one short request.
- **Usage:** calls and tokens per user and per model, for 1 to 90 days.

To make the first admin from the command line: `npm run user:add -- AB --admin`.

## Installing on iPhone, iPad and computers (no App Store)

The app is a web app that installs like a native one. You only need the link to your server.

- **iPhone or iPad:** open the link in Safari, tap the Share button, then **Add to Home Screen**. It opens full screen from the icon.
- **Computer (Chrome or Edge):** open the link, then use the install icon in the address bar, or the menu and **Install Nishiki**. It opens in its own window.
- **Push notifications on iPhone** only work for the app added to the home screen (iOS 16.4 or later).

For a version in the App Store or TestFlight, see [docs/apple-design-checklist.md](docs/apple-design-checklist.md) and the notes on native wrappers. That needs an Apple Developer account (99 USD a year).

## Home-screen icons

The icons in `client/public/` are generated from the orb design. To change them, edit `scripts/make-icons.js` and run `node scripts/make-icons.js`, then `npm run build`.

## Google Calendar and Gmail (one-time setup)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Calendar API**, the **Gmail API** and the **Google Drive API**.
2. **Google Auth Platform / OAuth consent screen:** set the user type to External and add your friend's Google address as a **test user**.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URI: `https://YOUR-DOMAIN/api/google/callback` (for local tests also `http://localhost:8787/api/google/callback`).
4. Put the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `PUBLIC_URL` to the same origin as the redirect URI (without the path).

**Gmail needs re-consent.** The app asks for Gmail search and send, and read-only Drive file names. Accounts connected before this change must press **Reconnect Google** once (Settings → Apps). Gmail scopes are restricted by Google, so a public release needs its verification review, as for Calendar.

**Important:** while the consent screen is in *Testing* status, Google expires refresh tokens after 7 days, so your friend would have to reconnect weekly. For a long-lived connection, publish the consent screen. Because `calendar.events` is a sensitive scope, Google may ask you for a verification review before publishing beyond your own test users. Plan for that.

## Voice

- **Speak to it:** the microphone button records until you tap again. The transcript goes into the text box so your friend can check it before sending. Conversation mode records each turn until the speaker pauses (about 1.2 seconds of quiet), then transcribes it.
- **Recording needs a secure page:** the browser only gives microphone access over HTTPS (or on `localhost`). Each recording is sent to the speech model, so it counts toward your Hack Club usage.
- **Hear replies:** "Voice replies" is on by default. Browsers only allow speech after a tap, so the app unlocks speech when the user sends a message. If iOS still blocks it, the reply is shown as text.
- **Server voice:** replies are read by `openai/gpt-audio-mini` on Hack Club AI (streamed audio, MP3 by default). Set `TTS_MODEL`, `TTS_VOICE` (e.g. `alloy`) and `TTS_FORMAT`, or `TTS_ENABLED=0` to use the browser voice only. If the server voice fails, the browser voice is used automatically. The voice model is not in Hack Club's docs and was tested only against a stand-in, so check the first reply yourself.

## Deploy on a Linux server

Assumes Ubuntu/Debian, a domain pointing at the server, and ports 80/443 open. The app listens only on `127.0.0.1:8787`; Caddy provides HTTPS in front of it.

```bash
# on the server
sudo useradd --system --home /opt/friend-ai --shell /usr/sbin/nologin friendai
sudo mkdir -p /opt/friend-ai && sudo chown -R "$USER": /opt/friend-ai
# Node 22.13+ (e.g. from NodeSource or nvm), Caddy from https://caddyserver.com/docs/install
cd /opt/friend-ai
# copy the project here (git clone, scp, or rsync), then:
npm ci && npm run build
cp .env.example .env && nano .env   # set PUBLIC_URL=https://your-domain, keys, ENCRYPTION_KEY, HOST=127.0.0.1
npm run user:add -- AB
sudo chown -R friendai:friendai /opt/friend-ai/data
```

Then install the service and the reverse proxy:

```bash
sudo cp deploy/friend-ai.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now friend-ai
sudo systemctl status friend-ai         # should say "active (running)"
curl -s http://127.0.0.1:8787/api/health  # {"ok":true}

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the domain first
sudo systemctl reload caddy
```

`friend-ai.service` reads `/opt/friend-ai/.env` through systemd, which runs as root, so the file can stay `chmod 600`. Check the Node path with `which node` and change `ExecStart` in the unit if it is not `/usr/bin/node`.

On an iPhone: open the HTTPS address in Safari, sign in, then Share → **Add to Home Screen**.

### Backups and restore

- All data (accounts, chat history, Google refresh tokens encrypted) is in `/opt/friend-ai/data/app.db`.
- Run `deploy/backup.sh` regularly (cron or a systemd timer). It writes consistent copies to `/var/backups/friend-ai` and keeps the newest 14.
- **Back up `.env` separately.** The Google refresh tokens can only be decrypted with the same `ENCRYPTION_KEY`. Without it, a restored database still works but every user must reconnect Google.
- Restore: stop the service, copy a backup over `data/app.db`, start the service.

### Updating

```bash
sudo systemctl stop friend-ai
# copy the new code in (keep .env and data/), then:
npm ci && npm run build
sudo systemctl start friend-ai
```

## Security notes

- Passwords: scrypt with a random salt. Login is rate-limited (10 attempts per 15 minutes per IP).
- Sessions: random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` on HTTPS); only its SHA-256 hash is stored. Sign-out deletes it. Sessions last 90 days, then the person signs in again.
- Every API route except login checks the session on the server. Writes must be JSON, which blocks cross-site form posts.
- Google sign-in uses the OAuth web flow with a one-time `state` value bound to the logged-in user.
- Google refresh tokens are encrypted at rest (AES-256-GCM). Access tokens are only kept in memory.
- Keys never reach the browser. Logs record HTTP status codes and error types, not keys, OAuth codes or message contents.
- Security headers come from `helmet` (strict CSP, no framing).
- The assistant has no tool that runs code or changes files on the server. Calendar events, sent mail, note deletions and connector changes wait for a tap on Confirm. Gmail is read through search only: the assistant gets sender, subject, date and a short preview, not whole mailboxes.
- Connector tokens and the Gmail/Calendar refresh tokens are encrypted with `ENCRYPTION_KEY`. Keep that key in `.env` and back it up with the database; without it, stored secrets cannot be read.
- Account changes: changing the password signs the user out on every device. Admin changes take effect on the next request.

## Credits

The koi pond on the first screen is ASCII Koi by pursurer (MIT License), vendored in `client/src/vendor/ascii-koi`. It was inspired by stackedlol/ascii-sharks and daoho.dev. See `client/src/vendor/ascii-koi/LICENSE`.

## Known limits (v1)

- The orb follows real audio in conversation mode: your microphone while listening and the reply's loudness while speaking. The reply loudness can only be measured for the server voice; with the browser voice the orb uses a gentle animation instead.
- Video is not supported by Claude Haiku 5.5 on Hack Club, so video uploads are refused.
- No long-term memory across chats. Each chat is stored in full. When a chat grows beyond `HISTORY_CHARS` (about 240,000 characters by default), its oldest messages are folded into a running summary that the AI keeps as its memory of that chat. The newest messages are always sent word for word. Deleting a chat removes it, summary included.
- The interface is English. The assistant replies in the language the user writes in.
- Old attachments in a long chat are only named to the model, not re-sent, to keep requests small. The four most recent files stay visible to it.
- One server, one SQLite file. Fine for a handful of people; not built for scale.
- The earlier `jarvis-agent-handoff` package (Flask/Ollama, macOS Calendar) is not ported: its Apple Calendar code cannot run on Linux, so Google Calendar replaces it.
