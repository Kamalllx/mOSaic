/* GENERATED from shared/schemas/mosaic.schema.json. Do not edit. */

/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "MessageType".
 */
export type MessageType = "request" | "response" | "evidence" | "clarification" | "result" | "cancel";
export type TrustLevel = "verified" | "trusted" | "unverified" | "untrusted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentFramework".
 */
export type AgentFramework = "custom" | "nooa";
export type AgentFramework1 = "custom" | "nooa";
export type ModelPolicy = "local-only" | "local-preferred" | "any";
export type AgentState =
  | "CREATED"
  | "INITIALIZING"
  | "READY"
  | "RUNNING"
  | "WAITING"
  | "PAUSED"
  | "CHECKPOINTING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "TERMINATED";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentResultStatus".
 */
export type AgentResultStatus = "completed" | "failed" | "cancelled";
export type Risk = "low" | "medium" | "high" | "critical";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentState".
 */
export type AgentState1 =
  | "CREATED"
  | "INITIALIZING"
  | "READY"
  | "RUNNING"
  | "WAITING"
  | "PAUSED"
  | "CHECKPOINTING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "TERMINATED";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Decision".
 */
export type Decision = "ALLOW" | "DENY" | "REQUIRES_APPROVAL";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^(\*|[a-z][a-z0-9_]*(\.([a-z][a-z0-9_]*|\*))+)$".
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ApprovalMode".
 */
export type ApprovalMode = "required" | "auto" | "never";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ApprovalStatus".
 */
export type ApprovalStatus1 = "pending" | "approved" | "rejected" | "expired";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AuditKind".
 */
export type AuditKind =
  | "task"
  | "spawn"
  | "state"
  | "model"
  | "knowledge"
  | "memory"
  | "ipc"
  | "syscall"
  | "policy"
  | "approval"
  | "tool"
  | "verify"
  | "commit"
  | "rollback";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ChangeKind".
 */
export type ChangeKind = "created" | "updated" | "deleted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Role".
 */
export type Role = "system" | "user" | "assistant" | "tool";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SearchMode".
 */
export type SearchMode = "lexical" | "semantic" | "graph";
export type TrustLevel1 = "verified" | "trusted" | "unverified" | "untrusted";
export type VerificationStatus = "unverified" | "verified" | "disputed" | "stale";
export type TrustLevel2 = "verified" | "trusted" | "unverified" | "untrusted";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel = "public" | "internal" | "confidential" | "restricted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "IngestSourceType".
 */
export type IngestSourceType = "file" | "directory" | "url" | "git" | "api";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel1 = "public" | "internal" | "confidential" | "restricted";
export type VerificationStatus1 = "unverified" | "verified" | "disputed" | "stale";
export type TrustLevel3 = "verified" | "trusted" | "unverified" | "untrusted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Latency".
 */
export type Latency = "critical" | "normal" | "batch";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "MemoryKind".
 */
export type MemoryKind = "working" | "episodic" | "semantic";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "MemoryScope".
 */
export type MemoryScope = "task" | "agent" | "user" | "org";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ModelPolicy".
 */
export type ModelPolicy1 = "local-only" | "local-preferred" | "any";
export type TaskClass =
  "planning" | "reasoning" | "extraction" | "summarization" | "classification" | "code" | "vision";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel2 = "public" | "internal" | "confidential" | "restricted";
export type Latency1 = "critical" | "normal" | "batch";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "NetworkMode".
 */
export type NetworkMode = "none" | "allowlist";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PrincipalKind".
 */
export type PrincipalKind = "user" | "agent" | "system";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel3 = "public" | "internal" | "confidential" | "restricted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Priority".
 */
export type Priority = "high" | "normal" | "background";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PrivacyLevel".
 */
export type PrivacyLevel4 = "public" | "internal" | "confidential" | "restricted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Risk".
 */
export type Risk1 = "low" | "medium" | "high" | "critical";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SandboxStatus".
 */
export type SandboxStatus = "provisioning" | "running" | "stopped" | "destroyed" | "failed";
export type NetworkMode1 = "none" | "allowlist";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SyscallStatus".
 */
export type SyscallStatus = "completed" | "denied" | "pending_approval" | "rejected" | "failed" | "rolled_back";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolResultStatus".
 */
