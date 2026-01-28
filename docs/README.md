# Docs

## 会計コアのユニットテスト

会計コア（FiscalYearClose / Approval 周辺）はユニットテスト済みです。テストは **専用DB** を使って実行します。

### 1. テストDBを作成（初回のみ）

```bash
docker exec -it knot-db-1 psql -U app -c "CREATE DATABASE knot_test;"
```

※ 既に存在する場合はエラーになるのでスキップでOKです。

### 2. テストDBへスキーマ適用

```bash
cd web
npm run test:db
```

### 3. テスト実行

```bash
cd web
npm test
```
