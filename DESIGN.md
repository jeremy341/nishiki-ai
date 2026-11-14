# Nishiki design

How Nishiki looks, in one place. The start screen and the sign-in screen are the reference: everything else is
made to feel like the same room. When a screen and this file disagree, fix the screen (or change this file on purpose).

## Decisions (2026-11-14, from the owner's answers: these override anything below that disagrees)

**Who and where.** The owner and a few friends, mostly on an iPhone held in one hand, sometimes on a Mac or iPad at a desk.
So: main controls at the bottom within thumb reach, nothing important in the top corners; the wide layout keeps the sidebar visible.

**Mood: calm by default, alive when you play.** Reading, planning and settings screens are quiet (space, hairlines, no
animation but fades). The koi and the orb come out on the **home screen**, the **voice screen** and the **start/sign-in
screens**, and nowhere else. No pond watermark behind conversations.

**How Japanese: medium, without Japanese characters.** The feeling comes from: paper and ink colours, a lot of empty space
(ma), asymmetric placement (the orb and greeting sit slightly off the centre line, captions hang at the left edge), thin
brush-like dividers (the wave rule), a Mincho-style serif for headings, and slow fades. **No Japanese characters anywhere.**

**Layout: our own, built on the orb.**
- **Header:** a sidebar toggle on the left (two-line icon), the chat title, and a "new chat" button on the right. **No account
  button** in the header (the round letter button is removed). The account (name, settings, sign out) lives only in the sidebar footer.
