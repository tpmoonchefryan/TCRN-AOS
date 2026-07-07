<p align="center">
  <img src="docs/brand/tcrn-aos-impression.png" alt="TCRN AOS product impression" width="720" />
</p>

<h1 align="center">TCRN AOS</h1>

<p align="center">
  Agent Operations System: エージェント支援作業の記録、証明、レビュー、境界付き readback のためのローカル優先オペレーション基盤。
</p>

<p align="center">
  <a href="README.md">English</a>
  · <a href="README.zh-CN.md">简体中文</a>
  · <a href="README.ja.md">日本語</a>
  · <a href="README.ko.md">한국어</a>
  · <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/tpmoonchefryan/TCRN-AOS"><img alt="GitHub repository" src="https://img.shields.io/badge/GitHub-TCRN--AOS-24292f" /></a>
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-5865d8" />
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-3c873a" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-local%20packages-3178c6" />
  <img alt="Local first, no live dispatch" src="https://img.shields.io/badge/posture-local--first%20%2F%20no%20live%20dispatch-4f46e5" />
</p>

## 概要

TCRN AOS（Agent Operations System）は、エージェント支援作業のためのローカル優先のオペレーション基盤です。プロジェクト、イニシアチブ、エピック、ストーリー粒度のチケット、担当、証拠リンク、ゲート作業、コメント、監査イベントをモデル化し、境界付き MCP 風メソッドとブラウザ readback サーフェスでレビュー可能な調整記録を提供します。

このリポジトリは公開ソースレビューとローカル実験のためのものです。ホスト型サービス、自律ディスパッチシステム、TCRN 製品マイルストーンやランタイム、リリース、オーナー向けワークフロー、最終受け入れの完了宣言ではありません。

## ローカル優先の境界

- AOS は運用証明データをローカル SQLite データベースまたはインメモリ store に保存します。
- Runtime profile root は明示され、SQLite を開く前に marker 検証されます。
- ブラウザ readback は `/api/work/readback` のチケットと監査ビューに限定されます。
- MCP transport メソッドは allowlist 制です。汎用 gateway、raw DB export、live dispatch surface は意図的にありません。
- 監査と receipt payload はメタデータ中心で、機密詳細を redaction します。
- Codex adapter の証明パスは、別途レビューされた live-dispatch lane が実装・受理されるまでは dry-run/no-send です。
- Workflow governance、thread registry truth、release authority、Owner Intent gate はこのリポジトリ外の権限です。

## アーキテクチャ

```text
apps/
  api/       ローカル HTTP shell とブラウザ安全 readback facade
  web/       静的 React work/readback shell
packages/
  domain/    AOS records、store、policies、idempotency、redaction
  db/        SQLite repository、migrations、runtime profile validation
  mcp-gateway/
             ドメインメソッド dispatcher とメソッド単位 idempotency
  mcp-server/
             ローカル JSON-line stdio/runtime transport
  adapter-codex/
             Dry-run Codex dispatch と terminal-return ingestion helper
scripts/     proof、validation、smoke、source-export helper
docs/        architecture、security、runtime、proof notes
```

## 要件とクイックスタート

Node.js（`packageManager` と互換）、`pnpm`、および同階層の `TCRN-Design-System` checkout が必要です。本パッケージはローカル file dependency を使用します。

```text
TCRN Platform/
  TCRN-AOS/
  TCRN-Design-System/
```

```sh
pnpm install
pnpm build
pnpm verify:fast
pnpm service:start
```

ローカルサービスは静的 shell と API readback を提供します。リモート runtime、外部 queue、live thread dispatch、publication flow、Owner Intent executor は開始しません。

## 便利なコマンド

```sh
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm audit:licenses
pnpm source-export:proof
pnpm service:smoke
```

## セキュリティとプライバシー

- SQLite runtime DB、raw DB dump、credentials、private evidence payload、ローカル絶対パス dump、browser/keychain material、shell history、raw scanner output をコミットしないでください。
- 公開 source export は、ローカル evidence receipts と生成 runtime artifacts を構造的に除外します。
- 機密内容の検査は domain redaction helper と source-export/publication proof script にあります。
- Runtime profile validation は SQLite を開く前に unsafe root、symlink、traversal、stale marker、非 direct-child DB path を拒否します。
- 公開 GitHub には sanitized current-tree export を使います。ローカル履歴は、別途クリーンであることが証明されない限りミラーしません。

## ドキュメント

- [Architecture](docs/architecture.md)
- [Security boundaries](docs/security-boundaries.md)
- [Persistent runtime storage prerequisite](docs/persistent-runtime-storage-prerequisite.md)
- [Source export prerequisite](docs/source-export-prerequisite.md)
- [Gateway adapter proof](docs/gateway-adapter-proof.md)
- [Runtime proof](docs/runtime-proof.md)

## ライセンス

Apache-2.0。詳細は [LICENSE](LICENSE) を参照してください。
