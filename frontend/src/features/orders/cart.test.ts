import { describe, expect, it } from "vitest";
import type { MenuItem } from "../../lib/types";
import { addItem, countItems, priceCart, pruneCart, quantityOf, removeItem, setQuantity, toCents, MAX_QTY } from "./cart";

const item = (id: string, price: number, available = true): MenuItem => ({
  id,
  name: id,
  category: "burgers",
  description_es: "",
  description_en: "",
  price,
  price_note: "",
  tags: [],
  allergens: "",
  available,
  sort_order: 0,
});

const MENU = [item("cheese", 9.5), item("croq", 1.5), item("big", 14.5), item("hidden", 5, false)];

describe("cart operations", () => {
  it("adds, increments, sets and removes", () => {
    let c = addItem([], "cheese");
    c = addItem(c, "cheese", 2);
    c = addItem(c, "croq");
    expect(quantityOf(c, "cheese")).toBe(3);
    expect(countItems(c)).toBe(4);
    c = setQuantity(c, "croq", 6);
    expect(quantityOf(c, "croq")).toBe(6);
    c = setQuantity(c, "cheese", 0);
    expect(quantityOf(c, "cheese")).toBe(0);
    c = removeItem(c, "croq");
    expect(c).toEqual([]);
  });

  it("clamps quantities to 0..MAX_QTY and ignores negatives", () => {
    expect(quantityOf(setQuantity([], "big", 999), "big")).toBe(MAX_QTY);
    expect(setQuantity([{ menuItemId: "big", quantity: 2 }], "big", -3)).toEqual([]);
  });

  it("keeps insertion order", () => {
    const c = addItem(addItem(addItem([], "big"), "cheese"), "big");
    expect(c.map((l) => l.menuItemId)).toEqual(["big", "cheese"]);
  });
});

describe("pricing", () => {
  it("computes line totals, subtotal and total in cents", () => {
    const p = priceCart(
      [
        { menuItemId: "cheese", quantity: 2 },
        { menuItemId: "croq", quantity: 3 },
        { menuItemId: "big", quantity: 1 },
      ],
      MENU,
    );
    expect(p.rows.map((r) => r.lineCents)).toEqual([1900, 450, 1450]);
    expect(p.subtotalCents).toBe(3800);
    expect(p.totalCents).toBe(3800);
    expect(p.itemCount).toBe(6);
  });

  it("avoids float drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    const p = priceCart([{ menuItemId: "croq", quantity: 7 }], [item("croq", 1.15)]);
    expect(p.totalCents).toBe(805);
  });

  it("drops hidden or deleted items and reports them", () => {
    const lines = [
      { menuItemId: "cheese", quantity: 1 },
      { menuItemId: "hidden", quantity: 1 },
      { menuItemId: "gone", quantity: 2 },
    ];
    const p = priceCart(lines, MENU);
    expect(p.missing).toEqual(["hidden", "gone"]);
    expect(p.totalCents).toBe(950);
    expect(pruneCart(lines, MENU)).toEqual([{ menuItemId: "cheese", quantity: 1 }]);
  });

  it("empty cart is zero", () => {
    expect(priceCart([], MENU)).toMatchObject({ rows: [], subtotalCents: 0, totalCents: 0, itemCount: 0 });
  });
});
