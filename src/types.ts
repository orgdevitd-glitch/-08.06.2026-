/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProjectStatus =
  | "active"
  | "waiting"
  | "completed"
  | "cancelled"
  | "overdue"
  | "at_risk"
  | "unknown";

export interface Project {
  projectId: string;
  projectUrl?: string;
  projectName: string;
  projectDescription?: string;

  stage?: string;
  status: ProjectStatus;

  owner?: string;
  executor?: string;
  coExecutors?: string[];
  observers?: string[];

  createdAt?: string;
  deadlineAt?: string;
  startDate?: string;
  endDate?: string;

  lastPcDate?: string | null;
  monitoringFrequencyWeeks?: number | null;

  goals?: string[];
  linkedGoals?: string[];

  resourceLevel?: string | null;
  resourceValue?: string | null;
  itResourceLevel?: string | null;

  rice?: number | null;
  roi?: number | null;

  tasks: ProjectTask[];
  milestones: ProjectTask[];
  indicators: ProjectIndicator[];
  risks?: ProjectRisk[];

  createdInAppAt?: string;
  updatedInAppAt?: string;
  lastSyncId?: string;
  source?: "sheets" | "bitrix24";
  lastAnalysis?: ProjectAnalysisResult | null;
  priority?: number | null;
  department?: string | null;

  _rawQuarters?: {
    q1plan: number | null; q1fact: number | null;
    q2plan: number | null; q2fact: number | null;
    q3plan: number | null; q3fact: number | null;
    q4plan: number | null; q4fact: number | null;
  };
  _rawMilestonesNew?: {
    q1names: string | null; q1progress: string | null; q1weights: string | null;
    q2names: string | null; q2progress: string | null; q2weights: string | null;
    q3names: string | null; q3progress: string | null; q3weights: string | null;
    q4names: string | null; q4progress: string | null; q4weights: string | null;
  };
  _rawIndicatorsNew?: {
    q1names: string | null; q1plans: string | null; q1facts: string | null;
    q2names: string | null; q2plans: string | null; q2facts: string | null;
    q3names: string | null; q3plans: string | null; q3facts: string | null;
    q4names: string | null; q4plans: string | null; q4facts: string | null;
  };
  _rawMonitoring?: {
    plannedNextPcPattern: string | null;
    pcStatusPattern: string | null;
  };
  _rawAnalysisComment?: string;
  _metrics?: ProjectCalculatedMetrics;
}

export type TaskStatus =
  | "Ждёт выполнения"
  | "Выполняется"
  | "Завершена"
  | "Отменена"
  | "Просрочена"
  | "Не указан";

export interface ProjectTask {
  taskId: string;
  taskUrl?: string;
  title: string;
  description?: string;

  status: TaskStatus;
  owner?: string;
  executor?: string;

  createdAt?: string;
  deadlineAt?: string;
  completedAt?: string | null;

  quarter?: string;
  weight?: number | null;
  progressPercent?: number | null;

  isMilestone?: boolean;
  resultText?: string;
  commentsForAnalysis?: string[];
}

export interface ProjectIndicator {
  indicatorId: string;
  name: string;
  planValue?: string | number | null;
  factValue?: string | number | null;
  unit?: string | null;
  period?: string | null;
  comment?: string | null;
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface ProjectRisk {
  riskId: string;
  title: string;
  description?: string;
  severity: RiskSeverity;
  owner?: string;
  recommendation?: string;
}

export interface ProjectCalculatedMetrics {
  technicalCompletenessPercent: number | null;
  significantCompletenessPercent: number | null;

  totalFields: number;
  filledFields: number;
  significantFields: number;
  filledSignificantFields: number;
  missingSignificantFields: string[];

  nextPcDate: string | null;
  pcStatus: "Своевременно" | "Просрочен" | "Недостаточно данных";

  weightedTaskProgressPercent: number | null;

  planFactByQuarter: Array<{
    quarter: string;
    planWeight: number;
    factWeight: number;
    deviation: number;
    status: "ok" | "risk" | "not_started";
  }>;

  dataWarnings: string[];
  
  indicatorsStatus: string;
  overallStatus: "Норма" | "Под наблюдением" | "Зона риска" | "Недостаточно данных";
  totalPlanWeight: number;
  totalFactWeight: number;
  deviationPercent: number | null;
}

export interface ProjectAnalysisResult {
  analysisId: string;
  projectId: string;
  createdAt: string;
  model: string;

  shortAnalysis: {
    dataCompleteness: string;
    missingSignificantData: string[];
    pcTimeliness: string;
    nextPcDate: string | null;
    assessmentDate: string | null;
    weightedTaskProgress: string;
    periodPlan: string;
    periodFact: string;
    deviation: string;
    indicators: string;
    overallStatus: string;
  };

  keyProblems: Array<{
    problem: string;
    managementAssessment: string;
    severity: "low" | "medium" | "high" | "critical" | "сырые" | "низкая" | "средняя" | "высокая" | "критическая";
  }>;

  managementConclusion: string;

  priorityActions: Array<{
    priority: number;
    action: string;
    owner?: string;
  }>;

  detailedAnalysis: {
    dataCompleteness: string;
    pcTimeliness: string;
    tasksAndMilestones: string;
    planFact: string;
    indicators: string;
    lagOrAdvance: string;
    projectProposal: string;
    aiProposal: string;
  };
}

export interface SyncLog {
  syncId: string;
  source: "bitrix24" | "sheets" | string;
  mode: "test" | "full" | "partial";
  syncedAt?: string;
  receivedAt: string;
  receivedProjects: number;
  created: number;
  updated: number;
  deleted?: number;
  errors: Array<{
    projectId?: string;
    field?: string;
    message: string;
  }>;
}

export interface Stats {
  total: number;
  active: number;
  completed: number;
  atRisk: number;
  overdue: number;
  missingData?: number;
  avgCompleteness?: number;
  avgProgress?: number;
  noIndicators?: number;
  lagging?: number;
}

export const THEME = {
  black: '#010101',
  yellow: '#F8BC03',
  white: '#FFFFFF',
  red: '#ef4444',
  green: '#10b981',
  orange: '#f59e0b',
  gray: '#9ca3af',
  blue: '#3b82f6',
  purple: '#8b5cf6'
};

export const CHART_COLORS = [THEME.black, THEME.yellow, THEME.blue, THEME.green, THEME.purple, THEME.orange, '#06b6d4', '#f43f5e', '#84cc16'];
