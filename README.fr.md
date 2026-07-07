<p align="center">
  <img src="docs/brand/tcrn-aos-impression.png" alt="Apercu produit TCRN AOS" width="720" />
</p>

<h1 align="center">TCRN AOS</h1>

<p align="center">
  Agent Operations System : une colonne vertebrale locale pour le travail assiste par agents, les preuves, les revues et les readbacks limites.
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

## Ce qu'est ce depot

TCRN AOS, l'Agent Operations System, est une colonne vertebrale locale pour le travail assiste par agents. Il modelise les projets, initiatives, epics, tickets au grain story, affectations, liens de preuve, travaux de gate, commentaires et evenements d'audit, puis expose des methodes de style MCP limitees et des surfaces de readback navigateur pour une coordination revisable.

Ce depot est prepare pour la revue publique du code source et l'experimentation locale. Ce n'est pas un service heberge, ni un systeme de dispatch autonome, ni une affirmation qu'un jalon produit TCRN, runtime, release, workflow visible par l'owner ou etat d'acceptation finale est complete.

## Limites local-first

- AOS stocke les donnees de preuve operationnelle dans des bases SQLite locales ou des stores en memoire.
- Les runtime profile roots sont explicites et verifiees par marker avant l'ouverture SQLite.
- Le readback navigateur est limite aux vues ticket et audit de `/api/work/readback`.
- Les methodes MCP transport sont sur allowlist ; les surfaces generic gateway, raw DB export et live dispatch sont absentes volontairement.
- Les payloads d'audit et de receipt sont orientes metadonnees et masquent les details sensibles.
- Les chemins de preuve du Codex adapter restent dry-run/no-send sauf si une lane live-dispatch separee est implementee et acceptee.
- La gouvernance Workflow, la verite du thread registry, l'autorite de release et les gates Owner Intent restent hors de ce depot.

## Architecture

```text
apps/
  api/       Shell HTTP local et facade readback sure pour navigateur
  web/       Shell React statique work/readback
packages/
  domain/    Records AOS, store, policies, idempotency et redaction
  db/        SQLite repository, migrations, validation runtime profile
  mcp-gateway/
             Dispatcher de methodes domaine et idempotency par methode
  mcp-server/
             Transport local JSON-line stdio/runtime
  adapter-codex/
             Helpers dry-run Codex dispatch et terminal-return ingestion
scripts/     Helpers de preuve, validation, smoke et source-export
docs/        Notes architecture, securite, runtime et preuve
```

## Prerequis et demarrage rapide

Il faut Node.js compatible avec le champ `packageManager`, `pnpm`, et un checkout frere de `TCRN-Design-System`, car ce package utilise des dependances locales de type file.

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

Le service local sert le shell statique et les readbacks API. Il ne demarre pas de runtime distant, queue externe, live thread dispatch, flux de publication ou Owner Intent executor.

## Commandes utiles

```sh
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm audit:licenses
pnpm source-export:proof
pnpm service:smoke
```

## Securite et confidentialite

- Ne committez pas de bases SQLite runtime, raw DB dumps, identifiants, private evidence payloads, dumps de chemins absolus locaux, donnees browser/keychain, shell history ou raw scanner output.
- L'export public du code source exclut par construction les evidence receipts locaux et les artefacts runtime generes.
- Les controles de contenu sensible sont implementes dans les helpers de redaction du domaine et les scripts de preuve source-export/publication.
- La validation runtime profile refuse les unsafe roots, symlinks, traversals, stale markers et chemins de base non direct-child avant l'ouverture SQLite.
- La publication publique doit utiliser un sanitized current-tree export. L'historique local legacy ne doit pas etre pousse sauf preuve separee qu'il est propre.

## Documentation

- [Architecture](docs/architecture.md)
- [Security boundaries](docs/security-boundaries.md)
- [Persistent runtime storage prerequisite](docs/persistent-runtime-storage-prerequisite.md)
- [Source export prerequisite](docs/source-export-prerequisite.md)
- [Gateway adapter proof](docs/gateway-adapter-proof.md)
- [Runtime proof](docs/runtime-proof.md)

## Licence

Apache-2.0. Voir [LICENSE](LICENSE).
