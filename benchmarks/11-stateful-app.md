# Stateful Application

Build an application, not a page.

**The tool:** a rehearsal room scheduler for a music venue with four rooms, open 09:00 to 01:00, booked in thirty-minute blocks across a week. Bands book rooms. Rooms have gear. Bands share members. The scheduler's job is to let one person manage the whole week quickly and to stop them making the mistakes that actually happen.

The rules that make this interesting, and which you must enforce:

- A band cannot be in two rooms at once.
- A person cannot be in two bands' bookings at once — and members overlap between bands.
- A room needs a fifteen-minute changeover between bookings.
- Some bands require gear only certain rooms have.
- Bookings have a maximum length, and there is a nightly limit per band.

Conflicts are surfaced, explained, and resolvable. They are not silently prevented — a scheduler that refuses the action without saying why is worse than one that allows it and flags it.

## Requirements

- **A real data model.** Entities with relationships, derived state computed rather than duplicated, and validation as a pure function of state that can be run over the whole week at any time. No truth stored in the DOM.
- **Undo and redo.** Full history, keyboard-driven, covering every mutation including multi-step ones. A drag that moved four bookings undoes as one action, not four.
- **Selection and bulk operations.** Multi-select, select-by-criteria, and operations that apply to a selection — move, duplicate, delete, reassign room.
- **Direct manipulation with keyboard parity.** Dragging is expected. Everything achievable by dragging must also be achievable from the keyboard, and not as a grudging fallback. Both paths get the same feedback.
- **All the states, not just the happy one.** First run with nothing in it, and it must teach the tool without a tutorial. Loading. Mid-operation. Conflict. A week so full it needs different affordances. Something the user cannot undo, guarded properly.
- **It generates its own world.** A plausible seed dataset — bands, members, gear requirements, a partly-filled week with at least one existing conflict to find — produced procedurally in code. No fixture files, no fetches.
- **Portable state.** Export the schedule and import it back losslessly. If you use browser storage, it must be optional and degrade silently when unavailable, since this runs from `file://`.
- **It must feel fast.** Smooth dragging with no layout thrash, no full re-render per pointer move, and no allocation storm in the drag path. It should stay responsive with a fully booked week.
- **Designed.** Density that suits an operator using this daily, information hierarchy that survives a busy week, and restraint. This is a tool, not a marketing page — but tools can be beautiful and this one should be.

## What is being evaluated

Whether the state actually holds. The judges will try to break it: undo across a conflict resolution, redo after a new action, drag something onto itself, select everything and delete, import a file exported after twenty operations, resize mid-drag, and see whether the derived state ever disagrees with the underlying data.

Then whether it is genuinely usable — can a judge schedule a full evening, hit a conflict, understand it, and fix it, without reading anything.

Correctness of the rules is table stakes. The score is in the handling of everything around them: the empty state, the undo model, the keyboard path, and whether the tool degrades gracefully as the week fills up. An application that works beautifully with six bookings and becomes unreadable with sixty has not been finished.
