# Foundations

What the book's axioms are, where each kind lives in the system, which other geometries could
share them, and what Avigad, Dean and Mumma's System E shows about the gaps (November 2026). This
was written while preparing the second geometry ([roadmap.md](roadmap.md), *Another geometry, as a
proof of concept*). It is analysis, not yet a design: what it proposes is under *What next*, and
nothing there is decided.

## In short

- **Most axioms are explicit.** Incidence, order along a line, congruence and the parallel postulate
  are ordinary clauses in the `.geo` files.
- **Existence and continuity are code.** They live in the planner and the construction checks.
- **Distinct names are a convention.** Different names are different points, licensed by the
  figures.
- **Sides are missing.** Plane separation (which side of a line a point is on) is nowhere: not in
  the rules, not in the code. With inequalities (no `<` anywhere in the book), it is one of the two
  foundational gaps.
- **Sharing is by groups of axioms.** Geometries share content by the axiom groups they have in
  common, not by being one book with extensions.
- **The proposed organisation:** a theory built from modules (groups of axioms, each with its own
  words), books written per geometry, and pages shared between books by reference.
- **System E fills the gaps.** Its proof structure is ours. Its rules for sides, intersections and
  disjunctions fill exactly our gaps. Tarski's axioms, which E is proved complete against, use our
  language: points, betweenness and equal lengths.

## Where the axioms live

**In the knowledge base.** Each chapter opens with an `Axioms` section of ordinary clauses:
- *Equality and congruence:* `eq-point`; `eq-lines` as an equivalence; common notions 2 and 3
  along a line (chapter 1). Angles, supplements and right angles (chapter 2), where side-angle-side
  is an axiom, as in Hilbert.
- *Incidence:* "two distinct points determine a line" is one clause in chapter 1.
- *Order on a line:* `between`, its symmetries, and order along a line (chapter 1).
- *Parallels:* Playfair as the transitivity of `parallel`, and I.29 (chapter 3). Its section *The
  parallel postulate* already marks the seam: "A hyperbolic book shares everything above and parts
  here."
- *Chapters 4–7:* most of their axioms are Euclid's theorems, taken as axioms to get on
  ([consolidation.md](consolidation.md), *Axioms that are theorems in Euclid*).

The engine adds no geometric axioms. `structure.ts` proves each structure it uses from the
predicate's own rules. The sum and difference solvers are sound in any abelian group, given the
turn rules the book states. Reading definitions as if-and-only-if (`definitions.ts`) is a logical
convention, not a geometric one.

**Elsewhere.**
1. **Existence and continuity, in the geometry code.** Forward chaining never creates a point.
   `circle-circle-intersection` defines what such a point is; nothing says one exists. The existence
   half of Euclid's postulates (extend a line, draw a circle, two circles meet) lives in three
   places: the planner's loci and intersections (`construction.ts`), `locusAlwaysExists`, and the
   construction-step checks (`constructionStep.ts`). All of it is Euclidean. In the hyperbolic plane,
   two perpendicular bisectors can fail to meet.
2. **Plane separation, nowhere.** There is no Pasch axiom and no "same side". Chapter 3 says so:
   "Which side of a line a point lies on is not something the engine can say." The book works around
   it in three ways:
   - angle addition said through `between` (chapter 2);
   - "same side" said as "opposite sides twice" (chapter 3);
   - facts about sides taken as axioms (chapter 3, the square; chapter 5, the angle at the centre
     and III.21).
3. **Distinct names, a convention of the checker.** Under `distinctNames`, different names are
   different points (`nonDegeneracy`, `checker.ts`), licensed by the figures: evidence witnesses a
   configuration where the points are apart.
4. **The model, a check rather than axioms.** `relations.ts` and `measure.ts` give each word its
   Euclidean meaning, and numeric evidence uses them. The check is one-sided. A chapter 2 lemma
   that holds only in Euclid's plane, such as the angle sum, fails its search but holds in every
   Euclidean figure, so the page says "probably true" for a lemma that is not neutral. A chapter 2
   axiom that quietly assumes Euclid would never fail either. Figures in a hyperbolic model would
   catch both. A second model is an audit of the neutral chapters.

Points 1 and 3 are defensible as they are. Point 2 is the foundational one.

## Geometries and their axiom groups

