import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Heading,
  InlineAlert,
  KeyValueList,
  MachineTokenCell,
  RelationshipChip,
  Select,
  Surface,
  Text,
  Textarea
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

/**
 * The cockpit's own fields for one chain record: who is carrying it, how urgent
 * it is, what it is labelled, what people said, and what it relates to outside
 * the chain's strict tree.
 *
 * These are the only editable fields in the product, and the separation is the
 * point. Chain fields are governance record and cannot be edited here at all;
 * these are the cockpit's commentary and are freely editable. A reader who
 * cannot tell the two apart will eventually try to correct a ruling by changing
 * a label.
 *
 * The panel discovers whether it can write by asking the service rather than by
 * being told at build time. The same bundle is served from this machine, where
 * the service holds operator authority, and mirrored onto a VM where nothing
 * does — a runtime probe cannot drift from that reality the way a build flag
 * can, and where there is no service the panel says where the write surface
 * actually lives instead of offering controls that would fail.
 */

export interface DomainAnnotationView {
  assignee: string | null;
  priority: string | null;
  labels: readonly string[];
  updatedAt: string;
  updatedBy: string;
}

interface DomainPayload {
  annotation: DomainAnnotationView | null;
  comments: Array<{ id: string; author: string; body: string; createdAt: string }>;
  relations: Array<{
    id: string;
    relation: string;
    targetPartitionId: string;
    targetRecordId: string;
    direction: "outbound" | "inbound";
  }>;
}

