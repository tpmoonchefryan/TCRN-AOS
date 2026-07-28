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
import { format, pick, type CopyEntry } from "./copy.js";

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

/**
 * This panel's copy, five locales each.
 *
 * It was the last file in the cockpit still written as `isZh ? 中文 : English`,
 * and it stayed that way through the sweep that converted the other fourteen for
 * a reason worth recording: two raw NUL bytes on line 235 — a deliberate and
 * correct `join("\u0000")` separator, stored as literal bytes rather than as the
 * escape — made the whole file read as binary, so every `grep` over the
 * repository skipped it in silence. The sweep found 384 sites and fixed them
 * all; the 26 in here were never in the list it was working from.
 */
const domainCopy = {
  title: {
    "zh-CN": "AOS 域字段",
    en: "AOS domain fields",
    ja: "AOS ドメインフィールド",
    ko: "AOS 도메인 필드",
    fr: "Champs de domaine AOS"
  },
  editable: {
    "zh-CN": "可编辑", en: "editable", ja: "編集可能", ko: "편집 가능", fr: "modifiable"
  },
  checking: {
    "zh-CN": "检测中", en: "checking", ja: "確認中", ko: "확인 중", fr: "vérification"
  },
  readOnlyMirror: {
    "zh-CN": "只读镜像", en: "read-only mirror", ja: "読み取り専用ミラー",
    ko: "읽기 전용 미러", fr: "miroir en lecture seule"
  },
  intro: {
    "zh-CN": "这些字段属于驾驶舱，不属于链。链上字段是治理记录，在此不可编辑；这些是附注，可自由修改。",
    en: "These fields belong to the cockpit, not to the chain. Chain fields are governance record and cannot be edited here; these are annotations and are freely editable.",
    ja: "これらはチェーンではなくコックピットのフィールドです。チェーン側の項目はガバナンス記録であり、ここでは編集できません。こちらは注記であり、自由に変更できます。",
    ko: "이 필드는 체인이 아니라 콕핏에 속합니다. 체인 필드는 거버넌스 기록이므로 여기서 편집할 수 없고, 이 항목은 주석이므로 자유롭게 수정할 수 있습니다.",
    fr: "Ces champs appartiennent au cockpit, pas à la chaîne. Les champs de la chaîne sont un enregistrement de gouvernance et ne peuvent pas être modifiés ici ; ceux-ci sont des annotations librement modifiables."
  },
  mirrorNotice: {
    "zh-CN": "此副本没有写面。AOS 的写入发生在本机服务上——operator 供权只存在于那台机器，镜像永远不持有它。此处显示的是最近一次同步的内容。",
    en: "This copy has no write surface. AOS writes happen on the local service: operator authority exists only on that machine and the mirror never holds it. What is shown here is the last synchronised content.",
    ja: "このコピーには書き込み面がありません。AOS の書き込みはローカルサービス上で行われます。operator 権限はそのマシンにのみ存在し、ミラーが保持することはありません。ここに表示されているのは最後に同期された内容です。",
    ko: "이 사본에는 쓰기 면이 없습니다. AOS의 쓰기는 로컬 서비스에서 일어나며 operator 권한은 그 머신에만 존재하고 미러는 결코 보유하지 않습니다. 여기 표시된 내용은 마지막으로 동기화된 것입니다.",
    fr: "Cette copie n'a pas de surface d'écriture. Les écritures AOS ont lieu sur le service local : l'autorité operator n'existe que sur cette machine et le miroir ne la détient jamais. Ce qui est affiché ici est le dernier contenu synchronisé."
  },
  writeRefused: {
    "zh-CN": "写入被拒：{0}",
    en: "Write refused: {0}",
    ja: "書き込みが拒否されました：{0}",
    ko: "쓰기가 거부되었습니다: {0}",
    fr: "Écriture refusée : {0}"
  },
  assignee: {
    "zh-CN": "负责人", en: "Assignee", ja: "担当者", ko: "담당자", fr: "Responsable"
  },
  unassigned: {
    "zh-CN": "未指派", en: "unassigned", ja: "未割り当て", ko: "미지정", fr: "non attribué"
  },
  priority: {
    "zh-CN": "优先级", en: "Priority", ja: "優先度", ko: "우선순위", fr: "Priorité"
  },
  labels: {
    "zh-CN": "标签", en: "Labels", ja: "ラベル", ko: "라벨", fr: "Étiquettes"
  },
  labelsField: {
    "zh-CN": "标签（逗号分隔）",
    en: "Labels (comma separated)",
    ja: "ラベル（カンマ区切り）",
    ko: "라벨(쉼표로 구분)",
    fr: "Étiquettes (séparées par des virgules)"
  },
  lastEdited: {
    "zh-CN": "最后修改", en: "Last edited", ja: "最終更新", ko: "최종 수정", fr: "Dernière modification"
  },
  relations: {
    "zh-CN": "关联（{0}）", en: "Relations ({0})", ja: "関連（{0}）",
    ko: "관계({0})", fr: "Relations ({0})"
  },
  relationsIntro: {
    "zh-CN": "链是严格的树，一个 Story 只有一个父级；「阻塞」「重复」这类关系在链上无处安放，由驾驶舱记录，并始终显示为驾驶舱的主张而非链的。",
    en: "The chain is a strict tree — a Story has exactly one parent — so “blocks” and “duplicates” have nowhere to live on it. The cockpit records them, and shows them as the cockpit's claim rather than the chain's.",
    ja: "チェーンは厳密なツリーで、Story の親はちょうど一つです。そのため「ブロック」「重複」といった関係はチェーン上に置き場がありません。コックピットがそれらを記録し、チェーンの主張ではなくコックピットの主張として表示します。",
    ko: "체인은 엄격한 트리이며 Story의 부모는 정확히 하나입니다. 그래서 '차단'이나 '중복' 같은 관계는 체인 위에 놓일 자리가 없습니다. 콕핏이 이를 기록하고, 체인의 주장이 아니라 콕핏의 주장으로 표시합니다.",
    fr: "La chaîne est un arbre strict — une Story a exactement un parent — donc « bloque » et « duplique » n'ont pas leur place dessus. Le cockpit les enregistre et les présente comme son propre constat, non comme celui de la chaîne."
  },
  noRelation: {
    "zh-CN": "尚无自由关联。", en: "No free relation yet.", ja: "自由関連はまだありません。",
    ko: "아직 자유 관계가 없습니다.", fr: "Aucune relation libre pour l'instant."
  },
  comments: {
    "zh-CN": "评论（{0}）", en: "Comments ({0})", ja: "コメント（{0}）",
    ko: "댓글({0})", fr: "Commentaires ({0})"
  },
  commentsIntro: {
    "zh-CN": "评论是讨论，不是治理记录。要留下有约束力的立场，请开审议——只有立场会进入链并成为证据。",
    en: "A comment is discussion, not a governance record. To leave a binding position, open a deliberation: only positions enter the chain and count as evidence.",
    ja: "コメントは議論であり、ガバナンス記録ではありません。拘束力のある立場を残すには審議を開いてください。チェーンに入り証拠となるのは立場だけです。",
    ko: "댓글은 논의이지 거버넌스 기록이 아닙니다. 구속력 있는 입장을 남기려면 심의를 여십시오. 체인에 들어가 증거가 되는 것은 입장뿐입니다.",
    fr: "Un commentaire est une discussion, pas un enregistrement de gouvernance. Pour laisser une position contraignante, ouvrez une délibération : seules les positions entrent dans la chaîne et font preuve."
  },
  noComment: {
    "zh-CN": "尚无评论。", en: "No comment yet.", ja: "コメントはまだありません。",
    ko: "아직 댓글이 없습니다.", fr: "Aucun commentaire pour l'instant."
  },
  newComment: {
    "zh-CN": "新评论", en: "New comment", ja: "新しいコメント", ko: "새 댓글", fr: "Nouveau commentaire"
  },
  commentEmpty: {
    "zh-CN": "评论不能为空", en: "A comment cannot be empty", ja: "コメントは空にできません",
    ko: "댓글은 비워 둘 수 없습니다", fr: "Un commentaire ne peut pas être vide"
  },
  writeInFlight: {
    "zh-CN": "正在写入", en: "Write in flight", ja: "書き込み中", ko: "쓰기 진행 중", fr: "Écriture en cours"
  },
  addComment: {
    "zh-CN": "发表评论", en: "Add comment", ja: "コメントを追加", ko: "댓글 추가", fr: "Ajouter un commentaire"
  }
} satisfies Record<string, CopyEntry>;

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
          {pick(locale, domainCopy.title)}
        </Heading>
        <Badge tone={availability === "writable" ? "neutral" : "warning"}>
          {availability === "writable"
            ? pick(locale, domainCopy.editable)
            : availability === "probing"
              ? pick(locale, domainCopy.checking)
              : pick(locale, domainCopy.readOnlyMirror)}
        </Badge>
      </div>

      <Text>
        {pick(locale, domainCopy.intro)}
      </Text>

      {availability === "read-only" ? (
        <InlineAlert tone="warning" data-cockpit-notice="mirror-read-only">
          {pick(locale, domainCopy.mirrorNotice)}
        </InlineAlert>
      ) : null}

      {failure ? (
        <InlineAlert tone="warning" data-domain-failure={failure}>
          {format(locale, domainCopy.writeRefused, failure)}
        </InlineAlert>
      ) : null}

      <KeyValueList
        items={[
          {
            key: "assignee",
            label: pick(locale, domainCopy.assignee),
            value: annotation?.assignee ?? pick(locale, domainCopy.unassigned)
          },
          {
            key: "priority",
            label: pick(locale, domainCopy.priority),
            value: annotation?.priority ?? "—"
          },
          {
            key: "labels",
            label: pick(locale, domainCopy.labels),
            value: annotation?.labels?.length
              ? annotation.labels.join(" · ")
              : "—"
          },
          {
            key: "updated",
            label: pick(locale, domainCopy.lastEdited),
            value: annotation
              ? `${annotation.updatedAt} · ${annotation.updatedBy}`
              : "—"
          }
        ]}
      />

      {availability === "writable" ? (
        <div className="tcrn-aos-domain-edit">
          <label className="tcrn-aos-domain-edit__field">
            <span>{pick(locale, domainCopy.assignee)}</span>
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
            <span>{pick(locale, domainCopy.priority)}</span>
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
            <span>{pick(locale, domainCopy.labelsField)}</span>
            <input
              className="tcrn-input"
              defaultValue={annotation?.labels?.join(", ") ?? ""}
              data-domain-field="labels"
              onBlur={(event) => {
                const labels = event.currentTarget.value
                  .split(",").map((entry) => entry.trim()).filter(Boolean);
                if (labels.join("\u0000") === (annotation?.labels ?? []).join("\u0000")) return;
                void send("/api/domain/annotation", "PUT", { labels });
              }}
            />
          </label>
        </div>
      ) : null}

      <Heading level={3} visualLevel={3}>
        {format(locale, domainCopy.relations, data?.relations.length ?? 0)}
      </Heading>
      <Text>
        {pick(locale, domainCopy.relationsIntro)}
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
        <EmptyState title={pick(locale, domainCopy.noRelation)} />
      )}

      <Heading level={3} visualLevel={3}>
        {format(locale, domainCopy.comments, data?.comments.length ?? 0)}
      </Heading>
      <Text>
        {pick(locale, domainCopy.commentsIntro)}
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
        <EmptyState title={pick(locale, domainCopy.noComment)} />
      )}

      {availability === "writable" ? (
        <div className="tcrn-aos-domain-edit">
          <Textarea
            aria-label={pick(locale, domainCopy.newComment)}
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
              ? pick(locale, domainCopy.commentEmpty)
              : pick(locale, domainCopy.writeInFlight)}
            onClick={() => {
              void send("/api/domain/comment", "POST", { body: draft.trim() }).then(() => setDraft(""));
            }}
          >
            {pick(locale, domainCopy.addComment)}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