- **Home screen (new chat):** the koi pond fills the screen behind, a clearing around the **orb**, which is the main button
  (tap = talk). Below it the greeting in the Mincho serif, one quiet caption line for today ("18:30 zahnarzt · 2 erinnerungen ·
  8° bewölkt", tap for details) and the message pill at the bottom. No starter cards, no big widgets.
- **Message box:** a pill like ChatGPT's: a round **+** on the left (camera, photos, files, calendar), the text field with the
  mic inside, and a round button on the right that is a small orb when the field is empty (tap = voice) and a send arrow when you type.
- **Orb:** the main button on the home screen, the small voice button in the pill, the assistant's state next to the chat
  title, the voice screen, and **the logo** (app icon, sign-in card, wordmark mark). It replaces the pixel koi glyph as the
  mark. The koi glyph stays for empty and loading states.
- **Sidebar:** restyled, but **the pond window is removed**. Projects, search, library, tasks, apps and the chat list stay.
- **Confirm cards:** stay a card in the chat with Confirm (vermilion) and Cancel.

**Type.** Headings and greetings: a Mincho-style serif (Shippori Mincho). Answers and body: the plain sans. Labels, captions,
times: Geist Mono, small, lowercase. Icons: thin line icons, fewer of them.

**Colour and theme.** The palette stays (pond teal, paper cream, koi vermilion). **The default theme is paper (light)**; pond
(dark) is one tap away and is remembered.

**Touch.** Haptics on iPhone (send, orb tap, confirm), water ripples when you tap empty space on the home screen, and a
quiet water-drop sound when you send and when a reply arrives (switchable in Settings).

**Not yet decided:** the sign-in card (the orb at its top looked wrong to the owner; proposal: orb large on the pond, no card
chrome around it), the voice screen details, the tasks/calendar/library pages beyond the existing restyle.

## The idea

**A koi pond at the edge of a quiet page.** Water, paper and ink. Big, slow, pixel-ASCII koi swim at the edges.
The interface itself is calm and precise, like good stationery: small mono labels, hairlines, a lot of space, and one
warm colour (koi vermilion) that means "this is the thing to press".

Three rules that decide most questions:

1. **The pond is the only decoration.** Koi, ripples, the wordmark made of characters and the orb are the whole
   ornament. Nothing else glows, blurs, gradients or shines.
2. **Chrome is mono, content is readable.** Labels, captions, buttons, times and numbers are Geist Mono, small, lowercase
   and tracked. Anything you read for longer (answers, notes, emails) is in the plain sans face at a comfortable size.
3. **One accent, used rarely.** Vermilion marks the primary action, the current choice and "next". If everything is
   vermilion, nothing is.

## Two waters

The app has two looks, **pond** (dark) and **paper** (light). They are the same design in two inks. The start and
sign-in screens use the same two and follow the account's theme (not only the device setting).

| Token | Pond (dark) | Paper (light) | Used for |
|---|---|---|---|
| `--canvas` | `#0e2a32` | `#e9e4da` | the page, the water |
| `--surface` | `#12353f` | `#f3efe6` | sidebar, cards, the composer |
| `--raised` | `#184452` | `#e0d9c8` | hovered rows, your messages, chips (paper value changed from `#ebe5d8`, which vanished on the page) |
| `--overlay` | `#12353f` | `#f3efe6` | menus, dialogs, sheets |
| `--border` | `#224d59` | `#d9d1bf` | hairlines |
| `--border-strong` | `#35707d` | `#b9ae97` | hairlines on focus/hover, tracks |
| `--fg` | `#ebe6dc` | `#1c1a17` | text |
| `--fg-muted` | `#b9b2a4` | `#5d574d` | secondary text |
| `--fg-subtle` | `#7f7a70` | `#8d8578` | captions, placeholders (never for needed text) |
| `--accent` | `#e8784f` | `#9e3214` | koi vermilion: primary action, current choice |
| `--accent-fg` | `#1a0f0a` | `#f7f2e8` | text on the accent |
| `--danger` | `#ff8a7a` | `#a3261a` | errors, destructive actions |
| `--success` | `#8fd6a4` | `#2f6b3c` | done, saved |

The koi have their own colours, used for glyphs, charts and highlights, never for text:
vermilion `#e8784f`, white `#ece6da`, gold `#e8b04f`, pink `#ee8a8a`, ink `#3a3632`. Chart series use them in this order.

Rules: text on a surface is at least 4.5:1. `--fg-subtle` is for decoration-level text only. Borders are 1px hairlines
and never double up (no border inside a border). There are no shadows except a single faint one under floating menus.

## Type

| Role | Face | Size / style |
|---|---|---|
| Wordmark | Noto Serif Display 700, drawn as characters (hero) or set as text (small) | hero: huge; app: 20px |
| Page title | Geist Mono 500 | 20px, lowercase on settings pages |
| Caption / section label | Geist Mono 400 | 11–12px, lowercase, tracking 0.06em, `--fg-subtle` |
| Button, chip, tab, menu item | Geist Mono 500 | 13px |
| Time, number, id, address | Geist Mono, tabular | 12–13px |
| Reading text (answers, notes) | system sans | 15–16px, line-height 1.7, max 68ch |
| Form label | system sans 500 | 13px |

Headings are never bold-heavy. Hierarchy comes from size, tracking and colour, not weight.

## Shape and space

Radii: **6px** controls, **8px** cards, **12px** dialogs and sheets, **full** only for avatars, the orb and the send
button's focus ring. Spacing steps: 4, 8, 12, 16, 24, 32, 48. Rows are 44px tall on touch, 36px on desktop. One focal point per screen.

## The motifs

Six things carry the theme. Use them with restraint; each has one job. (Tested: koi must be big to feel like the start
screen, so a slim "stream" strip with tiny koi does not work, and koi at full strength under reading text look like dirt.)

0. **The pond window** (`KoiPanel` in a frame). A framed window onto the pond at the bottom of the sidebar and of the
   settings navigation: about 288×150, 8px radius, hairline border, two or three koi swimming at full colour. Nothing is
   ever read there, so it can be loud. Tapping it drops food (the koi swim over). On the phone the same window sits at
   the bottom of the chat drawer. This is the main place the koi live in the app.
1. **The ambient pond** (`PondField`). A **watermark** version of the pond behind a page of content: three big, slow koi
   at **opacity 0.3**, fading out under the reading column (the engine's `dim` box is the column). Desktop and tablet
   animate; on phones it is one still frame. It pauses when the tab is hidden, when a dialog is open, and with reduced
   motion. A tap on empty space drops a ripple and the nearest koi turns toward it. Cards, the composer and menus have
   solid `surface` backgrounds so nothing is read over a koi. Pages that already show a pond (the empty chat, voice
   mode, the start and sign-in screens) do not get a second one.
2. **The koi glyph** (`KoiGlyph`). A tiny pixel koi (16×7 grid) in vermilion, white and gold. It is the app's mark and the
   icon for empty states, loading ("a koi swimming in place") and success. It replaces generic icons in those places.
3. **The wave rule** (`WaveRule`). A thin line of tiny repeated marks (`· ˙ ·` or `~`) in `--border-strong`, used instead of
   a plain line to separate big sections (settings groups, the sidebar's chat groups). Plain hairlines stay for rows and cards.
4. **The wordmark.** "Nishiki" in the serif. On the start screen it is drawn from characters. In the sidebar header and
   on empty screens it is set as text with the koi glyph beside it, never in another face.
5. **The orb** (squares orb). It is the assistant's presence: sign-in, voice mode, the thinking indicator and the header
   status. It is never used as decoration anywhere else.

Ripples and koi react to the person's hand (tap = a ripple, long press or right click = food on the start screen only).
Nothing moves on its own except the koi, the orb and loaders.

## Components

- **Sidebar** (`surface`): wordmark + koi glyph on top, then a search field, "new chat", the chat groups headed by
  lowercase mono captions with a wave rule between groups, the **pond window** above the account row, the account row at the bottom. The current chat is a `raised`
  row with a 2px vermilion bar on its left edge. No icons beside every row; icons only for the five main places.
- **Header** (chat): title left in mono, a tiny orb that shows the state, a quiet menu button right. No bar background; a hairline below.
- **Feed**: the pond shows through at the sides. Your messages are a `raised` block with an 8px radius, right-aligned.
  Answers are plain text in the sans face on the water, no bubble, no avatar. Actions (copy, redo) are 36px icon buttons that appear on hover.
- **Composer**: one `surface` box with a hairline and 12px radius, borderless textarea, a row of quiet icon buttons, and a
  square 6px **vermilion send button** (the one loud thing on the screen). Voice mode button is the orb.
- **Empty chat**: the pond panel, the greeting in the serif, four starter cards with lowercase mono source captions. (Unchanged: it is the best screen.)
- **Voice mode**: full-bleed pond, the orb in the middle, what was heard in the sans face, status in tracked mono caps. Keep as is.
- **Settings and admin**: a two-column page. Left: lowercase mono group captions and plain text rows, the current row has the vermilion bar.
  Right: the page title in mono, one line of description, then groups separated by wave rules, each row "label + hint left, control right".
  No cards inside cards. The koi glyph appears once, in the page's empty or success states.
- **Lists** (library, tasks, calendar, apps): one hairline-divided list, 44px rows, a mono caption line for metadata
  (date, size, state), actions on the right. Today and "next" use vermilion text, nothing else does.
- **Cards and tiles**: `surface`, hairline, 8px. A tile that is a link gets a vermilion hairline on hover and focus.
- **Buttons**: primary = vermilion fill, `--accent-fg` text; secondary = hairline on `surface`; ghost = text only; danger = text in `--danger`. All 13px mono, 36px (44px on touch), 6px radius, pressed = scale .97.
- **Fields**: 36px (44px touch), `surface`, hairline, 6px radius; focus = `--accent` hairline plus a 2px ring at 25%. Labels above, hints below, errors in `--danger` text with a hairline, never a coloured box.
- **Menus, dialogs, sheets**: `overlay`, hairline, 12px (menus 8px); open with the motion tokens below. A sheet on a phone slides from the bottom.
- **Tables and charts**: hairlines only, tabular mono numbers, koi colours for series, labels in mono 11px.
- **Loading**: the koi glyph swimming in place plus a lowercase mono word; skeletons are `raised` bars with a faint sweep.
- **Toasts and errors**: a hairline box on `overlay`, mono text, vermilion only for the action. Errors never fill a block with red.

## Motion

Durations: press 100ms, hover 150ms, open 200ms, enter 220ms, sheets 280ms. Easing `cubic-bezier(.23,1,.32,1)`
(sheets `.32,.72,0,1`). Nothing bounces. Entrances are a 4px rise and a fade. The koi, ripples and orb are the only
looping motion. With reduced motion everything is instant and the pond is a still frame.

## Voice and copy

German first. Short, calm, lowercase for captions ("heute", "aus deinem kalender"). No exclamation marks, no emoji,
no "AI-powered" language. Say what happened and what to do next.

## Do not

- No glass, blur, glow, gradient surfaces, coloured shadows, or pastel tinted boxes.
- No rounded-3xl, pills (except tags), icon-in-a-coloured-circle, or an icon in front of every label.
- No bold headings, no centered paragraphs, no more than one vermilion thing per area.
- No generic empty states (a grey icon and "Nothing here"). Use the koi glyph and a sentence with a next step.
- No new colours, fonts or radii that are not in this file.
- Do not change the start screen, the sign-in card layout, the koi engine or the orb itself.

## Where it lives

- Tokens: `client/src/index.css` (base) and `client/src/redesign.css` (the koi waters). Motion classes: `index.css`.
- Koi engine: `client/src/vendor/ascii-koi/` (do not edit). Wrappers: `ui/koiPond.js`, `ui/KoiBackdrop.jsx`, `ui/KoiPanel.jsx`, `ui/KoiStage.jsx`.
- Shared pieces: `ui/PondField.jsx` (watermark pond), `ui/PondWindow.jsx` (framed pond), `ui/KoiGlyph.jsx`, `ui/KoiEmpty.jsx`
  (empty state), `ui/WaveRule.jsx`, the `.caption` class (small mono label) and the `--koi-*` tokens.
- Primitives: `ui/ui.jsx`. Orb: `OrbView.jsx`. Ripples: `ui/PixelField.jsx`.