The axiom groups are Hilbert's: incidence, order, congruence, continuity, parallels. This is an
axiomatic lens, which suits the book. Klein's Erlangen programme is the other lens: a geometry as a
group of transformations and what it leaves unchanged. That one suits the model, where sampling
should be unchanged under the geometry's group. Neither lens organises the content by itself.

Order is two questions: the order *along* a line, and whether a line *divides* the plane.

| Geometry | Incidence | On a line | Does a line divide the plane? | Congruence | Parallels |
|---|---|---|---|---|---|
| Euclidean | ✓ | betweenness | yes: two sides (Pasch) | ✓ | exactly one |
| Hyperbolic | ✓ | betweenness | yes | ✓ | many |
| Real affine | ✓ | betweenness | yes | – | exactly one |
| Spherical | two points make a line, except at antipodes | separation (lines are closed) | yes: two hemispheres | ✓ | none |
| Elliptic | ✓, lines always meet | separation | no: it takes two lines | ✓ | none |
| Projective | ✓, lines always meet | separation | no: it takes two lines | – | none |
| Inversive | points and *circles*: three points make one circle | separation on circles | a *circle* has two sides | angles between circles only | *touching* instead |
| Finite affine | ✓ | – | – | – | exactly one |
| Finite projective | ✓, lines always meet | – | – | – | none |

