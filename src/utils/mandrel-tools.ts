/**
 * Mandrel MCP Tool Type Definitions
 *
 * TypeScript interfaces for all 27 Mandrel MCP tools
 */

// ============================================================================
// SYSTEM HEALTH TOOLS (2)
// ============================================================================

export interface PingParams {
  message?: string;
}

export interface StatusResponse {
  uptime: number;
  toolsAvailable: number;
  databaseConnected: boolean;
}

// ============================================================================
// NAVIGATION TOOLS (3)
// ============================================================================

export interface ExplainParams {
  toolName: string;
}

export interface ExamplesParams {
  toolName: string;
}

// ============================================================================
// CONTEXT MANAGEMENT TOOLS (4)
// ============================================================================

export type ContextType =
  | 'code'
  | 'decision'
  | 'error'
  | 'discussion'
  | 'planning'
  | 'completion'
  | 'milestone'
  | 'reflections'
  | 'handoff';

export interface ContextStoreParams {
  content: string;
  type: ContextType;
  tags?: string[];
  projectId?: string;
  sessionId?: string;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface ContextSearchParams {
  query: string;
  limit?: number;
  minSimilarity?: number;
  type?: ContextType;
  tags?: string[];
  projectId?: string;
}

export interface ContextGetRecentParams {
  limit?: number;
  projectId?: string;
}

export interface ContextStatsParams {
  projectId?: string;
}

export interface Context {
  id: string;
  content: string;
  type: ContextType;
  tags: string[];
  projectId?: string;
  sessionId?: string;
  relevanceScore?: number;
  createdAt: string;
  similarity?: number;
}

export interface ContextStats {
  totalContexts: number;
  byType: Record<ContextType, number>;
  byProject: Record<string, number>;
  recentCount: number;
}

// ============================================================================
// PROJECT MANAGEMENT TOOLS (6)
// ============================================================================

export interface ProjectListParams {
  includeStats?: boolean;
}

export interface ProjectCreateParams {
  name: string;
  description?: string;
  gitRepoUrl?: string;
  rootDirectory?: string;
  metadata?: Record<string, any>;
}

export interface ProjectSwitchParams {
  project: string;
}

export interface ProjectInfoParams {
  project: string;
}

export interface ProjectInsightsParams {
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  gitRepoUrl?: string;
  rootDirectory?: string;
  status: 'active' | 'archived';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  contextCount?: number;
  taskCount?: number;
  decisionCount?: number;
}

// ============================================================================
// TECHNICAL DECISION TOOLS (4)
// ============================================================================

export type DecisionType =
  | 'architecture'
  | 'library'
  | 'framework'
  | 'pattern'
  | 'api_design'
  | 'database'
  | 'deployment'
  | 'security'
  | 'performance'
  | 'ui_ux'
  | 'testing'
  | 'tooling'
  | 'process'
  | 'naming_convention'
  | 'code_style';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export type OutcomeStatus = 'unknown' | 'successful' | 'failed' | 'mixed' | 'too_early';

export interface DecisionAlternative {
  name: string;
  pros: string[];
  cons: string[];
  reasonRejected: string;
}

export interface DecisionRecordParams {
  decisionType: DecisionType;
  title: string;
  description: string;
  rationale: string;
  impactLevel: ImpactLevel;
  problemStatement?: string;
  alternativesConsidered?: DecisionAlternative[];
  affectedComponents?: string[];
  projectId?: string;
  tags?: string[];
}

export interface DecisionSearchParams {
  query?: string;
  decisionType?: DecisionType;
  impactLevel?: ImpactLevel;
  component?: string;
  tags?: string[];
  projectId?: string;
  limit?: number;
}

export interface DecisionUpdateParams {
  decisionId: string;
  outcomeStatus?: OutcomeStatus;
  outcomeNotes?: string;
  lessonsLearned?: string;
}

export interface DecisionStatsParams {
  projectId?: string;
}

export interface Decision {
  id: string;
  decisionType: DecisionType;
  title: string;
  description: string;
  rationale: string;
  impactLevel: ImpactLevel;
  problemStatement?: string;
  alternativesConsidered?: DecisionAlternative[];
  affectedComponents?: string[];
  outcomeStatus?: OutcomeStatus;
  outcomeNotes?: string;
  lessonsLearned?: string;
  projectId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TASK MANAGEMENT TOOLS (6)
// ============================================================================

export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'review' | 'documentation';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskCreateParams {
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  assignedTo?: string;
  dependencies?: string[];
  projectId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TaskListParams {
  status?: TaskStatus;
  statuses?: TaskStatus[];
  assignedTo?: string;
  priority?: TaskPriority;
  type?: TaskType;
  tags?: string[];
  phase?: string;
  projectId?: string;
}

export interface TaskUpdateParams {
  taskId: string;
  status: TaskStatus;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

export interface TaskDetailsParams {
  taskId: string;
  projectId?: string;
}

export interface TaskBulkUpdateParams {
  task_ids: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  notes?: string;
  metadata?: Record<string, any>;
  projectId?: string;
}

export interface TaskProgressSummaryParams {
  projectId?: string;
  groupBy?: 'phase' | 'status' | 'priority' | 'type' | 'assignedTo';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  dependencies?: string[];
  projectId?: string;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskProgressGroup {
  groupValue: string;
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  blocked: number;
  cancelled: number;
  completionPercentage: number;
}

// ============================================================================
// SMART SEARCH & AI TOOLS (2)
// ============================================================================

export type SearchDataSource = 'context' | 'component' | 'decision' | 'naming' | 'task' | 'agent';

export interface SmartSearchParams {
  query: string;
  includeTypes?: SearchDataSource[];
  limit?: number;
  projectId?: string;
}

export type RecommendationType = 'naming' | 'implementation' | 'architecture' | 'testing';

export interface GetRecommendationsParams {
  context: string;
  type?: RecommendationType;
  projectId?: string;
}

export interface SearchResult {
  source: SearchDataSource;
  id: string;
  title: string;
  content: string;
  relevance: number;
  metadata?: Record<string, any>;
}

export interface Recommendation {
  type: RecommendationType;
  suggestion: string;
  rationale: string;
  confidence: number;
  relatedDecisions?: string[];
  relatedContexts?: string[];
}

// ============================================================================
// TOOL RESPONSE WRAPPER
// ============================================================================

export interface MandrelToolResponse<T = any> {
  success: boolean;
  result?: {
    content: Array<{
      type: 'text' | 'json';
      text: string;
      data?: T;
    }>;
  };
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type MandrelToolName =
  | 'mandrel_ping'
  | 'mandrel_status'
  | 'mandrel_help'
  | 'mandrel_explain'
  | 'mandrel_examples'
  | 'context_store'
  | 'context_search'
  | 'context_get_recent'
  | 'context_stats'
  | 'project_list'
  | 'project_create'
  | 'project_switch'
  | 'project_current'
  | 'project_info'
  | 'project_insights'
  | 'decision_record'
  | 'decision_search'
  | 'decision_update'
  | 'decision_stats'
  | 'task_create'
  | 'task_list'
  | 'task_update'
  | 'task_details'
  | 'task_bulk_update'
  | 'task_progress_summary'
  | 'smart_search'
  | 'get_recommendations';

export interface MandrelToolCallParams {
  mandrel_ping: PingParams;
  mandrel_status: Record<string, never>;
  mandrel_help: Record<string, never>;
  mandrel_explain: ExplainParams;
  mandrel_examples: ExamplesParams;
  context_store: ContextStoreParams;
  context_search: ContextSearchParams;
  context_get_recent: ContextGetRecentParams;
  context_stats: ContextStatsParams;
  project_list: ProjectListParams;
  project_create: ProjectCreateParams;
  project_switch: ProjectSwitchParams;
  project_current: Record<string, never>;
  project_info: ProjectInfoParams;
  project_insights: ProjectInsightsParams;
  decision_record: DecisionRecordParams;
  decision_search: DecisionSearchParams;
  decision_update: DecisionUpdateParams;
  decision_stats: DecisionStatsParams;
  task_create: TaskCreateParams;
  task_list: TaskListParams;
  task_update: TaskUpdateParams;
  task_details: TaskDetailsParams;
  task_bulk_update: TaskBulkUpdateParams;
  task_progress_summary: TaskProgressSummaryParams;
  smart_search: SmartSearchParams;
  get_recommendations: GetRecommendationsParams;
}
