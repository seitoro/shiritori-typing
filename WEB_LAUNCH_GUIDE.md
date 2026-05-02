# しりとりタイピング 公開ガイド

## 1. API をどこに置くか

- `web/app/api/validate-word/route.ts`
  - 辞書にないひらがな語だけを OpenAI に確認する API
  - `OPENAI_API_KEY` はここでだけ使う
  - 漢字・カタカナはここに来る前、またはここで弾く
  - 長すぎる語やタイムアウトもここで止める
- `web/app/api/rooms/*`
  - 対戦部屋の作成、参加、進行を扱う API
  - 今は土台だけ。公開時は DB 連携に寄せる

## 2. 安全にするなら

- API キーは絶対にブラウザへ置かない
- `OPENAI_API_KEY` は `web/.env.local` に入れる
- フロントは `fetch("/api/validate-word")` だけを呼ぶ
- 対戦部屋は将来的に Supabase / Firebase などで永続化する
- 入力回数制限、簡単なレート制限、ログ保存も後から追加する

## 3. 広告コードの入れ方

- ネイティブ広告
  - `site/index.html` または `web/app/page.tsx` のヒーロー下へ入れる
- バナー広告
  - ページ最下部の広告エリアへ入れる
- AdSense Auto ads を使う場合
  - サイト全体へ 1 つのコードを入れる
  - `web/app/layout.tsx` の `<body>` 直下か `<head>` 管理側で入れる
  - `NEXT_PUBLIC_ADSENSE_CLIENT` を設定しておく

## 3.1 いま入れてある広告土台

- `web/components/adsense-script.tsx`
  - AdSense の全体コードを入れる場所
- `web/components/ad-slots.tsx`
  - ネイティブ広告枠とバナー広告枠
- `web/app/page.tsx`
  - 上にネイティブ広告枠
  - 下にバナー広告枠

## 4. 公開までの流れ

1. `site` の見た目を `web` に移す
2. `web/.env.local` を作る
3. `npm install`
4. `npm run dev`
5. GitHub に push
6. Vercel へ import
7. `OPENAI_API_KEY` と `NEXT_PUBLIC_SITE_URL` を Vercel の Environment Variables に入れる
8. 本番 URL で動作確認

## 5. 検索に出やすくするために

- タイトルに `しりとりタイピング` を入れる
- 説明文にも `しりとりタイピング` を入れる
- `robots` と `sitemap` を用意する
- 公開後に Google Search Console へ登録する
- サイト URL を送信する
- 独自ドメインがあると信頼感が上がりやすい

## 6. もう入れてあるもの

- `web/app/layout.tsx`
  - 基本の SEO metadata
  - Open Graph
  - WebSite の JSON-LD
- `web/app/robots.ts`
  - robots
- `web/app/sitemap.ts`
  - sitemap
- `web/.env.example`
  - 必要な環境変数の見本
