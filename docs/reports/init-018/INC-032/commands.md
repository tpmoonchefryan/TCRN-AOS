# INC-032 修复证据 — 可原样重跑

工作目录:`<local-platform-root>/TCRN-AOS`

## 根因复现(修复前后都成立,证明诊断正确)
```
env -i /bin/sh -lc 'command -v pnpm'   # 无输出 = launchd 下 pnpm 不在 PATH
```

## 绿侧:调度健康门
```
node scripts/scheduler-health.mjs; echo exit=$?   # SCHEDULER_AGENTS_HEALTHY / exit 0
```

## 红侧一:重放事故当时的 127
```
TCRN_SCHEDULER_PROBE=docs/reports/init-018/INC-032/outputs/probe-127.txt node scripts/scheduler-health.mjs; echo exit=$?   # SCHEDULER_AGENT_LAST_RUN_FAILED / exit 1
```

## 红侧二:模板有而 agent 未加载
```
TCRN_SCHEDULER_PROBE=docs/reports/init-018/INC-032/outputs/probe-missing.txt node scripts/scheduler-health.mjs; echo exit=$?   # SCHEDULER_AGENT_NOT_LOADED / exit 1
```

## 端到端真触发(验收判据)
```
launchctl kickstart -k gui/501/com.tcrn.aos.read-face-refresh
launchctl list | grep read-face-refresh    # 结束后第二列应为 0
node scripts/read-face-freshness.mjs; echo exit=$?   # fresh / exit 0
```
