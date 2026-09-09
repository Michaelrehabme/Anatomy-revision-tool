# LocusMSK — logo 2a "Pulse"

All SVGs are self-contained: the wordmark is converted to outlines (Source Serif 4 —
semibold roman for "Locus", regular italic for "MSK"), so no font is needed to open,
print or edit them.

## Palette
- #1F2A44 ink navy — figure, headings, body copy
- #3F8F8A cartilage — selection, links, correct answers
- #EFE9DA bone — ground, cards
- #B3403A artery — errors only

## svg/
- lockup-primary.svg — mark + wordmark, full colour (default)
- lockup-stacked.svg — mark over wordmark + descriptor
- lockup-mono.svg — one colour navy (stamp, print, embroidery)
- lockup-reverse.svg — bone on navy panel
- mark-full.svg — mark alone, two rings (>=64px)
- mark-single-ring.svg — one ring (32-64px)
- mark-small.svg — no rings, enlarged target (<32px)
- mark-mono-navy.svg / mark-reverse-bone.svg — one-colour cuts
- app-icon-navy / -bone / -teal.svg — 1024 square icons

## png/
1024/512/192/180 app icons, 32/16 favicons, 256/512 mark, 1400px lockups.

## export/
Full-page screen captures for decks and docs:
- locusmsk-homepage.png — 1180 x 3901, the whole home page
- locusmsk-app-screens.png — 1440 x 7761, all ten mobile screens, the dark set and the three desktop views

These are PNG, not SVG. The logo files above are true vector because they are drawn
shapes; a whole interface page is HTML, and the SVG that would carry it (an embedded
HTML layer) does not survive as a portable file — so the page exports are pixel
captures at design width. For vector page output, print the page to PDF instead:
text stays selectable and opens in Illustrator.

## Rules
- Ring count drops as the mark shrinks so the deltoid target never fills in.
- Clear space: one head-height (the figure's head circle) on all sides.
- Never recolour the figure outside the palette above; never stretch the lockup.
