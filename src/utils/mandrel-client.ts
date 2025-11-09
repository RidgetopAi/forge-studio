/**
 * Mandrel MCP HTTP Bridge Client
 *
 * Communicates with the Mandrel MCP server via HTTP bridge at localhost:8080
 * Provides typed interface for all 27 Mandrel tools
 */

import { logger } from './logger.js';

const MANDREL_BASE_URL = process.env.MANDREL_URL || 'http://localhost:8080';
const MANDREL_TIMEOUT = 30000; // 30 seconds

export interface MandrelToolResult {
  success: boolean;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: string;
}

export class MandrelClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = MANDREL_BASE_URL, timeout: number = MANDREL_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Call a Mandrel MCP tool via HTTP bridge
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<MandrelToolResult> {
    const url = `${this.baseUrl}/mcp/tools/${toolName}`;

    logger.debug(`Calling Mandrel tool: ${toolName}`, { args });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Mandrel tool ${toolName} failed: ${response.status}`, { errorText });
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      logger.debug(`Mandrel tool ${toolName} succeeded`, { data });

      return data as MandrelToolResult;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error(`Mandrel tool ${toolName} timed out after ${this.timeout}ms`);
          return {
            success: false,
            error: `Request timed out after ${this.timeout}ms`,
          };
        }

        logger.error(`Mandrel tool ${toolName} error: ${error.message}`, { error });
        return {
          success: false,
          error: error.message,
        };
      }

      logger.error(`Mandrel tool ${toolName} unknown error`, { error });
      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Test connectivity to Mandrel HTTP bridge
   */
  async ping(message?: string): Promise<MandrelToolResult> {
    return this.callTool('mandrel_ping', message ? { message } : {});
  }

  /**
   * Get Mandrel server status
   */
  async status(): Promise<MandrelToolResult> {
    return this.callTool('mandrel_status');
  }

  /**
   * Get help for all Mandrel tools
   */
  async help(): Promise<MandrelToolResult> {
    return this.callTool('mandrel_help');
  }

  /**
   * Get detailed help for a specific tool
   */
  async explain(toolName: string): Promise<MandrelToolResult> {
    return this.callTool('mandrel_explain', { toolName });
  }

  /**
   * Get usage examples for a specific tool
   */
  async examples(toolName: string): Promise<MandrelToolResult> {
    return this.callTool('mandrel_examples', { toolName });
  }

  /**
   * Store context with automatic embedding generation
   */
  async storeContext(params: {
    content: string;
    type: 'code' | 'decision' | 'error' | 'discussion' | 'planning' | 'completion' | 'milestone' | 'reflections' | 'handoff';
    tags?: string[];
    projectId?: string;
    relevanceScore?: number;
  }): Promise<MandrelToolResult> {
    return this.callTool('context_store', params);
  }

  /**
   * Search stored contexts using semantic similarity
   */
  async searchContext(params: {
    query: string;
    limit?: number;
    minSimilarity?: number;
    type?: string;
    tags?: string[];
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('context_search', params);
  }

  /**
   * Get recent contexts in chronological order
   */
  async getRecentContexts(params?: {
    limit?: number;
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('context_get_recent', params || {});
  }

  /**
   * Get context statistics
   */
  async getContextStats(projectId?: string): Promise<MandrelToolResult> {
    return this.callTool('context_stats', projectId ? { projectId } : {});
  }

  /**
   * List all projects
   */
  async listProjects(includeStats?: boolean): Promise<MandrelToolResult> {
    return this.callTool('project_list', includeStats ? { includeStats } : {});
  }

  /**
   * Create a new project
   */
  async createProject(params: {
    name: string;
    description?: string;
    gitRepoUrl?: string;
    rootDirectory?: string;
    metadata?: Record<string, any>;
  }): Promise<MandrelToolResult> {
    return this.callTool('project_create', params);
  }

  /**
   * Switch to a different project
   */
  async switchProject(project: string): Promise<MandrelToolResult> {
    return this.callTool('project_switch', { project });
  }

  /**
   * Get current active project
   */
  async getCurrentProject(): Promise<MandrelToolResult> {
    return this.callTool('project_current');
  }

  /**
   * Get project information
   */
  async getProjectInfo(project: string): Promise<MandrelToolResult> {
    return this.callTool('project_info', { project });
  }

  /**
   * Record a technical decision
   */
  async recordDecision(params: {
    decisionType: string;
    title: string;
    description: string;
    rationale: string;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    alternativesConsidered?: Array<{
      name: string;
      pros: string[];
      cons: string[];
      reasonRejected: string;
    }>;
    affectedComponents?: string[];
    projectId?: string;
    tags?: string[];
  }): Promise<MandrelToolResult> {
    return this.callTool('decision_record', params);
  }

  /**
   * Search technical decisions
   */
  async searchDecisions(params?: {
    query?: string;
    decisionType?: string;
    impactLevel?: string;
    component?: string;
    tags?: string[];
    projectId?: string;
    limit?: number;
  }): Promise<MandrelToolResult> {
    return this.callTool('decision_search', params || {});
  }

  /**
   * Update decision status/outcomes
   */
  async updateDecision(params: {
    decisionId: string;
    outcomeStatus?: 'unknown' | 'successful' | 'failed' | 'mixed' | 'too_early';
    outcomeNotes?: string;
    lessonsLearned?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('decision_update', params);
  }

  /**
   * Get decision statistics
   */
  async getDecisionStats(projectId?: string): Promise<MandrelToolResult> {
    return this.callTool('decision_stats', projectId ? { projectId } : {});
  }

  /**
   * Create a new task
   */
  async createTask(params: {
    title: string;
    description?: string;
    type?: 'feature' | 'bugfix' | 'refactor' | 'test' | 'review' | 'documentation';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;
    dependencies?: string[];
    projectId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<MandrelToolResult> {
    return this.callTool('task_create', params);
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(params?: {
    status?: 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
    statuses?: string[];
    assignedTo?: string;
    priority?: string;
    type?: string;
    tags?: string[];
    phase?: string;
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('task_list', params || {});
  }

  /**
   * Update task status and assignment
   */
  async updateTask(params: {
    taskId: string;
    status: 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
    assignedTo?: string;
    metadata?: Record<string, any>;
  }): Promise<MandrelToolResult> {
    return this.callTool('task_update', params);
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskId: string, projectId?: string): Promise<MandrelToolResult> {
    return this.callTool('task_details', projectId ? { taskId, projectId } : { taskId });
  }

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdateTasks(params: {
    task_ids: string[];
    status?: 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
    priority?: string;
    assignedTo?: string;
    notes?: string;
    metadata?: Record<string, any>;
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('task_bulk_update', params);
  }

  /**
   * Get task progress summary
   */
  async getTaskProgress(params?: {
    projectId?: string;
    groupBy?: 'phase' | 'status' | 'priority' | 'type' | 'assignedTo';
  }): Promise<MandrelToolResult> {
    return this.callTool('task_progress_summary', params || {});
  }

  /**
   * Smart search across all data sources
   */
  async smartSearch(params: {
    query: string;
    includeTypes?: string[];
    limit?: number;
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('smart_search', params);
  }

  /**
   * Get AI-powered recommendations
   */
  async getRecommendations(params: {
    context: string;
    type?: 'naming' | 'implementation' | 'architecture' | 'testing';
    projectId?: string;
  }): Promise<MandrelToolResult> {
    return this.callTool('get_recommendations', params);
  }

  /**
   * Get comprehensive project insights
   */
  async getProjectInsights(projectId?: string): Promise<MandrelToolResult> {
    return this.callTool('project_insights', projectId ? { projectId } : {});
  }
}

// Export singleton instance
export const mandrel = new MandrelClient();
