# elements

Euclidean geometry you can write, check and drag. You state geometric facts and constructions as Horn
clauses; elements checks your lemmas as you type and draws each construction the way Euclid would, with
ruler and compass, as a figure whose points you can drag.

![A page of the book in elements](docs/images/screenshot.png)

elements comes with a book, in progress, that will cover the content of Euclid's plane geometry in its
own order, one chapter per kind of equality: length, angle, direction, area, ratio (see
[docs/book.md](docs/book.md)). The page above is from chapter 1; chapter 2, angle, is under way. The construction

```txt
vesica a b c d:
    eq-triangle a b c
    eq-triangle a b d
```

is drawn with ruler and compass, and each `?` proposition beside it carries a ✓ because the engine
proves it from the chapter's axioms.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest, about 30 s
npm run build     # type-check and build to dist/
```

Pushing to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).

## A short tour

- **The scratchpad** is the page you start on. Write facts (`eq-triangle a b c`), rules
  (`midpoint m a b: between a m b, eq-lines a m m b`) and questions (`? eq-lines a b b c: eq-triangle a b c`).
  The figure redraws as you type; each `?` line gets ✓ (proven), ✗ (false: a figure breaks it), ?
  (not proven, with whether it held in every sampled figure) or ⊥ (its hypotheses contradict each
  other).
- **Drag points.** Solid points are free, ringed ones slide along a line or circle, open ones are
  determined by the construction (dragging one reverses the construction around it).
- **The figure shows what is written.** Each relation has its own drawing (`between` a finite straight
  line, `circle` a circle, `right` Byrne's square); facts inside a construction are drawn fainter the
  deeper they are. Tick marks and angle arcs mark only equalities that are stated or proven by a ✓
  lemma, and lemmas travel with their constructions. Hover an element to see where it came from (and,
  for a mark, its chain of equalities), with its source lines lit; hover a fact in the source to bring
  forward what it draws.
- **The steps** under the source describe the construction in words; touching a point (or hovering its
  step) shows the loci that placed it. If the figure cannot be built in its current position (two
  circles that no longer meet), the failing step is marked and the reason shown. A figure the planner
  cannot construct is drawn by a numerical solver instead, and the status line says so.
- **Contents**: click `ELEMENTS` or the title to browse the book chapter by chapter, as cards with a
  miniature of each figure, or add predicates of your own (stored in your browser). A construction's
  page shows its definition with the propositions about it.
- **Themes**: the swatches top right; with *shuffle* on, the colours change each time you open
  something from the contents.

## How it works, in brief

The clauses form a knowledge base. A predicate's defining clause is read as *if and only if*, so
hypotheses can be unfolded into what they mean; everything else is ordinary forward chaining. The
engine recognises equality and symmetry in the rules by proving them, and uses that to run fast without
knowing anything about geometry. To draw, the facts are unfolded as the logic unfolds them, and one
table of relations (`src/geometry/relations.ts`) says what each is to the figure: the leaves become
constraints for a planner that finds a ruler-and-compass construction (each point free, sliding on one
locus, or where two loci meet), and the first drawn fact on each path is what the figure shows. Every
fact is checked on each frame. Marks come from stated equalities and proven lemmas, in classes merged
by the forward closure. See [docs/architecture.md](docs/architecture.md).

## Repository

```
src/
  language/     lexer, parser; book/ holds the bundled book, one chapter per .geo file
  kb/           inference: definitions, recognised structure, forward closure, checking
  geometry/     from facts to figures: the relation table, extraction, the construction planner, the
                figure and its marks, the numerical fallback
  composables/  page state, the knowledge base, the verification worker client
  components/   the code editor and the figure
  views/        the page
  workers/      lemma checking and the figure's forward closure, off the main thread
tests/          vitest suites (see docs/architecture.md#tests) and fixtures/
docs/           documentation
```

## Documentation

- [Book](docs/book.md): what the bundled book covers and how it is organised.
- [Language](docs/language.md): syntax and semantics, including how definitions are recognised.
- [Architecture](docs/architecture.md): how checking and drawing work, and why.
- [Design](docs/design.md): the visual design, what is built and what is planned.
- [Roadmap](docs/roadmap.md): open problems and ideas; next up, showing when a figure is solved rather than constructed.