export type ToolResultStatus = "success" | "error" | "timeout";
export type Priority1 = "high" | "normal" | "background";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel5 = "public" | "internal" | "confidential" | "restricted";
export type TaskStatus =
  "queued" | "planning" | "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TaskClass".
 */
export type TaskClass1 =
  "planning" | "reasoning" | "extraction" | "summarization" | "classification" | "code" | "vision";
export type Priority2 = "high" | "normal" | "background";
/**
 * Ordered from least to most sensitive. `restricted` must never leave the box.
 */
export type PrivacyLevel6 = "public" | "internal" | "confidential" | "restricted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TaskStatus".
 */
export type TaskStatus1 =
  "queued" | "planning" | "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
export type Risk2 = "low" | "medium" | "high" | "critical";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolTransport".
 */
export type ToolTransport = "native" | "mcp" | "http" | "browser" | "sandbox";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TrustLevel".
 */
export type TrustLevel4 = "verified" | "trusted" | "unverified" | "untrusted";
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "VerificationStatus".
 */
export type VerificationStatus2 = "unverified" | "verified" | "disputed" | "stale";

/**
 * mOSaic contracts v0.6.0
 */
export interface MOSaic {
  A2AMessage?: A2AMessage;
  AgentFramework?: AgentFramework;
  AgentManifest?: AgentManifest;
  AgentProcess?: AgentProcess;
  AgentResult?: AgentResult;
  AgentResultStatus?: AgentResultStatus;
  AgentState?: AgentState1;
  AllowDeny?: AllowDeny;
  Approval?: Approval;
  ApprovalMode?: ApprovalMode;
  ApprovalResolution?: ApprovalResolution;
  ApprovalStatus?: ApprovalStatus1;
  AuditEntry?: AuditEntry;
  AuditKind?: AuditKind;
  BrowserPage?: BrowserPage;
  ChangeKind?: ChangeKind;
  ChatMessage?: ChatMessage;
  Checkpoint?: Checkpoint;
  ComponentHealth?: ComponentHealth;
  Decision?: Decision;
  EmbedRequest?: EmbedRequest;
  EmbedResponse?: EmbedResponse;
  ErrorInfo?: ErrorInfo;
  Event?: Event;
  EvidenceSet?: EvidenceSet;
  ExecRequest?: ExecRequest;
  ExecResult?: ExecResult;
  FilesystemRules?: FilesystemRules;
  GpuStatus?: GpuStatus;
  GraphEdge?: GraphEdge;
  GraphResult?: GraphResult;
  IngestRequest?: IngestRequest;
  IngestResult?: IngestResult;
  IngestSourceType?: IngestSourceType;
  InvalidationReport?: InvalidationReport;
  KnowledgeChange?: KnowledgeChange;
  KnowledgeEntry?: KnowledgeEntry;
  KnowledgeListing?: KnowledgeListing;
  KnowledgeObject?: KnowledgeObject;
  Latency?: Latency;
  ManifestApproval?: ManifestApproval;
  ManifestCapabilities?: ManifestCapabilities;
  ManifestMemory?: ManifestMemory;
  ManifestNetwork?: ManifestNetwork;
  ManifestResources?: ManifestResources;
  ManifestRuntime?: ManifestRuntime;
  MemoryKind?: MemoryKind;
  MemoryQuery?: MemoryQuery;
  MemoryRecord?: MemoryRecord;
  MemoryScope?: MemoryScope;
  MessageType?: MessageType;
  ModelInfo?: ModelInfo;
  ModelPolicy?: ModelPolicy1;
  ModelRequest?: ModelRequest;
  ModelResponse?: ModelResponse;
  Mount?: Mount;
  NetworkMode?: NetworkMode;
  OKFDraft?: OKFDraft;
  OKFFrontmatter?: OKFFrontmatter;
  Plan?: Plan;
  PlanStep?: PlanStep;
  PolicyAppliesTo?: PolicyAppliesTo;
  PolicyDecision?: PolicyDecision;
  PolicyDocument?: PolicyDocument;
  Principal?: Principal;
  PrincipalKind?: PrincipalKind;
  Priority?: Priority;
  PrivacyLevel?: PrivacyLevel4;
  ProcessTreeNode?: ProcessTreeNode;
  Provenance?: Provenance;
  ResourceQuota?: ResourceQuota;
  ResourceSnapshot?: ResourceSnapshot;
  ResourceUsage?: ResourceUsage;
  Risk?: Risk1;
  Role?: Role;
  RoutingDecision?: RoutingDecision;
  RunTimeline?: RunTimeline;
  SandboxInfo?: SandboxInfo;
  SandboxSpec?: SandboxSpec;
  SandboxStatus?: SandboxStatus;
  SearchHit?: SearchHit;
  SearchMode?: SearchMode;
  SearchQuery?: SearchQuery;
  SpawnRequest?: SpawnRequest;
  StreamChunk?: StreamChunk;
  SyscallRequest?: SyscallRequest;
  SyscallResult?: SyscallResult;
  SyscallStatus?: SyscallStatus;
  SystemStatus?: SystemStatus;
  Task?: Task;
  TaskClass?: TaskClass1;
  TaskCreate?: TaskCreate;
  TaskResult?: TaskResult;
  TaskStatus?: TaskStatus1;
  TimelineStats?: TimelineStats;
  TokenUsage?: TokenUsage;
  ToolInvocation?: ToolInvocation;
  ToolOperation?: ToolOperation;
  ToolResult?: ToolResult;
  ToolResultStatus?: ToolResultStatus;
  ToolSpec?: ToolSpec;
  ToolTransport?: ToolTransport;
  TrustLevel?: TrustLevel4;
  ValidationIssue?: ValidationIssue;
  ValidationReport?: ValidationReport;
  VerificationCheck?: VerificationCheck;
  VerificationResult?: VerificationResult;
  VerificationStatus?: VerificationStatus2;
  WorkingSet?: WorkingSet;
  WorkingSetItem?: WorkingSetItem;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "A2AMessage".
 */
export interface A2AMessage {
  /**
   * "MSG-..."
   */
  message_id: string;
  task_id: string;
  sender_pid: number;
  receiver_pid: number;
  /**
   * Agent name
   */
  sender: string;
  /**
   * Agent name
   */
  receiver: string;
  type: MessageType;
  /**
   * Short human-readable text; keep under ~2k chars
   */
  content?: string;
  payload?: {
    [k: string]: unknown;
  } | null;
  payload_ref?: string | null;
  provenance?: string[];
  trust?: TrustLevel;
  in_reply_to?: string | null;
  sent_at?: string;
}
/**
 * agents/manifests/<name>.yaml — blueprint §34.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentManifest".
 */
export interface AgentManifest {
  name: string;
  version?: string;
  description: string;
  /**
   * Skills/topics used by the planner to route subtasks
   */
  handles?: string[];
  runtime: ManifestRuntime;
  memory?: ManifestMemory;
  capabilities?: ManifestCapabilities;
  resources?: ManifestResources;
  network?: ManifestNetwork;
  approval?: ManifestApproval;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestRuntime".
 */
export interface ManifestRuntime {
  framework?: AgentFramework1;
  /**
   * "module.path:ClassName"
   */
  entrypoint: string;
  model_policy?: ModelPolicy;
  model_hint?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestMemory".
 */
export interface ManifestMemory {
  mounts?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestCapabilities".
 */
export interface ManifestCapabilities {
  knowledge?: string[];
  tools?: string[];
  /**
   * Agents this one may spawn
   */
  agents?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestResources".
 */
export interface ManifestResources {
  cpu?: number;
  memory?: string;
  gpu?: number;
  max_tokens_per_task?: number;
  max_tool_calls?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestNetwork".
 */
export interface ManifestNetwork {
  allow?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ManifestApproval".
 */
export interface ManifestApproval {
  required?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentProcess".
 */
export interface AgentProcess {
  pid: number;
  ppid?: number | null;
  task_id: string;
  /**
   * user_id the process acts on behalf of
   */
  owner: string;
  /**
   * Manifest name, e.g. finance-agent
   */
  agent: string;
  agent_version?: string;
  state?: AgentState;
  goal?: string;
  /**
   * Last model the router picked for this pid
   */
  model?: string | null;
  memory_mounts?: string[];
  capabilities?: string[];
  quota?: ResourceQuota;
  usage?: ResourceUsage;
  /**
   * Host path of the ephemeral workspace
   */
  workspace?: string | null;
  checkpoint_id?: string | null;
  attempt_count?: number;
  last_error?: ErrorInfo | null;
  /**
   * e.g. "approval:APR-882", "pid:103", "ipc"
   */
  waiting_on?: string | null;
  created_at?: string;
  updated_at?: string;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ResourceQuota".
 */
export interface ResourceQuota {
  max_tokens?: number;
  max_tool_calls?: number;
  max_wall_seconds?: number;
  max_children?: number;
  cpu?: number;
  memory_mb?: number;
  /**
   * Fraction of the shared GPU
   */
  gpu?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ResourceUsage".
 */
export interface ResourceUsage {
  tokens_prompt?: number;
  tokens_completion?: number;
  tool_calls?: number;
  children_spawned?: number;
  wall_seconds?: number;
  gpu_seconds?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ErrorInfo".
 */
export interface ErrorInfo {
  /**
   * One of shared/catalogs/errors.yaml
   */
  code: string;
  message: string;
  retriable?: boolean;
  details?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AgentResult".
 */
export interface AgentResult {
  pid: number;
  agent: string;
  status: AgentResultStatus;
  summary: string;
  output?: {
    [k: string]: unknown;
  };
  artifacts?: string[];
  evidence?: string[];
  /**
   * Syscalls this agent issued
   */
  actions?: SyscallRequest[];
  usage?: ResourceUsage;
  error?: ErrorInfo | null;
}
/**
 * What an agent asks the kernel to do to the outside world (blueprint §35).
 *
 * `capability` is what policy checks; `tool` + `operation` is what the executor runs.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SyscallRequest".
 */
export interface SyscallRequest {
  /**
   * "SC-..." — assigned by the caller via new_id("SC")
   */
  syscall_id: string;
  task_id: string;
  pid: number;
  /**
   * e.g. jira.write
   */
  capability: string;
  /**
   * Tool name from ToolExecutor.list_tools(), e.g. jira
   */
  tool: string;
  /**
   * Operation on that tool, e.g. update_issue
   */
  operation: string;
  /**
   * What is touched, e.g. project/APOLLO
   */
  resource?: string | null;
  arguments?: {
    [k: string]: unknown;
  };
  arguments_ref?: string | null;
  risk?: Risk;
  justification?: string;
  /**
   * /org paths supporting the action
   */
  evidence?: string[];
  idempotency_key?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AllowDeny".
 */
export interface AllowDeny {
  allow?: string[];
  deny?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Approval".
 */
export interface Approval {
  /**
   * "APR-..."
   */
  approval_id: string;
  task_id: string;
  pid: number;
  agent: string;
  syscall: SyscallRequest;
  decision: PolicyDecision;
  status?: ApprovalStatus;
  requested_at?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  comment?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PolicyDecision".
 */
export interface PolicyDecision {
  decision: Decision;
  /**
   * Id of the policy document that decided
   */
  policy: string;
  reason: string;
  approval_id?: string | null;
  matched_rules?: string[];
  /**
   * Extra limits for the executor, e.g. {"network_allow": [...]}
   */
  constraints?: {
    [k: string]: unknown;
  };
}
/**
 * Body of POST /approvals/{id}/approve|reject.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ApprovalResolution".
 */
export interface ApprovalResolution {
  comment?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "AuditEntry".
 */
export interface AuditEntry {
  /**
   * Monotonic per task; assigned by the AuditLog
   */
  seq?: number;
  entry_id: string;
  ts?: string;
  task_id: string;
  pid?: number | null;
  /**
   * "user:alice", "agent:finance-agent#102", "kernel.policy"
   */
  actor: string;
  kind: AuditKind;
  summary: string;
  data?: {
    [k: string]: unknown;
  };
  /**
   * /org paths, artifact refs, syscall/approval ids
   */
  refs?: string[];
  /**
   * Hash chain for tamper evidence (stretch)
   */
  prev_hash?: string | null;
  hash?: string | null;
}
/**
 * What the BrowserDriver (P4) returns after every browser action.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "BrowserPage".
 */
export interface BrowserPage {
  url: string;
  title?: string;
  /**
   * Visible text, truncated to ~20k chars
   */
  text?: string;
  links?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ChatMessage".
 */
export interface ChatMessage {
  role: Role;
  content: string;
  name?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Checkpoint".
 */
export interface Checkpoint {
  checkpoint_id: string;
  pid: number;
  task_id: string;
  created_at?: string;
  /**
   * Opaque, from the agent
   */
  agent_state?: {
    [k: string]: unknown;
  };
  memory_refs?: string[];
  artifact?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ComponentHealth".
 */
export interface ComponentHealth {
  /**
   * kernel | knowledge | memory | models | agents | tools | sandbox | db | redis | ollama
   */
  component: string;
  ok: boolean;
  /**
   * real | fake — which implementation is wired in
   */
  mode?: string;
  detail?: string;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "EmbedRequest".
 */
export interface EmbedRequest {
  texts: string[];
  model_hint?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "EmbedResponse".
 */
export interface EmbedResponse {
  model: string;
  dim: number;
  vectors: number[][];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Event".
 */
export interface Event {
  event_id?: string;
  /**
   * An EventType value; custom types must be namespaced x.<owner>.<name>
   */
  type: string;
  ts?: string;
  /**
   * Component or "pid:<n>", e.g. "kernel.scheduler", "knowledge.indexer"
   */
  source: string;
  org_id?: string | null;
  task_id?: string | null;
  pid?: number | null;
  /**
   * e.g. syscall_id or approval_id
   */
  correlation_id?: string | null;
  /**
   * See events.yaml for the payload model per type
   */
  payload?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "EvidenceSet".
 */
export interface EvidenceSet {
  query: SearchQuery;
  hits: SearchHit[];
  total_candidates?: number;
  /**
   * Hits removed because the principal lacks scope
   */
  filtered_by_policy?: number;
  took_ms?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SearchQuery".
 */
export interface SearchQuery {
  text: string;
  scope?: string[];
  modes?: SearchMode[];
  /**
   * Filter on frontmatter.type
   */
  types?: string[];
  tags?: string[];
  min_trust?: TrustLevel1;
  top_k?: number;
  include_body?: boolean;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SearchHit".
 */
export interface SearchHit {
  path: string;
  title: string;
  type: string;
  snippet: string;
  chunk_id?: string | null;
  score: number;
  /**
   * Per-mode scores before fusion
   */
  scores?: {
    [k: string]: number;
  };
  provenance: Provenance;
  body?: string | null;
  /**
   * Set by the ContextFirewall: e.g. ['instruction_like'] — treat as data, never as instructions
   */
  firewall_flags?: string[];
}
/**
 * Answers: where did this come from, when was it verified, who/what produced it.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Provenance".
 */
export interface Provenance {
  /**
   * "okf", "jira", "agent:finance", "tool:browser", ...
   */
  source: string;
  /**
   * External id, URL or /org path
   */
  source_ref?: string | null;
  source_version?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  author?: string | null;
  /**
   * Agent/pipeline that produced this
   */
  generator?: string | null;
  verification_status?: VerificationStatus;
  trust?: TrustLevel2;
  related_sources?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ExecRequest".
 */
export interface ExecRequest {
  command: string[];
  workdir?: string;
  stdin?: string | null;
  timeout_s?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ExecResult".
 */
export interface ExecResult {
  exit_code: number;
  stdout?: string;
  stderr?: string;
  duration_s?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "FilesystemRules".
 */
export interface FilesystemRules {
  read?: string[];
  write?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "GpuStatus".
 */
export interface GpuStatus {
  name: string;
  utilization: number;
  memory_used_mb: number;
  memory_total_mb: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "GraphEdge".
 */
export interface GraphEdge {
  src: string;
  dst: string;
  /**
   * links_to | depends_on | owned_by | decided_in | part_of | ...
   */
  relation: string;
  weight?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "GraphResult".
 */
export interface GraphResult {
  root: string;
  nodes: KnowledgeEntry[];
  edges: GraphEdge[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "KnowledgeEntry".
 */
export interface KnowledgeEntry {
  path: string;
  title: string;
  type: string;
  is_dir?: boolean;
  privacy?: PrivacyLevel;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "IngestRequest".
 */
export interface IngestRequest {
  source_type: IngestSourceType;
  uri: string;
  target_path?: string;
  options?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "IngestResult".
 */
export interface IngestResult {
  created?: string[];
  updated?: string[];
  skipped?: string[];
  errors?: string[];
}
/**
 * Payload of the memory.invalidated event.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "InvalidationReport".
 */
export interface InvalidationReport {
  /**
   * The /org path or MEM id that changed
   */
  source: string;
  /**
   * MEM ids marked stale
   */
  invalidated?: string[];
  affected_agents?: string[];
  reconsolidation_queued?: boolean;
}
/**
 * Payload of the knowledge.changed event.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "KnowledgeChange".
 */
export interface KnowledgeChange {
  path: string;
  change: ChangeKind;
  old_hash?: string | null;
  new_hash?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "KnowledgeListing".
 */
export interface KnowledgeListing {
  path: string;
  entries: KnowledgeEntry[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "KnowledgeObject".
 */
export interface KnowledgeObject {
  path: string;
  /**
   * Path relative to the bundle root, e.g. projects/apollo.md
   */
  okf_file: string;
  frontmatter: OKFFrontmatter;
  /**
   * Markdown body without frontmatter
   */
  body: string;
  /**
   * Resolved outgoing links
   */
  links?: string[];
  provenance: Provenance;
  content_hash: string;
  version?: number;
}
/**
 * YAML frontmatter of an OKF Markdown file. Extra keys are allowed (OKF is extensible).
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "OKFFrontmatter".
 */
export interface OKFFrontmatter {
  /**
   * project | person | team | system | policy | decision | playbook | finance | note | index
   */
  type: string;
  title: string;
  description?: string | null;
  tags?: string[];
  status?: string | null;
  owner?: string | null;
  privacy?: PrivacyLevel1;
  source?: string | null;
  source_version?: string | null;
  author?: string | null;
  generator?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  verification_status?: VerificationStatus1;
  trust?: TrustLevel3;
  /**
   * Relative links or /org paths
   */
  related?: string[];
  [k: string]: unknown;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "MemoryQuery".
 */
export interface MemoryQuery {
  text: string;
  org_id: string;
  kinds?: MemoryKind[];
  scopes?: MemoryScope[];
  owner?: string | null;
  task_id?: string | null;
  include_stale?: boolean;
  top_k?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "MemoryRecord".
 */
export interface MemoryRecord {
  /**
   * "MEM-..."
   */
  memory_id: string;
  kind: MemoryKind;
  scope: MemoryScope;
  org_id: string;
  /**
   * agent name, user_id or org_id depending on scope
   */
  owner: string;
  task_id?: string | null;
  content: string;
  summary?: string | null;
  /**
   * /org paths or MEM ids this was derived from — drives invalidation
   */
  derived_from?: string[];
  tags?: string[];
  importance?: number;
  stale?: boolean;
  created_at?: string;
  last_used_at?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ModelInfo".
 */
export interface ModelInfo {
  name: string;
  provider: string;
  local?: boolean;
  context_window?: number;
  /**
   * chat | embed | vision | json | tools
   */
  capabilities?: string[];
  embedding_dim?: number | null;
  available?: boolean;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ModelRequest".
 */
export interface ModelRequest {
  messages: ChatMessage[];
  task_class?: TaskClass;
  privacy?: PrivacyLevel2;
  latency?: Latency1;
  /**
   * Preferred model; router may override
   */
  model_hint?: string | null;
  max_tokens?: number;
  temperature?: number;
  /**
   * Request structured JSON output
   */
  json_schema?: {
    [k: string]: unknown;
  } | null;
  stop?: string[];
  task_id?: string | null;
  pid?: number | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ModelResponse".
 */
export interface ModelResponse {
  model: string;
  provider: string;
  content: string;
  /**
   * Set when json_schema was requested
   */
  parsed?: {
    [k: string]: unknown;
  } | null;
  usage?: TokenUsage;
  latency_ms?: number;
  finish_reason?: string;
  local?: boolean;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TokenUsage".
 */
export interface TokenUsage {
  prompt?: number;
  completion?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Mount".
 */
export interface Mount {
  /**
   * Host path
   */
  source: string;
  /**
   * Path inside the sandbox
   */
  target: string;
  read_only?: boolean;
}
/**
 * Output of a SourceConverter (P4): one OKF file to be written into the bundle by the KnowledgeService (P2).
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "OKFDraft".
 */
export interface OKFDraft {
  /**
   * Target path relative to the bundle root, e.g. projects/apollo.md
   */
  okf_file: string;
  frontmatter: OKFFrontmatter;
  /**
   * Markdown body without frontmatter
   */
  body: string;
  /**
   * Original file / issue key / message id
   */
  source_ref?: string | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Plan".
 */
export interface Plan {
  task_id: string;
  rationale: string;
  steps: PlanStep[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PlanStep".
 */
export interface PlanStep {
  step_id: string;
  agent: string;
  goal: string;
  depends_on?: string[];
  inputs?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PolicyAppliesTo".
 */
export interface PolicyAppliesTo {
  agents?: string[];
  roles?: string[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "PolicyDocument".
 */
export interface PolicyDocument {
  /**
   * Unique id, e.g. finance-agent-v1
   */
  policy: string;
  description?: string;
  /**
   * Lower number wins when several policies match
   */
  priority?: number;
  applies_to?: PolicyAppliesTo;
  knowledge?: AllowDeny1;
  filesystem?: FilesystemRules;
  network?: AllowDeny2;
  tools?: AllowDeny3;
  approval?: {
    [k: string]: ApprovalMode;
  };
}
/**
 * PathGlobs over /org
 */
export interface AllowDeny1 {
  allow?: string[];
  deny?: string[];
}
/**
 * host:port entries
 */
export interface AllowDeny2 {
  allow?: string[];
  deny?: string[];
}
/**
 * Capability globs
 */
export interface AllowDeny3 {
  allow?: string[];
  deny?: string[];
}
/**
 * Who is asking. Agents act on behalf of a user and inherit (a subset of) their scope.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Principal".
 */
export interface Principal {
  kind: PrincipalKind;
  org_id: string;
  user_id: string;
  pid?: number | null;
  agent?: string | null;
  roles?: string[];
  capabilities?: string[];
  data_scopes?: string[];
  max_privacy?: PrivacyLevel3;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ProcessTreeNode".
 */
export interface ProcessTreeNode {
  pid: number;
  agent: string;
  state: AgentState1;
  children?: ProcessTreeNode[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ResourceSnapshot".
 */
export interface ResourceSnapshot {
  ts?: string;
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  gpu?: GpuStatus | null;
  running_processes?: number;
  queued_tasks?: number;
  active_sandboxes?: number;
  tokens_last_minute?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "RoutingDecision".
 */
export interface RoutingDecision {
  model: string;
  provider: string;
  local: boolean;
  reason: string;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "RunTimeline".
 */
export interface RunTimeline {
  task_id: string;
  goal: string;
  entries: AuditEntry[];
  stats?: TimelineStats;
  /**
   * True when the audit log recomputed every entry's hash and each prev_hash links to its predecessor; False when that check fails; None when the log keeps no hash chain
   */
  chain_verified?: boolean | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TimelineStats".
 */
export interface TimelineStats {
  agents?: number;
  models?: string[];
  knowledge_objects?: number;
  ipc_messages?: number;
  tool_calls?: number;
  privileged_syscalls?: number;
  approvals?: number;
  rollbacks?: number;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SandboxInfo".
 */
export interface SandboxInfo {
  sandbox_id: string;
  status: SandboxStatus;
  spec: SandboxSpec;
  created_at?: string;
  /**
   * noVNC / screenshot stream for the UI
   */
  live_view_url?: string | null;
  /**
   * Services exposed by the sandbox, e.g. {"playwright": "ws://172.18.0.5:3000/"}
   */
  endpoints?: {
    [k: string]: string;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SandboxSpec".
 */
export interface SandboxSpec {
  image?: string;
  task_id: string;
  pid?: number | null;
  mounts?: Mount[];
  network?: NetworkMode1;
  /**
   * host:port entries
   */
  network_allow?: string[];
  cpu?: number;
  memory_mb?: number;
  gpu?: boolean;
  timeout_s?: number;
  env?: {
    [k: string]: string;
  };
  /**
   * Start a virtual display (browser / computer use)
   */
  display?: boolean;
}
/**
 * Body of POST /agents/spawn and the argument of AgentContext.spawn().
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SpawnRequest".
 */
export interface SpawnRequest {
  agent: string;
  goal: string;
  task_id: string;
  ppid?: number | null;
  inputs?: {
    [k: string]: unknown;
  };
  /**
   * Optional narrowing; can never exceed the child's manifest. The parent controls WHICH agents it may spawn (its manifest.capabilities.agents), not their capabilities
   */
  capabilities?: string[] | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "StreamChunk".
 */
export interface StreamChunk {
  delta: string;
  done?: boolean;
  usage?: TokenUsage | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SyscallResult".
 */
export interface SyscallResult {
  syscall_id: string;
  status: SyscallStatus;
  decision: PolicyDecision;
  tool_result?: ToolResult | null;
  verified?: boolean | null;
  error?: ErrorInfo | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolResult".
 */
export interface ToolResult {
  invocation_id: string;
  status: ToolResultStatus;
  output?: {
    [k: string]: unknown;
  };
  artifacts?: string[];
  logs?: string;
  /**
   * Opaque; pass back to ToolExecutor.rollback
   */
  rollback_token?: string | null;
  started_at?: string;
  finished_at?: string;
  error?: ErrorInfo | null;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "SystemStatus".
 */
export interface SystemStatus {
  ready: boolean;
  version: string;
  contract_version: string;
  uptime_s: number;
  components: ComponentHealth[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "Task".
 */
export interface Task {
  task_id: string;
  org_id: string;
  user_id: string;
  session_id?: string | null;
  goal: string;
  priority?: Priority1;
  privacy?: PrivacyLevel5;
  data_scope?: string[];
  approval_policy?: string;
  quota?: ResourceQuota;
  status?: TaskStatus;
  root_pid?: number | null;
  created_at?: string;
  updated_at?: string;
  result?: TaskResult | null;
  error?: ErrorInfo | null;
  metadata?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TaskResult".
 */
export interface TaskResult {
  /**
   * Markdown answer shown to the user
   */
  summary: string;
  artifacts?: string[];
  /**
   * /org paths used
   */
  evidence?: string[];
  /**
   * syscall_ids committed
   */
  actions?: string[];
  usage?: ResourceUsage;
}
/**
 * Body of POST /tasks. org_id/user_id come from the auth headers, not the body.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "TaskCreate".
 */
export interface TaskCreate {
  goal: string;
  session_id?: string | null;
  priority?: Priority2;
  privacy?: PrivacyLevel6;
  data_scope?: string[];
  approval_policy?: string;
  quota?: ResourceQuota | null;
  metadata?: {
    [k: string]: unknown;
  };
}
/**
 * Built by the kernel from an ALLOWED/approved SyscallRequest. Agents never create these.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolInvocation".
 */
export interface ToolInvocation {
  invocation_id: string;
  syscall_id: string;
  task_id: string;
  pid: number;
  tool: string;
  operation: string;
  arguments?: {
    [k: string]: unknown;
  };
  arguments_ref?: string | null;
  /**
   * From PolicyDecision.constraints
   */
  constraints?: {
    [k: string]: unknown;
  };
  timeout_s?: number;
  dry_run?: boolean;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolOperation".
 */
export interface ToolOperation {
  name: string;
  capability: string;
  description: string;
  /**
   * JSON Schema
   */
  input_schema?: {
    [k: string]: unknown;
  };
  /**
   * JSON Schema
   */
  output_schema?: {
    [k: string]: unknown;
  };
  risk?: Risk2;
  reversible?: boolean;
  requires_sandbox?: boolean;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ToolSpec".
 */
export interface ToolSpec {
  name: string;
  description: string;
  transport: ToolTransport;
  operations: ToolOperation[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ValidationIssue".
 */
export interface ValidationIssue {
  okf_file: string;
  /**
   * error | warning
   */
  severity: string;
  message: string;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "ValidationReport".
 */
export interface ValidationReport {
  ok: boolean;
  files_checked: number;
  issues?: ValidationIssue[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "VerificationCheck".
 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "VerificationResult".
 */
export interface VerificationResult {
  invocation_id: string;
  passed: boolean;
  checks?: VerificationCheck[];
}
/**
 * What actually goes into the model's context for a pid. LOAD/EVICT operate on this.
 *
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "WorkingSet".
 */
export interface WorkingSet {
  pid: number;
  token_budget: number;
  tokens_used?: number;
  items?: WorkingSetItem[];
}
/**
 * This interface was referenced by `MOSaic`'s JSON-Schema
 * via the `definition` "WorkingSetItem".
 */
export interface WorkingSetItem {
  /**
   * /org path, MEM id, artifact ref or 'inline'
   */
  ref: string;
  /**
   * evidence | memory | tool_output | plan | message
   */
  source: string;
  content: string;
  tokens: number;
  pinned?: boolean;
}
