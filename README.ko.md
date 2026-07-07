<p align="center">
  <img src="docs/brand/tcrn-aos-impression.png" alt="TCRN AOS product impression" width="720" />
</p>

<h1 align="center">TCRN AOS</h1>

<p align="center">
  Agent Operations System: 에이전트 지원 작업의 기록, 증명, 리뷰, 제한된 readback을 위한 로컬 우선 운영 기반입니다.
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

## 이 저장소는 무엇인가요

TCRN AOS(Agent Operations System)는 에이전트 지원 작업을 위한 로컬 우선 운영 기반입니다. 프로젝트, 이니셔티브, 에픽, 스토리 단위 티켓, 배정, 증거 링크, 게이트 작업, 댓글, 감사 이벤트를 모델링하고, 제한된 MCP 스타일 메서드와 브라우저 readback 화면을 통해 검토 가능한 조정 기록을 제공합니다.

이 저장소는 공개 소스 검토와 로컬 실험을 위한 것입니다. 호스팅 서비스나 자율 디스패치 시스템이 아니며, TCRN 제품 마일스톤, 런타임, 릴리스, 오너 대상 워크플로, 최종 승인 상태가 완료되었다는 주장이 아닙니다.

## 로컬 우선 경계

- AOS는 운영 증명 데이터를 로컬 SQLite 데이터베이스 또는 인메모리 store에 저장합니다.
- Runtime profile root는 명시적으로 지정되며 SQLite를 열기 전에 marker 검증을 거칩니다.
- 브라우저 readback은 `/api/work/readback`의 티켓 및 감사 뷰로 제한됩니다.
- MCP transport 메서드는 allowlist 기반입니다. 일반 gateway, raw DB export, live dispatch surface는 의도적으로 없습니다.
- 감사 및 receipt payload는 메타데이터 중심이며 민감한 세부정보를 redaction합니다.
- Codex adapter 증명 경로는 별도 검토된 live-dispatch lane이 구현되고 승인되기 전까지 dry-run/no-send입니다.
- Workflow governance, thread registry truth, release authority, Owner Intent gate는 이 저장소 밖의 권한입니다.

## 아키텍처

```text
apps/
  api/       로컬 HTTP shell 및 브라우저 안전 readback facade
  web/       정적 React work/readback shell
packages/
  domain/    AOS records, store, policies, idempotency, redaction
  db/        SQLite repository, migrations, runtime profile validation
  mcp-gateway/
             도메인 메서드 dispatcher 및 메서드 단위 idempotency
  mcp-server/
             로컬 JSON-line stdio/runtime transport
  adapter-codex/
             Dry-run Codex dispatch 및 terminal-return ingestion helpers
scripts/     proof, validation, smoke, source-export helpers
docs/        architecture, security, runtime, proof notes
```

## 요구 사항과 빠른 시작

Node.js(`packageManager` 필드와 호환), `pnpm`, 그리고 같은 상위 폴더에 있는 `TCRN-Design-System` checkout이 필요합니다. 이 패키지는 로컬 file dependency를 사용합니다.

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

로컬 서비스는 정적 shell과 API readback을 제공합니다. 원격 runtime, 외부 queue, live thread dispatch, publication flow, Owner Intent executor를 시작하지 않습니다.

## 유용한 명령

```sh
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm audit:licenses
pnpm source-export:proof
pnpm service:smoke
```

## 보안 및 개인정보 보호 태세

- SQLite runtime database, raw DB dump, credential, private evidence payload, 로컬 절대 경로 dump, browser/keychain material, shell history, raw scanner output을 커밋하지 마세요.
- 공개 source export는 로컬 evidence receipts와 생성된 runtime artifacts를 구조적으로 제외합니다.
- 민감 콘텐츠 검사는 domain redaction helper와 source-export/publication proof script에 구현되어 있습니다.
- Runtime profile validation은 SQLite를 열기 전에 unsafe root, symlink, traversal, stale marker, non-direct-child database path를 거부합니다.
- 공개 GitHub publication은 sanitized current-tree export를 사용해야 합니다. 로컬 히스토리는 별도 검증 없이 미러하지 않습니다.

## 문서

- [Architecture](docs/architecture.md)
- [Security boundaries](docs/security-boundaries.md)
- [Persistent runtime storage prerequisite](docs/persistent-runtime-storage-prerequisite.md)
- [Source export prerequisite](docs/source-export-prerequisite.md)
- [Gateway adapter proof](docs/gateway-adapter-proof.md)
- [Runtime proof](docs/runtime-proof.md)

## 라이선스

Apache-2.0. 자세한 내용은 [LICENSE](LICENSE)를 참조하세요.
