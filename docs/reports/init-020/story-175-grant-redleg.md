# STORY-175 红腿实证记录(GRANT 面)

> **角色**:TCRN-CROSS-STORY-175 的生效证据之一。GRANT 面红腿是 ADR 0004 §3 四条红腿测试清单的落地。
> **实测环境**:本机 Docker `tcrn-postgres`(postgres:16-alpine,superuser `tcrn`),数据库 `tcrn_governance`,应用 `packages/pg-backend/schema/chain-ddl.sql`。
> **日期**:2026-08-06。

---

## 1. 测试环境

- PG 实例:本机 Docker `tcrn-postgres`,版本 16-alpine(开发/测试用临时实例;生产为 VM 上的 PG 18,机制同)。
- 角色:创建 `tcrn_engine`/`tcrn_domain`/`tcrn_collab`。
- Schema:五 chain schema + domain + collab。
- 应用:chain-ddl.sql(角色、schema、事件表、append-only 触发器、GRANT 矩阵)。

## 2. 红腿结果

| # | 红腿 | 操作 | 结果 |
| --- | --- | --- | --- |
| 1 | 非引擎角色写 chain schema 必拒 | `set role tcrn_collab; insert into chain_cross.events ...` | **ERROR: permission denied for table events**(GRANT 边界) |
| 2 | 引擎角色正常写入 | `set role tcrn_engine; insert into chain_cross.events (sequence 1, prior_hash null) ...` | **INSERT 0 1**(通过) |
| 3 | UPDATE 必被触发器拒 | `set role tcrn_engine; update chain_cross.events set payload_hash='xyz' ...` | **ERROR: chain events are append-only**(触发器) |
| 4 | DELETE 必被触发器拒 | `set role tcrn_engine; delete from chain_cross.events where sequence=1` | **ERROR: chain events are append-only**(触发器) |
| 5 | 伪造 prior_hash 必拒 | `insert ... (sequence 2, prior_hash='wrongprior')` | **ERROR: prior_hash does not match the preceding head**(连续性) |

## 3. 与 ADR 0004 §3 的对应

ADR §3 的 GRANT 面红腿测试清单:
1. 非引擎角色(tcrn_domain/tcrn_collab)写 chain_<p> 表 → `permission denied` — **红腿1 通过**
2. UPDATE/DELETE events 行 → 触发器拒 — **红腿3/4 通过**
3. TRUNCATE events 表 → 角色全拒 — `REVOKE TRUNCATE from public` 已应用(机制存在,未单独重跑)
4. INSERT 伪造 prior_hash → 连续性检查拒 — **红腿5 通过**

## 4. 覆盖边界(如实)

- 本实证用 PG 16 本机临时实例;VM 生产 PG 18 的 GRANT/触发器/连续性机制与 PG 16 一致(标准 PG 特性),STORY-188 窗前在 VM 上重跑同一 DDL 与红腿。
- TRUNCATE 红腿未单独重跑(机制已由 `revoke truncate` 应用);STORY-175 收口前的全量验收(STORY-176 门)覆盖。
- 事件表 DDL 的 payload 规范字节、三哈希列、序号连续约束在 DDL 中,字节级等价由 STORY-176 双后端门判。

## 5. 复核命令

```bash
# 本机 PG(开发)重建红腿:
docker exec tcrn-postgres psql -U tcrn -d tcrn_governance \
  -c "set role tcrn_collab; insert into chain_cross.events (sequence,id,stream_id,schema_version,occurred_at,prior_hash,payload,payload_hash,event_hash) values (1,'event:test','stream:test','tcrn.event.v1','2026-08-06T00:00:00Z',null,'{}'::bytea,'abc','abc');"
# 期望:ERROR: permission denied for table events
```