type Availability = "probing" | "writable" | "read-only";

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export function DomainPanel({
  locale,
  partitionId,
  recordId,
  externalKey
}: {
  locale: TcrnLocale;
  partitionId: string;
  recordId: string;
  externalKey: string | null;
}) {
  const isZh = locale === "zh-CN";
  const [availability, setAvailability] = useState<Availability>("probing");
  const [data, setData] = useState<DomainPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/domain/${partitionId}/${encodeURIComponent(recordId)}`);
    if (!response.ok) throw new Error(`domain read failed: ${response.status}`);
    setData(await response.json() as DomainPayload);
  }, [partitionId, recordId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await fetch("/api/health");
        if (!health.ok) throw new Error("no service");
        const body = await health.json() as { chainWriteAvailable?: boolean };
        if (cancelled) return;
        setAvailability(body.chainWriteAvailable ? "writable" : "read-only");
        await load();
      } catch {
        // No service answered. That is the mirror, and it is a fact about where
        // this copy runs rather than an error to report as a failure.
        if (!cancelled) setAvailability("read-only");
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const send = async (path: string, method: string, body: Record<string, unknown>) => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partitionId, recordId, externalKey, ...body })
      });
      const payload = await response.json() as { ok?: boolean; reasonCode?: string; error?: string };
      // The service passes the engine's reason code through; showing it is the
      // difference between "that did not work" and "the state machine says that
      // move is not legal from here".
      if (!response.ok || payload.ok === false) {
        setFailure(payload.reasonCode ?? payload.error ?? String(response.status));
        return;
      }
      await load();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const annotation = data?.annotation;

  return (
    <Surface className="tcrn-aos-band" data-detail-panel="domain" data-domain-availability={availability}>
      <div className="tcrn-aos-detail-head__meta">
        <Heading level={2} visualLevel={3}>
          {isZh ? "AOS 域字段" : "AOS domain fields"}
        </Heading>
        <Badge tone={availability === "writable" ? "neutral" : "warning"}>
          {availability === "writable"
            ? (isZh ? "可编辑" : "editable")
            : availability === "probing"
              ? (isZh ? "检测中" : "checking")
              : (isZh ? "只读镜像" : "read-only mirror")}
        </Badge>
      </div>

      <Text>
        {isZh
          ? "这些字段属于驾驶舱,不属于链。链上字段是治理记录,在此不可编辑;这些是附注,可自由修改。"
          : "These fields belong to the cockpit, not to the chain. Chain fields are governance record and cannot be edited here; these are annotations and are freely editable."}
      </Text>

      {availability === "read-only" ? (
        <InlineAlert tone="warning" data-cockpit-notice="mirror-read-only">
          {isZh
            ? "此副本没有写面。AOS 的写入发生在本机服务上——operator 供权只存在于那台机器,镜像永远不持有它。此处显示的是最近一次同步的内容。"
            : "This copy has no write surface. AOS writes happen on the local service: operator authority exists only on that machine and the mirror never holds it. What is shown here is the last synchronised content."}
        </InlineAlert>
      ) : null}

      {failure ? (
        <InlineAlert tone="warning" data-domain-failure={failure}>
          {isZh ? `写入被拒:${failure}` : `Write refused: ${failure}`}
        </InlineAlert>
      ) : null}

      <KeyValueList
        items={[
          {
            key: "assignee",
            label: isZh ? "负责人" : "Assignee",
            value: annotation?.assignee ?? (isZh ? "未指派" : "unassigned")
          },
          {
            key: "priority",
            label: isZh ? "优先级" : "Priority",
            value: annotation?.priority ?? "—"
          },
          {
            key: "labels",
            label: isZh ? "标签" : "Labels",
            value: annotation?.labels?.length
              ? annotation.labels.join(" · ")
              : "—"
          },
          {
            key: "updated",
            label: isZh ? "最后修改" : "Last edited",
            value: annotation
              ? `${annotation.updatedAt} · ${annotation.updatedBy}`
              : "—"
          }
        ]}
      />

      {availability === "writable" ? (
        <div className="tcrn-aos-domain-edit">
          <label className="tcrn-aos-domain-edit__field">
            <span>{isZh ? "负责人" : "Assignee"}</span>
            <input
              className="tcrn-input"
              defaultValue={annotation?.assignee ?? ""}
              placeholder="owner:governance"
              data-domain-field="assignee"
              onBlur={(event) => {
                const next = event.currentTarget.value.trim();
                if (next === (annotation?.assignee ?? "")) return;
                void send("/api/domain/annotation", "PUT", { assignee: next || null });
              }}
            />
          </label>
          <label className="tcrn-aos-domain-edit__field">
            <span>{isZh ? "优先级" : "Priority"}</span>
            <Select
              value={annotation?.priority ?? ""}
              data-domain-field="priority"
              options={[
                { value: "", label: "—" },
                ...PRIORITIES.map((priority) => ({ value: priority, label: priority }))
              ]}
              onChange={(event) => {
                void send("/api/domain/annotation", "PUT",
                  { priority: event.currentTarget.value || null });
              }}
            />
          </label>
          <label className="tcrn-aos-domain-edit__field">
            <span>{isZh ? "标签（逗号分隔）" : "Labels (comma separated)"}</span>
            <input
              className="tcrn-input"
              defaultValue={annotation?.labels?.join(", ") ?? ""}
              data-domain-field="labels"
              onBlur={(event) => {
                const labels = event.currentTarget.value
                  .split(",").map((entry) => entry.trim()).filter(Boolean);
                if (labels.join(" ") === (annotation?.labels ?? []).join(" ")) return;
                void send("/api/domain/annotation", "PUT", { labels });
              }}
            />
          </label>
        </div>
      ) : null}

      <Heading level={3} visualLevel={3}>
        {isZh ? `关联（${data?.relations.length ?? 0}）` : `Relations (${data?.relations.length ?? 0})`}
      </Heading>
      <Text>
        {isZh
          ? "链是严格的树,一个 Story 只有一个父级;「阻塞」「重复」这类关系在链上无处安放,由驾驶舱记录,并始终显示为驾驶舱的主张而非链的。"
          : "The chain is a strict tree — a Story has exactly one parent — so “blocks” and “duplicates” have nowhere to live on it. The cockpit records them, and shows them as the cockpit's claim rather than the chain's."}
      </Text>
      {data?.relations.length ? (
        <div className="tcrn-aos-relations">
          {data.relations.map((relation) => (
            // Direction is carried by `source`: "A blocks B" is as much B's
            // business as A's, and a view listing only outbound links would let
            // a blocked item look unblocked. The chip names both ends so the
            // reader can tell which way the claim points.
            <RelationshipChip
              key={relation.id}
              relation={relation.relation as never}
              target={relation.direction === "inbound" ? recordId : relation.targetRecordId}
              source={relation.direction === "inbound" ? relation.targetRecordId : recordId}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={isZh ? "尚无自由关联。" : "No free relation yet."} />
      )}

      <Heading level={3} visualLevel={3}>
        {isZh ? `评论（${data?.comments.length ?? 0}）` : `Comments (${data?.comments.length ?? 0})`}
      </Heading>
      <Text>
        {isZh
          ? "评论是讨论,不是治理记录。要留下有约束力的立场,请开审议——只有立场会进入链并成为证据。"
          : "A comment is discussion, not a governance record. To leave a binding position, open a deliberation: only positions enter the chain and count as evidence."}
      </Text>
      {data?.comments.length ? (
        <ol className="tcrn-aos-comments">
          {data.comments.map((comment) => (
            <li key={comment.id}>
              <div className="tcrn-aos-comments__head">
                <MachineTokenCell token={comment.author} kind="generic" copyable={false} />
                <Text>{comment.createdAt}</Text>
              </div>
              <p className="tcrn-aos-prose">{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={isZh ? "尚无评论。" : "No comment yet."} />
      )}

      {availability === "writable" ? (
        <div className="tcrn-aos-domain-edit">
          <Textarea
            aria-label={isZh ? "新评论" : "New comment"}
            value={draft}
            rows={3}
            data-domain-field="comment"
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || draft.trim().length === 0}
            disabledReason={draft.trim().length === 0
              ? (isZh ? "评论不能为空" : "A comment cannot be empty")
              : (isZh ? "正在写入" : "Write in flight")}
            onClick={() => {
              void send("/api/domain/comment", "POST", { body: draft.trim() }).then(() => setDraft(""));
            }}
          >
            {isZh ? "发表评论" : "Add comment"}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
