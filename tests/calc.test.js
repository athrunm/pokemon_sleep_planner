// calc.js のテスト。ブラウザでは tests/calc.test.html、Node では `node tests/calc.test.js` で実行
(function (root) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Calc = isNode ? require("../js/calc.js") : root.Calc;

  const ingredients = [
    { id: "apple", name: "リンゴ", energy: 90 },
    { id: "milk", name: "ミルク", energy: 98 },
    { id: "egg", name: "エッグ", energy: 115 },
  ];
  const recipes = [
    { id: "mix", name: "ごちゃまぜ", category: "curry", ingredients: {}, baseEnergy: 0 },
    { id: "a7", name: "リンゴ7", category: "curry", ingredients: { apple: 7 }, baseEnergy: 700 },
    { id: "m7", name: "ミルク7", category: "curry", ingredients: { milk: 7 }, baseEnergy: 800 },
    { id: "big", name: "大きい", category: "curry", ingredients: { egg: 20, milk: 10 }, baseEnergy: 5000 },
    { id: "s8", name: "サラダ", category: "salad", ingredients: { egg: 8 }, baseEnergy: 900 },
  ];
  const byId = Calc.indexRecipes(recipes);
  const settings = { potBase: 15, campTicket: false };

  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, message: e.message });
    }
  }
  function eq(actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error("expected " + b + " but got " + a);
  }

  function plan(...ids) {
    const p = new Array(21).fill(null);
    ids.forEach((id, i) => { p[i] = id; });
    return p;
  }

  test("mealLabel", () => {
    eq(Calc.mealLabel(0), "月曜朝");
    eq(Calc.mealLabel(20), "日曜夜");
  });

  test("potCapacity: 平日・日曜・キャンプチケット", () => {
    eq(Calc.potCapacity(15, 0, false), 15);
    eq(Calc.potCapacity(15, 6, false), 30);
    eq(Calc.potCapacity(15, 0, true), 22);
    eq(Calc.potCapacity(15, 6, true), 45);
  });

  test("requiredTotals: 21食分を合計し、未定は無視", () => {
    eq(Calc.requiredTotals(plan("a7", "a7", null, "m7", "mix"), byId), { apple: 14, milk: 7 });
  });

  test("balance: 差分の符号", () => {
    const rows = Calc.balance({ apple: 14, milk: 7 }, { apple: 10, milk: 9, egg: 3 }, ingredients);
    eq(rows.map((r) => r.diff), [-4, 2, 3]);
  });

  test("simulate: 最初に不足する食と不足数", () => {
    const meals = Calc.simulate(plan("a7", "a7", "a7"), { apple: 10 }, byId, settings);
    eq(meals[0].shortages, {});
    eq(meals[1].shortages, { apple: 4 });
    eq(meals[2].shortages, { apple: 7 });
    eq(meals.find(Calc.isShort).label, "月曜昼");
  });

  test("simulate: 鍋の容量オーバー（日曜は2倍）", () => {
    const p = new Array(21).fill("big");
    const meals = Calc.simulate(p, { egg: 999, milk: 999 }, byId, settings);
    eq(meals[0].overCapacity, true);
    eq(meals[18].overCapacity, false);
  });

  test("substitutes: 不足食材を使わず、その時点の在庫で作れる同カテゴリ料理", () => {
    const meals = Calc.simulate(plan("a7", "a7"), { apple: 10, milk: 7, egg: 50 }, byId, settings);
    const subs = Calc.substitutes(meals[1], ["apple"], recipes, "curry", 5);
    // big は鍋に入らない、s8 は別カテゴリ、a7 は自分自身
    eq(subs.map((r) => r.id), ["m7", "mix"]);
  });

  test("substitutes: 在庫が足りない料理は除外", () => {
    const meals = Calc.simulate(plan("a7"), { apple: 0, milk: 3 }, byId, settings);
    eq(Calc.substitutes(meals[0], ["apple"], recipes, "curry", 5).map((r) => r.id), ["mix"]);
  });

  test("leftovers: バッグ使用量と余り食材", () => {
    const rows = Calc.balance({ apple: 7 }, { apple: 10, milk: 20 }, ingredients);
    const info = Calc.leftovers(rows, 25);
    eq([info.used, info.free], [30, -5]);
    eq(info.surplus.map((s) => [s.id, s.amount, s.unusedEntirely]), [["milk", 20, true], ["apple", 3, false]]);
  });

  if (isNode) {
    let failed = 0;
    for (const r of results) {
      console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.ok ? "" : " — " + r.message));
      if (!r.ok) failed++;
    }
    console.log(results.length - failed + " / " + results.length + " passed");
    process.exitCode = failed ? 1 : 0;
  } else {
    root.TEST_RESULTS = results;
  }
})(this);
