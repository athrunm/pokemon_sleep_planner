# ポケスリ料理プランナー

ポケモンスリープで毎日3回（朝・昼・夜）作る料理の1週間分（21食）の予定から、必要な食材の過不足を調べる静的Webアプリです。

## できること

- 週のカテゴリ（カレー・シチュー / サラダ / デザート・ドリンク）を選び、21食分の料理を予定する
- 手持ちの食材を入力すると、食材ごとの 必要数・在庫・過不足 を表示
- 月曜朝から順に在庫を使ったとき、最初に足りなくなる食を表示
- 鍋の容量を超える食を警告（日曜は容量2倍、いいキャンプチケットは1.5倍で計算）
- 不足が出る食について、不足食材を使わず、その時点の在庫で作れる同カテゴリの料理を提案
- 予定で使わない余り食材と、バッグの使用量・空きを表示

入力内容はブラウザの localStorage に自動保存されます。

## 使い方

ビルドは不要です。`index.html` をブラウザで開くか、GitHub Pages で公開したURLを開いてください。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | 画面 |
| `css/style.css` | スタイル |
| `js/data.js` | 食材・料理のマスタデータ |
| `js/calc.js` | 計算ロジック（DOM非依存） |
| `js/storage.js` | localStorage の読み書き |
| `js/app.js` | 画面の描画とイベント |
| `tests/` | `calc.js` のテスト |

## テスト

```sh
node tests/calc.test.js
```

またはブラウザで `tests/calc.test.html` を開きます。

## マスタデータについて

- レシピと食材は [SleepAPI](https://github.com/SleepAPI/SleepAPI)（commit `b52bc32`、2026-10-12）の定義から作成し、日本語名は攻略サイト（[ポケらく](https://pokemongo-raku.com/?p=73533)）で照合しました（2026-10-17 時点）。
- `baseEnergy` は「食材エナジー合計 ×（1 + レシピボーナス）」の目安値で、代わりの料理を並べる順番にだけ使っています。
- 新しいレシピが追加されたら `js/data.js` の `recipes` に1行追加してください。

```js
{"id": "new_recipe", "name": "料理名", "category": "curry", "ingredients": {"apple": 10, "milk": 5}, "baseEnergy": 2000},
```

`category` は `curry` / `salad` / `dessert`、食材IDは `ingredients` の `id` を使います。

## GitHub Pages での公開

リポジトリの Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にすると、push のたびに公開内容が更新されます。