Separation is a relation on four points (the pair a, b separates the pair c, d; Coxeter writes
AB//CD). `between` can be had from separation by choosing a line at infinity, but not the other way
round.

**What the pairs share.**
- *Euclidean and hyperbolic:* neutral geometry, chapters 1–2. The one large shared core, and the
  one place where "a book with extensions" fits.
- *Euclidean and real affine:* ordered affine geometry. Parallelograms, midpoints, ratios along a
  line, the centroid, the midline, parallel projection: roughly chapter 3 without angles. Without
  order, finite affine planes join (incidence plus Playfair). In characteristic 2, a
  parallelogram's diagonals are parallel.
- *Hyperbolic and real affine:* ordered geometry (Coxeter). Incidence and order only: Pasch, plane
  separation, the crossbar theorem, convexity. The order half of chapter 1, shared by everything
  with `between`.
- *Euclidean, hyperbolic and elliptic:* metric planes (Bachmann). Incidence and congruence without
  order, built from reflections. For example, a triangle's perpendicular bisectors always lie in one
  pencil; likewise its altitudes. The surprising pair: elliptic shares real content with neutral,
  only not through chapter 1's order.
- *Elliptic and projective:* projective geometry is contained in elliptic geometry, which is the
  real projective plane with a metric.
- *Projective and the metric geometries:* by Cayley and Klein, Euclidean, hyperbolic and elliptic
  geometry are projective geometry with a chosen absolute. Desargues and Pappus hold in all of
  them, but only with points at infinity or ideal points.
- *Finite and real:* incidence, plus whatever extra axiom both satisfy. Pappus holds over every
  field but does not follow from incidence alone, so it would be a small group of its own. The
  Fano plane breaks Fano's axiom, so the complete-quadrangle theorems split.
- *Inversive:* fix a point as ∞, and the circles through it become lines: the *derived plane* is
  affine. In Klein's lens, Euclidean, spherical and hyperbolic geometry are all subgeometries of
  inversive geometry; the Poincaré disk is a piece of it. Inversive geometry is axiomatised as a
  Möbius plane (Benz), with Miquel's theorem in Pappus's role. It shares with Euclid the theorems
  that survive inversion: concyclicity, tangency, angles between circles, Miquel.

The intersection of two geometries' axioms is only a lower bound on what they share. Some theorems
hold in both for different reasons; Pappus is the example. Some relations between geometries are
not shared axioms at all but interpretations, one theory modelled in another: the Poincaré disk
inside Euclid, affine geometry inside inversive geometry at a point.

**Fit with the system.**
- *Fits as is:* hyperbolic (the disk's lines and circles are Euclidean circles, and its angles are
  Euclidean); neutral (a book, checkable in both models); inversive.
- *Needs separation instead of betweenness:* spherical, elliptic, projective. Projective is also
  awkward to draw: points at infinity need a chart, and parts of a figure leave the page.
- *Logic only:* finite geometries (evidence by enumeration, no continuous figure); taxicab (two
  circles can meet in a segment, so the planner's "a point where two curves meet" breaks).
- *Out of scope:* solid geometry.

## How to organise it

From one extreme to the other:
- *one book and one theory per geometry:* simple, but shared content is copied and drifts;
- *every geometry constructed from a selection of axioms:* the book content for each geometry falls
  out of the selection.

The proposal is between the two, split along the line the system already has: the theory is the
rules, the book is the pages.
- **A theory is built from modules.** A module is an axiom group with the words it brings. A geometry
  is a list of modules plus a model. A module owns its words: `between` belongs to order, and
  elliptic geometry swaps it for separation.
- **A book is written per geometry,** because a book is an arrangement for a reader: what comes
  first, what matters, what motivates the next page. A lattice-derived book would be a catalogue.
- **Books share pages by reference.** A page carries the modules it needs, and is checked under
  each geometry's theory. The hyperbolic book would be the neutral pages plus its own chapters.
- **Validity can be computed; organisation cannot.** The search shows that a lemma follows from
  some modules; a model's counterexample shows that it does not follow from fewer. `bookScope.ts`
  already checks lemmas with "the rules up to chapter n". Checking them with "these modules" is the
  same mechanism, so it could map which pages a geometry can reuse.
- **Cases drive the splits.** The hyperbolic proof of concept needs exactly one split: neutral
  rules from the two parallel axioms. Affine would be the real test, since it cuts chapter 1 into
  order and congruence.

## System E

Avigad, Dean and Mumma, "A formal system for Euclid's Elements", *Review of Symbolic Logic* 2
(2009). E models Books I–IV as construction steps and deduction steps. Each deduction is a "direct
consequence" of the diagram, which is a set of facts closed under rules, not a picture. E is proved
sound and complete for ruler-and-compass geometry, through Tarski's axioms.

### Side by side

| | System E | Elements |
|---|---|---|
| **Objects** | Six sorts: points, lines, circles; and lengths, angles and areas as values | Points only. A line is two points (`collinear`); a circle is a centre and a point (`circle a b c`). Magnitudes are classes (`eq-lines`, `eq-angle`), not values |
| **Diagram words** | `on`, `same-side`, strict `between`, `inside`, `centre`, `intersects` | `collinear`, `between`, `circle`. No `same-side`, `inside` or `intersects` |
| **Negation** | Any fact may be negated | Two negations, each a positive word: `distinct` (not `eq-point`) and `triangle` (not `collinear`), tied back by `false` clauses |
| **Deduction** | Each axiom read as a disjunction; any part follows once the others are known false (unit propagation, contrapositives included) | Horn forward chaining, with the structure the engine proves; a bounded search for written steps |
| **Magnitudes** | An ordered abelian group: +, <, 0, decided by linear arithmetic | Equality only: classes, and the integer-lattice solver for turns. No `<` |
| **Constructions** | A fixed list of rules, each with prerequisites that are logical facts: "L and M intersect" follows from "c and d are on opposite sides of L" | The planner places points on loci; existence is judged by the model, otherwise witnessed |
| **Continuity** | Intersection axioms in the logic (a line through an inside point meets the circle) | Only in the model |
| **Parallel postulate** | One transfer axiom, an existence claim: these lines meet, on this side | Playfair, plus I.29 as an axiom |
| **SAS and SSS** | Superposition, read as elimination: assume a copy of the triangle exists, and conclude only about the objects already there | SAS is an axiom |
| **Degenerate cases** | Explicit: every distinctness is a hypothesis | Convention: different names are different points, licensed by the figures |
| **Proofs** | Constructions, deductions, applying proved theorems, case splits | `?` steps, constructions (existential elimination), citations. No case splits |
| **Completeness** | Sound and complete for ruler-and-compass geometry | None claimed |
| **Finding proofs** | Not addressed; the authors do not look for constructions | Search, the planner, figures, numeric evidence |

### What it teaches

1. **Disjunctions without case splits.** E's axiom that one of three points on a line is between
   the others, and its axiom that a point off a line is on one side or the other, are disjunctions.
   They are used by unit propagation: two parts known false give the third. To do the same:
   - each needed negation becomes a word of its own, paired with its positive by a `false` clause,
     as `distinct` already is;
   - the engine generates each clause's contrapositives, one variant per literal as head.

   This adds no new logic, only more rules. The cost to the work budget is the open question.
2. **Pasch in Horn-sized pieces.** E's same-side axioms make "same side of L" an equivalence with
   two classes per line: a signed class, the structure `ParityUnionFind` already implements. Its
   four Pasch axioms are nearly rules as stated; the fourth concludes `between` from "not on the
   same side", so it needs `opposite`. These, with the triple-incidence axioms, are a first draft
   of an order module.
3. **Existence in the logic.** E's intersection axioms make "these circles meet" a fact derived from
   `inside` and `on`. That would replace "witnessed" with a proof, make continuity a module of rules
   rather than code, and leave the model's existence contract only to agree with the rules. E's
   intersection rules 8 and 9 choose the point "on the same side of L as b", which our planner
   cannot be told today (chapter 1's vesica: "the clauses allow either").
4. **The same cut.** E's groups map onto ours:

   | E's group | Elements |
   |---|---|
   | Diagram axioms | chapter 1's incidence and order, plus the missing sides and circles |
   | Metric axioms | the classes |
   | Transfer axioms | the bridge rules: common notions, angle addition, right angles |
   | Parallel postulate | a single axiom |

   E without that one transfer axiom is neutral, which supports the neutral and parallel modules.
5. **Superposition is a construction step our checks already allow.** E's condition (conclude
   nothing about the copy) is the freshness and conservativity of construction steps (checker.ts,
   `checkWrittenProof`; constructionStep.ts). SAS could become a lemma proved by superposition, if
   the planner can place a copy of triangle abc on d, along L, on h's side.
6. **Inequalities are a gap.** Euclid needs "greater than" and "the whole is greater than the part"
   for I.6, I.7, I.18–20, the triangle inequality and the uniqueness arguments. Linear order over an
   abelian group is the difference solver's structure with ≤ added.
7. **Tarski's language is ours.** E's completeness goes through Tarski's axioms: points only,
   betweenness and equidistance. Tarski's universal axioms read as our rules. His existential axioms
   (segment construction, Pasch, the parallel postulate, intersection) are our constructions.
   Tarski is the guide to *what* the rules should be, E to *how* to reason with them. The Tarski
   school also studied neutral and hyperbolic variants. (From memory, not checked: GeoCoq formalises
   Tarski's geometry, neutral variants included.)
8. **The engine is on the path they pointed to.** A student's eager-saturation checker for E "gets
   bogged down with diagrams of moderate complexity"; the authors suspect better representations
   would fix it, then turned to SMT solvers. Union-find, signed classes and symmetry breaking are
   such representations.

## Sides: the inventory

Every place the book works around sides of a line (November 2026, at 25aafce). It covers the
chapters, *Beyond the book*, the planner and the docs. The book gets by in six ways. Then come what
sides block, what the figure does, and what is not a sides question at all.

### Six ways round

1. **Opposite sides as a crossing.** a and d are on opposite sides of e-f when some m has
   `between a m d` and `collinear e m f`. This is Tarski's definition, and book.md, *Sides of a line
   without sides*, records it. Where it is used:
   - I.27 and I.29, both axioms of chapter 3;
   - the parallel through a point (I.31, `parallel-through`), whose crossing picks the far side;
   - I.33 as a lemma;
   - chapter 2's rule that a point across the line b-c is off a-b.

   Each side fact costs a named point that a reader would not name. A construction has to produce
   that point, and the lemma's statement carries it.
2. **Same side as opposite sides twice:** a third point x across the line from both. Used by
   corresponding angles, the angles on one side (I.29's third part) and both converses (I.28): four
   lemmas of chapter 3 (book.md, *Same side, as opposite sides twice*).
3. **Inside an angle as a point on a segment.** Angles add and take away only when the dividing
   arm passes through a point of the segment a-c: chapter 2's two common-notion axioms. The arms rule
   says "on the ray" as `between`. This is the most-used workaround. Every sum of angles in
   chapter 2 goes through it, and it says less than "inside the angle", which E's angle transfer
   axiom 2 gives through `same-side`.
4. **"Outside" and "convex" as segments that cross.** Here two segments sharing a middle point
   stand for a shape:
   - the parallelogram's definition, whose crossing diagonals "follow from the parallels, by an
     argument about sides the engine cannot make";
   - its I.33 lemma and its diagonals lemmas;
   - the windmill, whose squares stand outside the triangle, "said with the points where the
     windmill's lines cross";
   - the complements, and the rectangle made a square.

   Elsewhere the crossing is the content and stays: vertical angles, crossing chords, the medians,
   the inscribed square, the centroid, I.10.
5. **Sides stated in lemmas, not in definitions.** A rectangle's two lemmas add x and n (d-a
   extended past a, with x-c crossing a-b at n), because carrying the right angle across a-b needs
   them (book.md, *Definitions stay simple; lemmas state the sides they need*). The square reuses
   them.
6. **Theorems taken as axioms because their proofs need sides**
   ([consolidation.md](consolidation.md), *Axioms that are theorems in Euclid*):
   - side-side-side (I.8) and angle-side-angle (I.26), in chapter 2;
   - III.21 and its converse, in chapter 5, whose proof needs the centre's side of the chord and
     halving;
   - the shear (I.37) and the median (I.38), in chapter 4, whose proofs split on where the apexes
     fall (sides, then a case split);
   - I.29, whose proof needs a sum, and the same side within it.

**Turns, chosen to need no sides.** Turns are not a workaround to remove: they are a good tool and
stay. But several choices were made partly so that no side need be said:
- the circle's angles (chapter 5);
- similarity, as four axioms by turns (chapter 6: "the triangles may lie anyhow");
- Pythagoras from a quarter turn (chapter 4: "a turn knows no sides");
- the III.3 converse by quadrance ("whichever side of m they lie").

With sides, Euclid's undirected forms become sayable beside them: III.20, III.21 proved, III.22 as
supplementary angles.

### What sides block

- **III.20**, the angle at the centre: it waits for an undirected book with sides.
- **The circumcentre on a perpendicular bisector** (*Beyond the book*): which side of the vesica's
  points o lies decides the angle. Written out, with o between them, it proves at once.
- **The nine-point circle's two order steps:** the right angle at k on c's side, and the
  parallelogram a-f-d-e's diagonals crossing.
- **I.39–40**, the converses of I.37: they need "same side", and are left out of chapter 4.
- **Turns into equal angles**, a return bridge that needs orientation (roadmap, *Logic*).
- **Concluding `right` from a quarter turn:** it needs a point past the vertex, on a known side.
  That is existence as well as sides (ledger).

### The figure

- **The planner has no side word.** Order facts are not equations: they choose which intersection
  to take and bound where a point may go (construction.ts). A side is decided by backtracking
  against later order facts, otherwise by the first branch:
  - the vesica's two triangles are on opposite sides only because "the clauses allow either";
  - a chord placed from its midpoint is placed "on the side that gives the turn (tried, not
    derived)";
  - order facts on circles are only checked, not used to restrict sliders to arcs (roadmap).
- **Numeric evidence samples both sides** wherever the hypotheses do not fix one. That is how the
  missing crossings were found, and it should stay.
- **What a side word would be to the figure.** It would be the first word of the plane that is a
  region, not a curve. Its measure is the sign of a determinant. To the planner it is an order fact
  like `between`: a branch chooser and a bound, not a locus. It draws nothing of its own.

### Not sides

- **Cases:** chapter 1's circumcentre is drawn, not proved, because x between c and d and x beyond
  d are two lemmas that cannot be joined. E's trichotomy of `between` is a disjunction. Unit
  propagation uses it only when two of its parts are known false, so joining cases still needs a
  case split.
- **Comparison:** angle-angle-side ("Euclid argues it by comparing sizes"): inequalities.
- **Incidence of circles:** a line meets a circle at most twice (chapter 2, *Chapter 1's debts*).
- **Book V:** the intercept theorem, componendo and dividendo.

### Where it points

- The six ways round meet one word (`opposite`, with `same-side` its pair) and two rules: E's Pasch
  axiom 4, which gives the crossing when it is needed, and E's angle transfer axiom 2, which gives
  "inside the angle".
- Measure the order module against the six ways first, starting with the cheapest test of whether
  it pays: chapter 3's four same-side lemmas restated with `same-side`, and chapter 2's angle
  addition with "inside".
- The blocked list is where the module would earn its keep.
- The axioms of way 6 are the hardest. They also need case splits or superposition (*What it
  teaches*, 5), so they are the last test, not the first.

## Sides: the first build

Measured November 2026, at 62b9330. The rules are in `scripts/prototypes/sides.geo`; they are not
in the book.

**What was tried.** E's side axioms, said with points, in chapter 2 after `triangle`:
- `same-side p q a b` and `opposite p q a b`, with their symmetries;
- any two points of the line name it;
- equal points exchanged;
- same side an equivalence, `opposite` its flip, nothing on both;
- Pasch in E's four pieces, plus one contrapositive written by hand;
- `inside x a b c` as a definition.

In the figure, each word was a relation entry whose `holds` is the sign of a cross product, checked
by the planner as `triangle` is.

**What it cost.** The book's bench, each chapter with its own rules, as the app checks: 98 lemmas,
75 proved, 19.7 s and 194,369 derivations before the change.

| Rules in | Time | Derivations |
|---|---|---|
| none (baseline) | 19.7 s | 194,369 |
| all | over 600 s | — |
| without the line-naming rules, `false`, or the rules concluding `between` and `triangle` | 20.1 s | 202,517 |
| the same, with `false` | 22.4 s | 307,650 |
| the same, with line-naming as well | 24.1 s | 324,426 |
| all but line-naming and `false` | over 320 s | — |

Lemma by lemma, with all the rules, the first 64 lemmas took 74 s against 5.7 s. Nearly all of it
went to figures full of crossing segments:
- the complements (I.43): 2.0 s to 64 s, and *proved*, which the bench without the convention could
  not do before;
- the parallelogram's diagonals: 13 times slower;
- the midline's written proof: lost to its budget.

The parallelogram's opposite sides cost almost nothing more (1,183 derivations against 1,117).

**Why.** Three mechanisms:
1. **`false` is in every search.** `relevant` (saturate.ts) always counts `false` as needed, since a
   contradiction proves any goal. So every rule that can reach a contradiction joins every search,
   even when a figure has witnessed the hypotheses consistent, so that no contradiction can follow
   from true axioms.
2. **Rules that leave the vocabulary.** Pasch's crossing (`opposite` gives `between`) and "a point
   with a side is off the line" (giving `triangle`) make the side rules relevant to almost every
   goal. Any axiom stated with sides (I.29 with `opposite`, say) would do the same for angles.
3. **Lines as pairs of points.** Pasch's pieces make side facts from every `between` and every pair
   of points naming a line through it. The line-naming rules then copy each fact to every pair of
   points on that line, and the equivalence and flip rules multiply them again: O(n²) facts per line
   where E has one line. This is the multiplier. It is the paper's own report too: an eager
   saturation checker for E "gets bogged down with diagrams of moderate complexity".

**What it shows.**
- The axioms work: the complements proved with them where they did not before.
- The cost is a matter of representation, not logic. The fixes are engine structure, of the kinds
  the engine already has:
  - **Lines as classes:** a pair of points standing for its line, with a side fact's line block
    rewritten to its class, as equal points are rewritten to theirs. That is substitution of
    equals, generalised from points to blocks. It answers the open question of lines as objects.
  - **Sides as signed classes per line:** for each line, the points off it in two classes. This is
    `ParityUnionFind`, as supplements are signed classes of angles. One fact per point per line, not
    one per pair of points per pair naming the line. It would be recognised from the rules as an
    equivalence with a parameter, the line, and `opposite` as its flip.
  - **`false` only when it can matter:** with a witness, the rules that lead only to a
    contradiction are left out of the goal search. That is general, and useful before sides too.
- Contrapositives cannot be generated mechanically as planned (*What it teaches*, 1). The negation
  of `same-side p q a b` is not one word: it is "p is on the line, or q is, or they are opposite".
  Paired words cover a negation only where it is a single literal (`distinct`, `triangle`), so the
  side contrapositives are written by hand, each with its "off the line" guards.

## What next (proposed, not decided)

0. **Engine structure for sides** (*Sides: the first build*): lines as classes, sides as signed
   classes per line, and `false` left out of a witnessed goal search. Then the prototype measured
   again.
1. **An order module, modelled on E's diagram axioms.**
   - `same-side`/`opposite` and `inside`/`outside`;
   - negations paired with their positives;
   - contrapositives written by hand, with their guards;
   - all said with points only ("on L" is collinear with the two points naming L).

   First experiment: E's same-side and Pasch axioms alone, on chapters 1–3, measuring how the work
   changes and which workarounds go (*Sides: the inventory*).
2. **Continuity as rules:** E's intersection axioms, so that construction checks prove existence.
3. **Inequalities,** a later module (on the ledger).
4. **The second geometry** then shares a sounder neutral core.
