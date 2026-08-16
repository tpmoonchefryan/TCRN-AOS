# INC-083 弃轨导出更正

这是对 `inc083-archive-window-2106-2122.json` 的更正证据。原文件的 `source` 是
PG facade `event-list`，因此保留为“错误对象”红证人，不覆盖、不改写。

## 正确的文件轨字节导出

- 正确物化件：`evidence/inc096-file-track-export/2026-08-07-cross-project-2106-2122/manifest.json`
- 范围：sealed file archive 的 2106..2122，共 17 个逐事件原始 JSON 字节件
- segment：000033（2049..2112）与 000034（2113..2122）
- segment SHA-256：`9750b0b27f483e6c7fd30c8935790954cf41137c9b380636fd09ab34e20a5ea2`、
  `7fb50e470a912f7a50c8cc8bb7ad5d0c93cbbf30e07ab1d6079a74f36efda07b`
- 文件轨尾：sequence 2122，`ad2a7c9ba7fc38f0e51a3800c8dbd6535f3c52fd6d351cea9de235077200154e`
- 逐件校验：`node scripts/inc096-file-track-export.mjs --verify evidence/inc096-file-track-export/2026-08-07-cross-project-2106-2122/manifest.json`
  → `INC096_FILE_TRACK_BYTES_VERIFIED`

每个事件文件是从 segment 原始字节切片得到的，未经过 JSON 重新序列化；manifest 同时记录
了字节数、逐件 SHA-256、eventHash、payloadHash、priorHash 与操作类型。验证器先比字节摘要，
再解析 JSON；任意一字节改变都会以 `FILE_TRACK_EVENT_DIGEST_MISMATCH` 拒绝。

## 与原 PG 导出自 2105 分叉点的语义对照

| seq | 文件轨 | 原 PG 导出 | 身份/语义结论 |
| ---: | --- | --- | --- |
| 2106 | `annotated` · STORY-189 · r5 | `annotated` · STORY-189 · r5 | 身份相同，eventHash 不同 |
| 2107 | `updated` · STORY-189 · r6 | `annotated` · STORY-189 · r6 | 同单同修订，操作不同 |
| 2108 | `updated` · STORY-189 · r7 | `created` · INC-074 · r1 | 分叉 |
| 2109 | `annotated` · STORY-189 · r8 | `created` · INC-075 · r1 | 分叉 |
| 2110 | `annotated` · STORY-189 · r9 | `created` · INC-076 · r1 | 分叉 |
| 2111 | `annotated` · STORY-185 · r3 | `created` · INC-077 · r1 | 分叉 |
| 2112 | `updated` · STORY-185 · r4 | `created` · INC-078 · r1 | 分叉 |
| 2113 | `updated` · STORY-185 · r5 | `created` · INC-079 · r1 | 分叉 |
| 2114 | `updated` · STORY-185 · r6 | `created` · INC-080 · r1 | 分叉 |
| 2115 | `annotated` · STORY-189 · r10 | `annotated` · INC-074 · r2 | 分叉 |
| 2116 | `annotated` · INC-073 · r2 | `annotated` · INC-075 · r2 | 分叉 |
| 2117 | `updated` · INC-073 · r3 | `annotated` · INC-076 · r2 | 分叉 |
| 2118 | `updated` · INC-073 · r4 | `annotated` · INC-077 · r2 | 分叉 |
| 2119 | `updated` · INC-073 · r5 | `annotated` · INC-078 · r2 | 分叉 |
| 2120 | `annotated` · STORY-190 · r3 | `annotated` · INC-079 · r2 | 分叉 |
| 2121 | `updated` · STORY-190 · r4 | `annotated` · INC-080 · r2 | 分叉 |
| 2122 | `updated` · STORY-190 · r5 | `created` · INC-081 · r1 | 分叉；文件轨 sealed head |

因此，2105 的 `priorHash` 在两条轨上都可作为窗口起点，但 2106 之后只有文件轨导出能证明
弃轨本身的字节；PG 清单不能替代它。PG 仍是当前写读权威，文件轨仅作为 sealed 历史证据。
