# comiketDiscord

コミックマーケットの購入進捗を、Google Sheets と Discord の固定 Embed／リアクションで共有する Bot です。

現時点では設計とコンテナ起動用の最小スケルトンのみです。詳細は [docs/design.md](docs/design.md) を参照してください。

## ローカル起動

```sh
pnpm install
pnpm run test:csv
```

## コンテナ起動

```sh
docker compose up --build
```

## 開発用コンテナ起動

本番用のマルチステージビルドとは別に、ソース変更を自動反映する開発環境を起動できます。

```sh
cp .env.example .env
docker compose -f compose.dev.yaml up --build
```

`src` はコンテナへマウントされ、変更時に `npm run dev` (`tsx watch`) が自動で再起動します。
依存関係を更新した場合は、再度 `--build` を付けて起動してください。

現在のエントリーポイントは設定値を検証して待機するだけで、Discord や Google Sheets には接続しません。

## 購入候補CSVの確認

現在はプロジェクト直下の `test.csv` を読み込み、共通の購入候補モデルへ変換した結果をコンソールへ表示します。DiscordやGoogle Sheetsへの外部接続は行いません。

```sh
pnpm run test:csv
```

CSVは次の列を持ちます。

```text
購入対象,優先度,場所,サークル名,買うもの,金額/冊,冊数,合計金額,メモ-1,メモ-2,URL,ID
```

Google Sheetsのセル結合をCSV化した行を扱えるよう、場所とサークル名が空欄の場合は直前行の値を引き継ぎます。新しい場所が明記された場合、サークル名の引継ぎはリセットされます。

`ID` は各行を識別するランダムな16桁16進数です。一度採番した値は変更しません。IDがないCSVには次のコマンドで採番できます。

```sh
ruby scripts/add_csv_ids.rb test.csv
```

CSVとGoogle Sheetsは、どちらも表形式データを共通変換関数へ渡し、`PurchaseCandidate[]`として取得します。Google Sheetsでは `GoogleSheetsValuesReader` にAPI取得処理を実装し、スプレッドシートIDと `C107-2-東` のようなシート名を指定します。認証と実際のAPI通信はまだ実装していません。
