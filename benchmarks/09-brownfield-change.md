# Brownfield Change Request

> **Fixture required.** This task ships with a starting file at
> `fixtures/09-brownfield/source.html` — an existing, working, single-file application of
> roughly 600–900 lines with deliberate and consistent house conventions. The runner
> supplies its full contents in the prompt. The model returns the **complete modified
> document**, per the output contract; scoring is performed on the diff against the source.
>
> The fixture is fixed for the life of the benchmark. Do not regenerate it between runs.

---

You have inherited a working application. It is not how you would have written it. That is not the task.

Three change requests have come in from the client. Implement all three. Change nothing else.

## The tickets

**1 — Bug.** Under a specific and reproducible condition, the application produces a wrong result. It is a real bug with a real cause, and finding it requires reading the existing logic rather than pattern-matching. The fix is small. A rewrite of the surrounding subsystem is not a fix.

**2 — Feature.** Add a capability that must be built out of the abstractions already present in the file. There is an existing state container, an existing event pattern, and an existing render path. Use them. A feature bolted on beside the architecture, with its own parallel state and its own listeners, fails this ticket even if it works.

**3 — Change of behaviour.** An existing behaviour must change in a way that touches several call sites. Find all of them. Missing one is the point of the ticket.

*(Exact ticket text lives in `fixtures/09-brownfield/tickets.md` and is supplied alongside the source.)*

## Requirements

- **Minimise the diff.** Every changed line must be justified by a ticket. Reformatting, reordering, renaming, "tidying", converting `var` to `const`, adding semicolons the file does not use, or replacing a hand-rolled utility with a CDN library are all failures, however much better the result.
- **Match the house style exactly.** Indentation, quote style, naming conventions, comment style, function shape, CSS class naming, and file organisation are all already decided. Follow them even where you disagree. New code should be indistinguishable in style from old code.
- **Do not modernise.** If the file uses a pattern that is out of fashion, that pattern stays. You are not being asked for your opinion on the architecture.
- **Do not break what works.** Every existing feature must still function. State the manual verification you performed.
- **Leave a change note.** At the top of the file, in the comment style the file already uses, a short block listing what you changed and where. No essays.
- If a ticket is ambiguous or you believe it is a bad idea, implement the most reasonable reading and say so in the change note. Do not silently substitute a different feature.

## What is being evaluated

Restraint, mostly. Whether the model can read code it did not write, work inside someone else's decisions, and produce a change a reviewer would approve without argument.

The measurements are: diff size relative to the minimum viable diff; whether each ticket is actually satisfied; whether all call sites for ticket 3 were found; whether any existing behaviour regressed; and whether the new code is stylistically invisible against the old.

A model that rewrites the file into something objectively cleaner and passes all three tickets scores near the bottom. This is the most common failure and it is not a near miss — in a real codebase it is the outcome that gets the pull request closed.
