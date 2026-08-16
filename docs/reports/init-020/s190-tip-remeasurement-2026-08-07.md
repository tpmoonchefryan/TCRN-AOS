# S190 tip remeasurement — 2026-08-07

Command: pnpm tip:proof

Result: TIP_SINGLE_TRUTH_VERIFIED, five partitions, divergent: [].

| Partition | PG/facade + ceremony | Sealed file track |
| --- | --- | --- |
| TCRN-AOS | v1048 / eea6d9ad… | v1048 / eea6d9ad… |
| cross-project | v2237 / a7ca36dc… | v2122 / ad2a7c9ba7fc38f0e51a3800c8dbd6535f3c52fd6d351cea9de235077200154e |
| TCRN-Design-System | v983 / e079e10d… | v983 / e079e10d… |
| TCRN-TMS | v229 / c55e05ca… | v229 / c55e05ca… |
| Joi-Button | v586 / fd18a916… | v586 / fd18a916… |

The cross file track is retained archive evidence and is sealed; the PG head is the
current authority after the QA2 closeout ceremonies. The gate compares all three
pathways and reports no divergent live authority.

## Codex re-run after QA3 local completion

Command: `pnpm tip:proof` (re-run 2026-08-07T10:08Z, after the cross chain had advanced
to v2257).

Result: `TIP_SINGLE_TRUTH_VERIFIED`, five partitions, `divergent: []`.

| Partition | PG/facade + ceremony | Sealed file track |
| --- | --- | --- |
| TCRN-AOS | v1048 / `eea6d9adf02ce66081e5268b06f45011d4fb24a15dabed687420dcfbeb19f44f` | v1048 / same |
| cross-project | v2257 / `6558874b38157ea202c6f18e7d04591c124c6fed882d43df5e188bcbd46a2779` | v2122 / `ad2a7c9ba7fc38f0e51a3800c8dbd6535f3c52fd6d351cea9de235077200154e` |
| TCRN-Design-System | v983 / `e079e10de28b0fe0a8abbbda973f463224e51178f3e35fd6cc6b42bef0be292a` | v983 / same |
| TCRN-TMS | v229 / `c55e05ca599d933def967b39028d9ce529e3792206f680f60e06507def651ecf` | v229 / same |
| Joi-Button | v586 / `fd18a91630783dc5737ee9a3f8ba6c8f4cdbb595728cb88c32b0d816e0468955` | v586 / same |

The earlier v2237 row above is retained as the historical pre-rerun observation. The
sealed cross file track remains an archive witness, not a second live authority.
