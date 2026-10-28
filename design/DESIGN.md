# Ofrenda design: candlelight at the edge of the veil

## The idea
**The page is the object.** A *recordatorio* is the memorial card handed out at a novena: a portrait,
the name, two years, a place, a few lines. On Ofrenda, Rosa's recordatorio lies on a field of
rosa mexicano under a string of papel picado, cropped by the bottom of the screen, and the rest of the
page continues as more stationery: the stories as sheets of papel de china, her altar as a printed
sheet with scalloped edges, a reply card to add a memory, the back of the card as the footer.

The one live thing: **Ask her ofrenda.** Type or pick a question; the answer materialises from the
family's own words, with a small candle next to each person it quotes.

Built with the taste-skill direction *page-is-the-object* (seed 811240444), palette re-coloured from
the ofrenda itself (the dealt "newsprint and brass" fought the subject). Both mockups pass
`inspect.mjs` with 0 FAIL (index as a page, add as an app screen).

## Files
| File | Use |
|---|---|
| `tokens.css` | Every colour, size, space and motion value. Import it; never hard-code. |
| `svg/sprite.svg` | `flag-calavera`, `flag-flor`, `marigold`, `petal`, `candle`, `kind-*`. Use `<svg><use href="…#id"/></svg>`; colour with `color:` (they fill `currentColor`). In Next.js put the sprite in `public/`. |
| `svg/favicon.svg` | Favicon. |
| `mockups/index.html` + `ofrenda.css` + `ask.js` | The ofrenda page. Port it to React components 1:1: same structure, same classes or CSS modules with the same rules. |
| `mockups/add.html` + `add.css` | Add a memory. |
| `cli/altar.txt` | CLI altar art, mask, colour map, animation. |
| `og/` | `og-1200x630.png`, `dev-cover-1000x420.png`, source `cover.html`. |
| `assets/web/*.jpg` | Web-sized pictures used by the mockups. `assets/credits.json` has every credit. |
| `copy.md` | All UI words, en and es, and the ghost's voice. |

## Colour
One ground per section, flat. Rosa (`--field`) for the hero, the add screen and the reply card;
paper (`--paper`) for reading; night (`--night`) for the altar and the footer. Story sheets cycle
rosa → flor → turquesa → night. **Cempasúchil (`--accent`) appears once per screen**: the Ask button,
the marigold mark, the petals, the focus ring. Storyteller tints (`--who-*`) are identity only, pale,
never on data. Contrast (computed): paper on rosa 6.2:1, ink on flor 8.0:1, paper on turquesa 6.7:1, muted on paper 7.0:1.

## Type
One family: **STIX Two Text** (regular, italic, 600). Five sizes only: `--step-small` 15px,
`--step-body` 18–20, `--step-lead` 22–26, `--step-head` 36–52, `--step-name` 52–88.
Her name is italic on the card, on two lines, staggered. Running text 18–20px, leading 1.45,
max 40–60ch. Tabular figures for years and times. Self-host via `@fontsource/stix-two-text` (offline).

## Shape
Square corners everywhere. Objects get their edges from **scallops and notches** (CSS `mask`), never
outlines: the card's top corners, the altar sheet's top and bottom edge, the footer's top edge.
Buttons: square, one fill (ink, or cempasúchil for Ask). Bars and cells, not pills.

## Pictures
Real pictures of Rosa's world, credited in the footer: Posada's *Calavera Oaxaqueña* (1903) and
*Catrina*, 1950 highway survey cards of Oaxaca, a 1910s water seller in Oaxaca, an altar in Milpa Alta,
mole negro, pan de muerto, cempasúchil. Rosa's portrait is a **generated linocut illustration**
(Canva) in the Posada manner, labelled as fictional. In the app, a person's portrait is whatever
the family uploads; show it in the same 4:5 frame.

## Motion
Transform and opacity only. Papel picado sways (5.2 s, alternate, phase per flag). Marigold petals
drift down the hero (16 s). Each section's parts rise 24 px in sequence (80 ms stagger) as they enter.
The answer materialises (blur 6 → 0, 900 ms). Candle flames flicker. The altar photo drifts slowly.
Everything stops under `prefers-reduced-motion`, and nothing is hidden without JavaScript.

## House rules (from the taste skill; the inspector enforces them)
No gradients as paint (masks for scallops are the only gradient use, marked `taste-skill-ignore`),
no shadows, no glows, no hairline rules or outlined boxes, no monospace outside code, no eyebrow labels,
no 01/02/03 numbering, no pill badges, no icon-in-a-square cards, no emoji, no glass. Headlines two lines
max at every width. Equal outer margins. Every section has a heading.

## Checking a port
From `design/`: `node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs <url>` (env
`CHROME_PATH=/home/ritesh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`). The ported page
must also reach 0 FAIL. Compare screenshots with `.taste-skill/inspect/*.jpg` from the mockups.
