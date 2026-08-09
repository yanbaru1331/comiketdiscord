# comiketDiscord

コミックマーケットの購入進捗を、Google Sheets と Discord の固定 Embed／リアクションで共有する Bot です。

現時点では設計とコンテナ起動用の最小スケルトンのみです。詳細は [docs/design.md](docs/design.md) を参照してください。

## ローカル起動

```sh
cp .env.example .env
npm install
npm run dev
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
