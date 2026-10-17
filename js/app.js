// 画面の描画とイベント処理
(function () {
  "use strict";

  const { categories, ingredients, recipes } = window.DATA;
  const recipesById = Calc.indexRecipes(recipes);
  const ingredientsById = {};
  for (const ing of ingredients) ingredientsById[ing.id] = ing;

  const state = PlannerStorage.load();
  const $ = (id) => document.getElementById(id);

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children || [])) {
      node.append(child);
    }
    return node;
  }

  function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // 料理の選択肢は必要な食材の個数が多い順（同数ならエナジーが高い順）
  function categoryRecipes() {
    return recipes
      .filter((r) => r.category === state.category)
      .sort((a, b) => Calc.recipeSize(b) - Calc.recipeSize(a) || b.baseEnergy - a.baseEnergy);
  }

  function ingredientText(recipe) {
    const parts = Object.entries(recipe.ingredients).map(([id, n]) => ingredientsById[id].name + "×" + n);
    return parts.length ? parts.join("、") : "食材なしでも作れる";
  }

  function recipeOptions(select, selectedId, emptyLabel) {
    select.replaceChildren(el("option", { value: "", text: emptyLabel }));
    for (const r of categoryRecipes()) {
      const opt = el("option", { value: r.id, text: r.name + "（" + Calc.recipeSize(r) + "）" });
      if (r.id === selectedId) opt.selected = true;
      select.append(opt);
    }
  }

  function update() {
    PlannerStorage.save(state);
    renderResults();
  }

  // ---- 設定 ----
  function renderSettings() {
    const cat = $("category");
    for (const c of categories) cat.append(el("option", { value: c.id, text: c.name }));
    cat.value = state.category;
    $("potBase").value = state.potBase;
    $("bagCapacity").value = state.bagCapacity;
    $("campTicket").checked = state.campTicket;

    cat.addEventListener("change", () => {
      state.category = cat.value;
      // カテゴリが変わったら別カテゴリの予定は外す
      state.plan = state.plan.map((id) => (id && recipesById[id].category === state.category ? id : null));
      renderPlan();
      update();
    });
    $("potBase").addEventListener("input", (e) => { state.potBase = toInt(e.target.value); update(); });
    $("bagCapacity").addEventListener("input", (e) => { state.bagCapacity = toInt(e.target.value); update(); });
    $("campTicket").addEventListener("change", (e) => { state.campTicket = e.target.checked; update(); });
  }

  // ---- 料理の予定 ----
  function renderPlan() {
    recipeOptions($("bulkRecipe"), null, "料理を選択");
    const body = $("planBody");
    body.replaceChildren();
    Calc.DAYS.forEach((day, d) => {
      const row = el("tr", {}, el("th", { text: day }));
      for (let s = 0; s < 3; s++) {
        const index = d * 3 + s;
        const select = el("select", { "aria-label": Calc.mealLabel(index) });
        recipeOptions(select, state.plan[index], "未定");
        select.addEventListener("change", () => {
          state.plan[index] = select.value || null;
          update();
        });
        row.append(el("td", {}, [el("span", { class: "slot", text: Calc.SLOTS[s] }), select]));
      }
      body.append(row);
    });
  }

  function bindPlanButtons() {
    $("bulkApply").addEventListener("click", () => {
      const id = $("bulkRecipe").value;
      if (!id) return;
      state.plan = state.plan.map(() => id);
      renderPlan();
      update();
    });
    $("bulkEmpty").addEventListener("click", () => {
      const id = $("bulkRecipe").value;
      if (!id) return;
      state.plan = state.plan.map((cur) => cur || id);
      renderPlan();
      update();
    });
    $("clearPlan").addEventListener("click", () => {
      state.plan = new Array(21).fill(null);
      renderPlan();
      update();
    });
  }

  // ---- 手持ちの食材 ----
  function renderInventory() {
    const box = $("inventory");
    box.replaceChildren();
    for (const ing of ingredients) {
      const input = el("input", { type: "number", min: "0", inputmode: "numeric", id: "inv-" + ing.id });
      input.value = state.inventory[ing.id] || "";
      input.addEventListener("input", () => {
        state.inventory[ing.id] = toInt(input.value);
        update();
      });
      box.append(el("label", { class: "inv-item" }, [el("span", { text: ing.name }), input]));
    }
    $("clearInventory").onclick = () => {
      state.inventory = {};
      renderInventory();
      update();
    };
  }

  // ---- 結果 ----
  function renderResults() {
    const totals = Calc.requiredTotals(state.plan, recipesById);
    const rows = Calc.balance(totals, state.inventory, ingredients);
    const meals = Calc.simulate(state.plan, state.inventory, recipesById, state);
    const shortIds = rows.filter((r) => r.diff < 0).map((r) => r.id);

    renderSummary(rows, meals, shortIds);
    renderBalance(rows);
    renderAlerts(meals, shortIds);
    renderLeftovers(rows);
  }

  function renderSummary(rows, meals, shortIds) {
    const planned = state.plan.filter(Boolean).length;
    const firstShort = meals.find(Calc.isShort);
    const overCount = meals.filter((m) => m.overCapacity).length;
    const items = [el("li", { text: "予定済み: " + planned + " / 21 食" })];
    if (planned === 0) {
      items.push(el("li", { text: "料理の予定を入力してください。" }));
    } else if (shortIds.length === 0) {
      items.push(el("li", { class: "ok", text: "食材は足りています。" }));
    } else {
      const lack = rows.filter((r) => r.diff < 0).reduce((a, r) => a - r.diff, 0);
      items.push(el("li", { class: "ng", text: shortIds.length + " 種類・合計 " + lack + " 個の食材が足りません。" }));
      items.push(el("li", { class: "ng", text: "最初に足りなくなるのは " + firstShort.label + "（" + firstShort.recipe.name + "）です。" }));
    }
    if (overCount > 0) items.push(el("li", { class: "ng", text: "鍋の容量を超える食が " + overCount + " 回あります。" }));
    $("summary").replaceChildren(el("ul", {}, items));
  }

  function renderBalance(rows) {
    const body = $("balanceBody");
    body.replaceChildren();
    const visible = rows.filter((r) => r.required > 0 || r.stock > 0);
    if (visible.length === 0) {
      body.append(el("tr", {}, el("td", { colspan: "4", class: "empty", text: "まだデータがありません" })));
      return;
    }
    // 不足の大きい順 → 余り
    visible.sort((a, b) => a.diff - b.diff);
    for (const r of visible) {
      const diffText = r.diff > 0 ? "+" + r.diff : String(r.diff);
      const cls = r.diff < 0 ? "ng" : r.required > 0 ? "ok" : "";
      body.append(el("tr", { class: cls }, [
        el("td", { text: r.name }),
        el("td", { class: "num", text: String(r.required) }),
        el("td", { class: "num", text: String(r.stock) }),
        el("td", { class: "num", text: r.diff < 0 ? diffText + "（不足）" : diffText }),
      ]));
    }
  }

  function renderAlerts(meals, shortIds) {
    const box = $("alerts");
    box.replaceChildren();
    const groups = Calc.groupAlerts(meals);
    if (groups.length === 0) {
      box.append(el("p", { class: "empty", text: "問題のある食はありません。" }));
      return;
    }
    box.append(el("p", { class: "note", text: "同じ料理で同じ問題の食はまとめて表示します。代わりの料理は1食ずつ判定しているので、複数の食で同じ料理に置き換える場合は、予定を変えて再確認してください。" }));
    for (const g of groups) {
      const lines = [el("p", { class: "meal-labels", text: g.meals.map((m) => m.label).join("、") })];
      if (g.overCapacity) {
        lines.push(el("p", { class: "ng", text: "鍋の容量オーバー: 必要 " + g.size + " 個 / 容量 " + g.capacity + " 個" }));
      }
      if (Object.keys(g.shortages).length) {
        const lack = Object.entries(g.shortages).map(([id, n]) => ingredientsById[id].name + " " + n + "個");
        lines.push(el("p", { class: "ng", text: "不足（1食あたり）: " + lack.join("、") }));
      }
      const subs = Calc.groupSubstitutes(g, shortIds, recipes, state.category, 5);
      if (subs.length) {
        lines.push(el("p", { class: "sub-title", text: "代わりに作れる料理（不足食材を使わないもの）:" }));
        lines.push(el("ul", { class: "subs" }, subs.map((r) =>
          el("li", {}, [el("strong", { text: r.name }), " ", el("span", { class: "muted", text: ingredientText(r) })]))));
      } else {
        lines.push(el("p", { class: "muted", text: "代わりに作れる料理が見つかりません。" }));
      }
      box.append(el("div", { class: "alert" }, [
        el("h4", { text: g.recipe.name + "（" + g.meals.length + "食）" }),
        ...lines,
      ]));
    }
  }

  function renderLeftovers(rows) {
    const box = $("leftovers");
    const info = Calc.leftovers(rows, state.bagCapacity);
    const children = [];
    const bagText = "バッグ: " + info.used + " / " + info.capacity + " 個（空き " + info.free + " 個）";
    children.push(el("p", { class: info.free < 0 ? "ng" : "", text: info.free < 0 ? bagText + " ※在庫がバッグ容量を超えています" : bagText }));
    if (info.surplus.length === 0) {
      children.push(el("p", { class: "empty", text: "余る食材はありません。" }));
    } else {
      children.push(el("ul", { class: "leftover-list" }, info.surplus.map((s) =>
        el("li", {}, [s.name + " " + s.amount + " 個", s.unusedEntirely ? el("span", { class: "tag", text: "予定で未使用" }) : ""]))));
      children.push(el("p", { class: "note", text: "「予定で未使用」の食材は、今週の予定では使いません。バッグがいっぱいなら整理の候補です。" }));
    }
    box.replaceChildren(...children);
  }

  renderSettings();
  renderPlan();
  bindPlanButtons();
  renderInventory();
  renderResults();
})();
