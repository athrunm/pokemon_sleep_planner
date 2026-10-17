// 食材の過不足計算ロジック（DOM に依存しない純粋関数）
(function (root) {
  "use strict";

  const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const SLOTS = ["朝", "昼", "夜"];
  const SUNDAY = 6;
  const SUNDAY_MULTIPLIER = 2;
  const CAMP_TICKET_MULTIPLIER = 1.5;

  function mealLabel(index) {
    return DAYS[Math.floor(index / 3)] + "曜" + SLOTS[index % 3];
  }

  // ゲーム内の食事の時間帯: 朝 4:00〜11:59 / 昼 12:00〜17:59 / 夜 18:00〜翌3:59（週は月曜4:00に切り替わる）
  const DAY_START_HOUR = 4;
  const SLOT_START_HOURS = [4, 12, 18];

  // 指定日時が今週の何食目（0=月曜朝 … 20=日曜夜）にあたるか
  function currentMealIndex(date) {
    const shifted = new Date(date.getTime() - DAY_START_HOUR * 3600 * 1000);
    const dayIndex = (shifted.getDay() + 6) % 7;
    const hour = date.getHours();
    let slot = 2;
    if (hour >= SLOT_START_HOURS[0] && hour < SLOT_START_HOURS[1]) slot = 0;
    else if (hour >= SLOT_START_HOURS[1] && hour < SLOT_START_HOURS[2]) slot = 1;
    return dayIndex * 3 + slot;
  }

  // 指定日時を含む週の月曜〜日曜の日付
  function weekDates(date) {
    const shifted = new Date(date.getTime() - DAY_START_HOUR * 3600 * 1000);
    const monday = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate() - (shifted.getDay() + 6) % 7);
    return DAYS.map((_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }

  // 曜日・いいキャンプチケットを反映した鍋容量
  function potCapacity(base, dayIndex, campTicket) {
    let cap = base;
    if (dayIndex === SUNDAY) cap *= SUNDAY_MULTIPLIER;
    if (campTicket) cap *= CAMP_TICKET_MULTIPLIER;
    return Math.floor(cap);
  }

  function recipeSize(recipe) {
    return Object.values(recipe.ingredients).reduce((a, b) => a + b, 0);
  }

  function indexRecipes(recipes) {
    const map = {};
    for (const r of recipes) map[r.id] = r;
    return map;
  }

  // plan: 長さ21の配列（料理ID または null）
  function requiredTotals(plan, recipesById) {
    const totals = {};
    for (const id of plan) {
      const recipe = id && recipesById[id];
      if (!recipe) continue;
      for (const [ing, n] of Object.entries(recipe.ingredients)) {
        totals[ing] = (totals[ing] || 0) + n;
      }
    }
    return totals;
  }

  // 食材ごとの 必要数 / 在庫 / 差分（正: 余り, 負: 不足）
  function balance(totals, inventory, ingredients) {
    return ingredients.map((ing) => {
      const required = totals[ing.id] || 0;
      const stock = inventory[ing.id] || 0;
      return { id: ing.id, name: ing.name, required, stock, diff: stock - required };
    });
  }

  // 月曜朝から順に在庫を消費し、食ごとの不足・鍋容量オーバーを調べる
  function simulate(plan, inventory, recipesById, settings) {
    const remaining = Object.assign({}, inventory);
    return plan.map((id, index) => {
      const capacity = potCapacity(settings.potBase, Math.floor(index / 3), settings.campTicket);
      const before = Object.assign({}, remaining);
      const recipe = id && recipesById[id];
      const result = { index, label: mealLabel(index), recipe: recipe || null, capacity, size: 0, overCapacity: false, shortages: {}, before };
      if (!recipe) return result;
      result.size = recipeSize(recipe);
      result.overCapacity = result.size > capacity;
      for (const [ing, n] of Object.entries(recipe.ingredients)) {
        const have = Math.max(0, remaining[ing] || 0);
        if (have < n) result.shortages[ing] = n - have;
        remaining[ing] = (remaining[ing] || 0) - n;
      }
      return result;
    });
  }

  function isShort(meal) {
    return Object.keys(meal.shortages).length > 0;
  }

  // 不足食材を使わず、鍋に入り、その時点の在庫で作れる同カテゴリの料理（エナジー順）
  function substitutes(meal, shortIngredientIds, recipes, category, limit) {
    const short = new Set(shortIngredientIds);
    return recipes
      .filter((r) => r.category === category && (!meal.recipe || r.id !== meal.recipe.id))
      .filter((r) => !Object.keys(r.ingredients).some((ing) => short.has(ing)))
      .filter((r) => recipeSize(r) <= meal.capacity)
      .filter((r) => Object.entries(r.ingredients).every(([ing, n]) => (meal.before[ing] || 0) >= n))
      .sort((a, b) => b.baseEnergy - a.baseEnergy)
      .slice(0, limit || 5);
  }

  // 問題のある食を「同じ料理・同じ鍋容量・同じ不足内容」ごとにまとめる（予定順を保つ）
  function groupAlerts(meals) {
    const groups = [];
    const byKey = {};
    for (const m of meals) {
      if (!m.recipe || !(isShort(m) || m.overCapacity)) continue;
      const key = [m.recipe.id, m.capacity, m.overCapacity, JSON.stringify(m.shortages)].join("|");
      if (!byKey[key]) {
        byKey[key] = { recipe: m.recipe, size: m.size, capacity: m.capacity, overCapacity: m.overCapacity, shortages: m.shortages, meals: [] };
        groups.push(byKey[key]);
      }
      byKey[key].meals.push(m);
    }
    return groups;
  }

  // グループ内のどの食でも作れる代わりの料理
  function groupSubstitutes(group, shortIngredientIds, recipes, category, limit) {
    const [first, ...rest] = group.meals.map((m) => substitutes(m, shortIngredientIds, recipes, category, Infinity));
    const restIds = rest.map((list) => new Set(list.map((r) => r.id)));
    return first.filter((r) => restIds.every((ids) => ids.has(r.id))).slice(0, limit || 5);
  }

  // 予定で使わない余り食材と、バッグの使用状況
  function leftovers(balanceRows, bagCapacity) {
    const used = balanceRows.reduce((a, r) => a + r.stock, 0);
    const surplus = balanceRows.filter((r) => r.diff > 0).map((r) => ({ id: r.id, name: r.name, amount: r.diff, unusedEntirely: r.required === 0 }));
    surplus.sort((a, b) => b.amount - a.amount);
    return { used, capacity: bagCapacity, free: bagCapacity - used, surplus };
  }

  const Calc = { DAYS, SLOTS, mealLabel, currentMealIndex, weekDates, potCapacity, recipeSize, indexRecipes, requiredTotals, balance, simulate, isShort, substitutes, groupAlerts, groupSubstitutes, leftovers };
  if (typeof module !== "undefined" && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(this);
