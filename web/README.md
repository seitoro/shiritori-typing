# Shiritori Typing Web

## 構成

- `app/page.tsx`: トップ
- `app/solo/page.tsx`: 1人プレイ
- `app/battle/page.tsx`: 合言葉マッチング対戦
- `app/api/rooms/*`: 対戦部屋API
- `lib/shiritori.ts`: 判定ロジック
- `lib/match-store.ts`: 対戦部屋のインメモリ管理

## 起動

```bash
npm install
npm run dev
```

起動前に `web/.env.local` を確認してください。

- `OPENAI_API_KEY`
  - AI 判定を本当に使うときに必要
- `OPENAI_MODEL`
  - デフォルトは `gpt-5.4-mini`
- `NEXT_PUBLIC_SITE_URL`
  - ローカルでは `http://localhost:3000`
- `NEXT_PUBLIC_ADSENSE_CLIENT`
  - 広告コードを本当に出すときに必要

AIで未登録語を判定する場合は、`.env.local` に `OPENAI_API_KEY=...` を設定してください。必要なら `OPENAI_MODEL` でモデル名も上書きできます。

## いまの注意点

- 対戦部屋はメモリ保存です。サーバー再起動で消えます。
- 今はポーリング更新です。本番では WebSocket 化が推奨です。
- 実在語判定は厳密なAI判定ではなく、ルールエンジンの土台です。
