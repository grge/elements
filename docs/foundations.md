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

## What next (proposed, not decided)

1. **An order module, modelled on E's diagram axioms.**
   - `same-side`/`opposite` and `inside`/`outside`;
   - negations paired with their positives;
   - contrapositives generated by the engine;
   - all said with points only ("on L" is collinear with the two points naming L).

   First experiment: E's same-side and Pasch axioms alone, on chapters 1–3, measuring how the work
   changes and which workaround axioms become lemmas. Before it, an inventory of every place the
   book works around sides.
2. **Continuity as rules:** E's intersection axioms, so that construction checks prove existence.
3. **Inequalities,** a later module (on the ledger).
4. **The second geometry** then shares a sounder neutral core.
