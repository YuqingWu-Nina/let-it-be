# Let It Be

A browser-based interactive writing space for an interactive-media course project. It uses only HTML, CSS, and native JavaScript—no build step or dependencies.

## Open it

Open `index.html` in a modern browser, or in VS Code use the **Live Server** extension on the `let-it-be` folder. Internet access is only used for optional Google Fonts; the interactions still work without it.

## Files

- `index.html` — semantic page structure, prompt cards, writing screen, and confirmation dialog
- `style.css` — paper, a CSS-drawn deep-green QWERTY typewriter, responsive layout, and reduced-motion support
- `script.js` — prompt choice, input observation, smooth visual targets, keyboard feedback, recovery, sound toggle, and safe text display

## Interaction logic

The page treats one or two deleted characters as ordinary correction. It keeps deletion timestamps in a rolling 10-second window and uses them to move through four states:

- **Calm** (0–2 deletes): normal paper, typewriter, and background.
- **Friction** (3–4): the visual environment begins to cool and contract; one prompt-specific question appears.
- **Overthinking** (5–7): the paper and typewriter continue to recede, and another question appears.
- **Stuck** (8+): the most muted visual state. A temporary display layer replaces some visible letters with symbols, while the actual textarea value stays intact and editable.

The background and scale ease gradually toward each state rather than jumping. After 18 characters of forward writing without another deletion, the oldest three deletion records are removed, so the experience can ease toward calm. **Let it be** immediately resets the visual state without removing any writing.

A pause is intentionally quiet unless the user has reached the overthinking state. After five seconds of silence in that state, “Why did you stop?” appears; “Can’t find the right words?” follows about 2.6 seconds later. Writing again fades those pause thoughts.
