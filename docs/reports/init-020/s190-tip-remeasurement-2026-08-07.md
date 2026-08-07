# S190 tip remeasurement — 2026-08-07

Command: pnpm tip:proof

Result: TIP_SINGLE_TRUTH_VERIFIED, five partitions, divergent: [].

| Partition | PG/facade + ceremony | Sealed file track |
| --- | --- | --- |
| TCRN-AOS | v1048 / eea6d9ad… | v1048 / eea6d9ad… |
| cross-project | v2237 / a7ca36dc… | v2122 / ad2a7c9b… |
| TCRN-Design-System | v983 / e079e10d… | v983 / e079e10d… |
| TCRN-TMS | v229 / c55e05ca… | v229 / c55e05ca… |
| Joi-Button | v586 / fd18a916… | v586 / fd18a916… |

The cross file track is retained archive evidence and is sealed; the PG head is the
current authority after the QA2 closeout ceremonies. The gate compares all three
pathways and reports no divergent live authority.
