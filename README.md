# TaskAgent

中小企業のビジネスチーム向け、AI 自動化を主軸としたタスク管理 SaaS。

> 本リポジトリは要件定義書 v0.5（`docs/REQUIREMENTS_v0.5.md`）に基づくスケルトンです。
> 主要な構造・データモデル・RLS ポリシー・CI/CD は揃っており、画面実装の土台が整った状態です。

## アーキテクチャ

| レイヤ | 採用技術 |
|---|---|
| フロントエンド | React + TypeScript + Vite + Tailwind |
| ホスティング | GitHub Pages（GitHub Actions で自動デプロイ） |
| DB / 認証 / API | Supabase（Postgres + Auth + Edge Functions） |
| AI | Anthropic Claude（Edge Functions 経由） |
| メール通知 | Resend |
| LINE 通知 | LINE Messaging API（公式アカウント） |

## ディレクトリ構成

```
taskagent/
├── apps/web/                    # React SPA（GitHub Pages 配信）
├── supabase/
│   ├── migrations/0001_init.sql # 5 階層 + クロス組織 + ワークフロー + RLS
│   ├── functions/               # Edge Functions（AI / 通知 / KPI / LINE）
│   ├── seed.sql                 # サンプルデータ
│   └── config.toml              # Supabase ローカル設定
├── docs/REQUIREMENTS_v0.5.md    # 要件定義書 v0.5
├── .github/workflows/           # CI/CD（GitHub Pages デプロイ + 型検査）
└── package.json                 # npm workspaces ルート
```

## セットアップ

### 1. 依存関係

```bash
# Node.js 20 以上が必要
npm install
```

### 2. Supabase プロジェクトを作成

1. <https://supabase.com> でアカウント作成 → New project
2. プロジェクトの **Settings → API** から以下を取得:
   - Project URL（`VITE_SUPABASE_URL`）
   - anon public key（`VITE_SUPABASE_ANON_KEY`）
   - service_role key（Edge Functions 用、後述）

### 3. 環境変数を設定

```bash
cp .env.example .env
cp .env.example apps/web/.env
# 各ファイルの VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を埋める
```

### 4. Supabase CLI でマイグレーション適用

```bash
# Supabase CLI をインストール（未導入なら）
npm install -g supabase

# プロジェクトをリンク
supabase link --project-ref <your-project-ref>

# スキーマを push
supabase db push

# Edge Functions の secrets を設定
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxx
supabase secrets set LINE_CHANNEL_SECRET=xxx
supabase secrets set NOTIFY_FROM_EMAIL=noreply@yourdomain.com

# Edge Functions をデプロイ
supabase functions deploy ai-decompose
supabase functions deploy notify
supabase functions deploy kpi-snapshot
supabase functions deploy line-webhook
```

### 5. ローカル開発

```bash
npm run dev
# http://localhost:5173 を開く
```

### 6. GitHub Pages にデプロイ

1. リポジトリの **Settings → Pages** で `Source: GitHub Actions` を選択
2. **Settings → Secrets and variables → Actions** に以下を登録:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `main` ブランチに push すると自動でデプロイされる

## ローンチ戦略

要件定義書 §1「ローンチ戦略」に基づき、3 フェーズで提供する:

| フェーズ | アクセス方式 |
|---|---|
| フェーズ 1: 招待制クローズドベータ | 運営側で組織を作成・招待。自己登録不可 |
| フェーズ 2: 招待拡大ベータ | 紹介・申込みフォーム経由 |
| フェーズ 3: 外販（一般提供） | 自己登録、Stripe 課金 |

`supabase/config.toml` で `enable_signup = false` としており、フェーズ 1 の運用を前提にしています。

## 開発ロードマップ

詳細は `docs/REQUIREMENTS_v0.5.md` の第 10 章を参照。

| Version | 内容 |
|---|---|
| v0.5 ベータ実装 | F-001〜F-019 の MVP 機能 |
| v1.0 ローンチ | 招待制クローズドベータ開始 |
| v1.5 連携拡充 | LINE / Notion / Google カレンダー双方向 + ビジュアルワークフロービルダー |
| v2.0 外販開始 | Stripe 課金、自己登録 |

## ライセンス

Private. All rights reserved.
