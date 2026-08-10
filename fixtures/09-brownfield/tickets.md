# Change requests — Trade Counter

**From:** Dawn Mercer, Redland Builders Merchants
**To:** whoever picks this up
**Re:** `source.html` (the trade counter screen, as deployed)

Three things. One is costing us money, one the counter staff have asked for twice,
and one comes from the accountant. Please do all three in the same pass.

---

## TC-411 — Quote totals disagree with themselves

**Priority:** high — we have already undercharged on this once.

Reproduce it like this:

1. Open the counter. Leave the trade toggle off.
2. Find **TIM-204** (sawn treated carcassing 47 × 100mm) and click **Add**. It goes on at 1.
3. In the order panel, type `50` into that line's quantity box and press Enter or tab out.
4. Read the total. **£445.20.** The line shows no trade-break badge.
5. Click **Save as quote**, then click **Load** on the quote that just appeared.
6. Read the total again. **£411.80**, and now the trade-break badge is there.

Nothing changed between step 4 and step 6 except saving and reloading. The order is
the same 50 lengths of the same product. One of those numbers is wrong and it is the
first one — 50 qualifies for the 7.5% break and the price list says so.

You can see the same thing a third way: clear the order, type `50` into the quantity
box on the TIM-204 catalogue tile *before* clicking Add, and you get £411.80 straight
away. So it depends on how the quantity got there, not what the quantity is.

The price break table itself is right. Don't touch the price list and don't
restructure how discounts are worked out — find why the same quantity produces two
answers and fix that.

---

## TC-386 — Put a line on hold

**Priority:** medium — asked for by the counter staff, twice.

When a customer is umming about part of an order, staff currently delete the line and
re-add it later, which loses the quantity and the position in the list.

Add a **hold** control on each order line. A held line:

- stays in the order and stays visible, but is clearly marked as held;
- is excluded from the goods total, the VAT, and the order total;
- is excluded from the order weight, so it does not affect the carriage band or the
  "spend this much more for free carriage" note;
- is excluded from the saved-quote total when the order is saved — but is still
  written into the saved quote, and comes back held when that quote is loaded;
- can be taken off hold again, restoring it to the totals exactly as it was.

The order panel's line count should say how many are held when any are, e.g.
`4 lines · 1 held`.

Build it out of what is already in the file. There is one store, one dispatcher, and
one render pass; a hold feature that keeps its own state or attaches its own listeners
is not what we want, even if it works.

---

## TC-390 — Trade accounts must see ex-VAT prices

**Priority:** medium — from the accountant, and it is a compliance point, not a
preference.

The trade toggle in the header currently only halves the carriage charge. It now also
has to change the basis every price is displayed on. Nothing else about it changes.

| | Trade toggle **off** (cash sale) | Trade toggle **on** (trade account) |
|---|---|---|
| Every price and total shown anywhere | inc-VAT, as now | **ex-VAT** |
| Suffix on those figures | none, as now | **` +VAT`** |
| The VAT row in the totals panel | reads `of which VAT`, as now | reads `VAT to add`, same figure, no `+VAT` suffix on it |

"Anywhere" means anywhere: catalogue tile prices, the bulk-break hint under them, the
unit and line columns in the order, the trade-break savings badge, every row of the
totals panel including the grand total, the free-carriage note, the running total in
the header, and the figures against saved quotes.

Flipping the toggle back and forth must move every one of those between the two bases
with nothing left behind on the wrong one. That is the whole ticket — a single figure
still showing inc-VAT while the header says trade account is exactly the error the
accountant is trying to stop.

Saved quotes were saved on whatever basis was in force at the time; ignore that, and
display them on the basis the toggle is on now.

---

## Notes

- The file is deployed as-is from a single URL. It stays one self-contained document.
- We have no build step and no test suite. Say what you checked by hand.
- The next person to open this file should not be able to tell which parts you wrote.
