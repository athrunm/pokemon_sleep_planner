// localStorage への保存・読み込み（使えない環境では何もしない）
(function (root) {
  "use strict";

  const KEY = "pokemon-sleep-planner-v1";

  function defaultState() {
    return {
      category: "curry",
      potBase: 15,
      bagCapacity: 100,
      campTicket: false,
      plan: new Array(21).fill(null),
      inventory: {},
    };
  }

  function load() {
    const state = defaultState();
    try {
      const saved = JSON.parse(root.localStorage.getItem(KEY));
      if (saved && typeof saved === "object") Object.assign(state, saved);
    } catch (e) {
      // 保存データが無い・壊れている場合は初期値を使う
    }
    if (!Array.isArray(state.plan) || state.plan.length !== 21) state.plan = new Array(21).fill(null);
    return state;
  }

  function save(state) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // プライベートモード等で保存できなくても動作は続ける
    }
  }

  root.PlannerStorage = { load, save, defaultState };
})(this);
