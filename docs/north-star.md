# North star

What elements is for, and how to decide what to work on. Read this before changing the core or the
book. The [roadmap](roadmap.md) keeps the plan; the [November 2026 review](review-2026-11.md) and the
[review notes](review-notes.md) keep the evidence.

## What elements is

**A book about Euclid that you can read and play with.** Its constructions are written as Horn clauses,
short definitions that say what a figure is. From those clauses come a figure you can drag, and checks
of what can be proved about it. That is its contribution: write a figure as clauses, and get a working
diagram and its proofs. It gives one simple way to understand what a construction is and what follows
from it.

Its reader is someone curious about Euclid or about geometry, perhaps a student meeting it for the
first time. It is not written for people interested in logic programming, though they are welcome.

**Second, a workbench.** How far can a system like this go: what can it practically prove and draw,
can it carry other geometries, and is it any use beyond Euclid's first few books? The book is the
first experiment, and every chapter is also a test of the system.

## How to decide

**The page is the product.** A change is worth making when a reader would notice it: a figure that
reads well, marks that show the proposition at hand, an answer that comes while the reader still
cares, a ✓ that can be trusted. Engine work earns its place by what it does for a page.

**The clauses are prose.** A definition says what one would say about the figure; a lemma says what
Euclid says. Every hypothesis that is there only for the engine, every statement split or shaped for
speed (Pythagoras by the squares' parts), is a cost the reader pays. Pay it when there is no other
way, say why in the book, and come back for it.

**Every page is honest.** A ✓ means proved, and the hypotheses have a figure. The figure never
silently disagrees with the facts. An axiom taken where Euclid argues by cases or sides is acceptable
when the book says so plainly; a verdict that rests on a budget running out is not.

**Dependencies come from the content.** What a proof rests on is a property of the proof, not of where
the lemma is written. A ✓ should be able to say whether it needs the parallel postulate, which is what
"holds in hyperbolic geometry" means, and checks should fire only the rules that can bear on what is
asked. The order of chapters is for the reader.

**The workbench must not cost the book.** Push the system as far as it goes and write down where it
breaks (review notes). Keep generality possible: no relation names in the engine, a figure layer
that another geometry could replace. But a change for generality's sake waits until a chapter or an
experiment needs it.

**Big changes to the logic need a reader-visible reason.** Case splits, quantifiers in heads, sums: each
changes what a lemma means and how a page reads. Take one up when a chapter cannot be written
honestly without it, and design it as a whole, with what the reader will see.

The original four principles stand: keep the engine general, prefer conventions over syntax, the rules
are the meaning, and the figure never silently disagrees with the facts.

## What follows now

In order, each worth doing on its own:

1. **Figures as witnesses.** Evidence already finds a figure for nearly every lemma, in milliseconds.
   A figure of the hypotheses shows they are consistent, so the second closure that searches for
   `false` (four fifths of checking time) runs only when no figure is found. One sampler for pages and
   evidence, varying branches. The witness demands real margins on `distinct` and `triangle`, and the
   tests still run the full search, so a wrong axiom still shows.
2. **Pages that answer quickly.** Definitions as abbreviations rather than rules that fire; relevance,
   so a check fires only rules that can reach its goal; a marks closure that does not take tens of
   seconds. Then the evaluator itself (semi-naive, indexed), measured, if pages still wait.
3. **What a page shows.** Marks chosen by the page's statement first; a class that tiles a figure
   shown as what it is; figures that read well (no slivers, the construction in its natural order);
   drawing through the unfolding (the open question of what a construction draws).
4. **Pay back what was done for speed.** Pythagoras with whole squares; guards whose only reason was
   the join; I.43.
5. **Dependencies.** Each ✓ says whether it needs the postulate.
6. **More book.** Chapter 5 (the circle) and then ratio, each written as the book wants and measured as
   an experiment. A sibling geometry when the figure layer is ready for one.

Not now: turning lemmas into rules, composing plans per definition, a change of logic. Each could come
back if a chapter or an experiment shows the need.
