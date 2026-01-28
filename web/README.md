This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ローカル開発手順

PostgreSQL は docker compose で起動します。初回は下記の流れで Prisma のマイグレーションとシードを実行してください。

```bash
cp .env.example .env   # web ディレクトリで DATABASE_URL をセット
docker compose up -d --build  # リポジトリルートで app+db を起動
cd web
npx prisma migrate dev
npx prisma db seed
```

`.env` には `DATABASE_URL=postgresql://app:app@localhost:5432/app` と `SESSION_SECRET` を設定してください。Prisma の migrate/seed は上記 `.env` を参照します。

## 認証フロー

- `/register` : 団体名・会計年度・代表者情報（メール/パスワード）を入力して団体と管理者アカウントを作成します。
- `/login` : 登録済みのメールアドレスとパスワードでログインします。
- `/join` : 招待コードを受け取ったメンバーが、表示名・メール・パスワードを入力して参加します。

## 最小画面

- `/join` : 招待コード（例: `DEMO1234`）と表示名を入力すると Member が作成され、cookie セッションが発行されます。
- `/calendar` : セッション情報から団体名と自分の表示名を表示し、ログアウトボタンで cookie を削除できます。
- `/accounting` : 会計仕訳の登録と金額・証憑URL表示、承認/却下および承認ログの確認ができます。
- `/events` : イベント一覧と出欠（yes / maybe / no + コメント）を登録・確認できます。`管理者` ロールはイベント作成・編集、CSV/PDF エクスポートが可能です。

## 権限と初期アカウント

- `管理者` : 団体設定・イベント作成・エクスポートなど全権操作  
  - Seed では `demo-admin@example.com / password123`
- `会計係` : 会計実務を担当（`demo-accountant@example.com / password123`）
- `メンバー` : 一般メンバー（招待コード `DEMO1234` で参加）
- 会計係用招待コード `ACCT1234`、一般メンバー用 `DEMO1234`

## セキュリティ設定と手動確認

- `APP_ORIGIN` で許可するオリジンを指定します（例: `http://localhost:3000`）。未設定の場合は開発モードのみ `http://localhost:3000` が許可されます。
- レート制限は環境変数で調整できます。
  - `RATE_LIMIT_WINDOW_SECONDS`（デフォルト60秒）
  - `RATE_LIMIT_LOGIN_LIMIT`（ログイン系デフォルト5回/60秒）
  - `RATE_LIMIT_WRITE_LIMIT`（その他のPOST/PATCH/DELETEはデフォルト20回/60秒）

### 手動確認の目安
1. **通常操作**: ブラウザからログインし、経費登録やイベント出欠、文書アップロードなど主要な書き込み操作が完了することを確認します。
2. **レート制限**: 例えばログインAPIを短時間に叩き、6回目以降で `429` が返ることを確認します。
   ```bash
   for i in {1..6}; do curl -i -X POST http://localhost:3000/api/login -H \"Content-Type: application/json\" -d '{\"email\":\"demo-admin@example.com\",\"password\":\"wrong\"}'; done
   ```
3. **CSRF**: 悪意のあるオリジンを模して `Origin: https://evil.example` を付けてPOSTし、`403` が返ることを確認します。
   ```bash
   curl -i -X POST http://localhost:3000/api/ledger \
     -H \"Origin: https://evil.example\" \
     -H \"Content-Type: application/json\" \
     --cookie \"pta_session=...\" \
     -d '{\"title\":\"test\",\"amount\":1000,\"accountId\":1,\"transactionDate\":\"2024-01-01\"}'
   ```

## Knot Audit モジュール

Knot Audit は「監査ログ」「内部統制チェック」「指摘管理」を統合したモジュールです。`/audit` にアクセスできるのは `ADMIN` / `ACCOUNTANT` / `AUDITOR` もしくは `PLATFORM_ADMIN_EMAIL` のみです。

### API エンドポイント

- `GET /api/audit/logs?from&to&actorId&targetType&query` – 監査ログの検索 (page filters が利用)
- `GET /api/audit/findings?status&severity&from&to` – 指摘一覧の取得
- `POST /api/audit/findings` / `PATCH /api/audit/findings/:id` – 指摘の登録・更新
- `POST /api/audit/run-internal-controls` – アクティブな内部統制ルールを実行して検知結果を返却

### 内部統制チェック（Phase1）

以下 4 つの検知を実装しています（結果はメモリ返却、Phase2で永続化予定）。

1. **SEGREGATION_OF_DUTIES**: Ledger 作成者と承認者が同一の場合を抽出
2. **MULTI_APPROVAL_FOR_AMOUNT**: 閾値（デフォルト 5 万円）以上かつ承認人数不足
3. **NO_APPROVAL_NO_CONFIRM**: 承認ゼロで `APPROVED` になっている Ledger
4. **MISSING_SOURCE_LINK**: `sourceThreadId/sourceChatMessageId` が無い会計レコード

### 指摘（AuditFinding）

- `logIds (Int[])` と `targetRefs (Json)` で AuditLog と対象を紐付け
- 重大度・ステータス変更時は `AuditLog` に UPDATE が残るため追跡が可能

### 手動確認チェックリスト

1. `/accounting` で Ledger を登録 → `/audit` の監査ログに反映されるか
2. Ledger を承認/却下 → before/after JSON が保存されているか
3. `/audit` → 「内部統制チェック」で `チェックを実行` し、上記 4 ルールが返るか
4. 指摘を作成し、ステータスを `OPEN → RESOLVED` に変更できるか
5. `/api/audit/logs` を curl 等で叩き、権限の無いメンバーでは 401 になるか

## Knot Search (Cmd+K)

### 手動確認の目安
1. ヘッダーの検索ボタン、または Cmd+K / Ctrl+K で検索パレットが開くか
2. Chat / ToDo / Event / Accounting / Document を作成し、キーワード検索で結果が出るか
3. フィルタ（種類・期間・fiscalYear・eventId・threadId）を指定して絞り込めるか
4. 結果をクリックすると該当画面へ遷移できるか
5. 別団体のデータが混入しないか（管理者以外は groupId を指定しても無視される）

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
