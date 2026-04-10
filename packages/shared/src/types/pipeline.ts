export interface PipelineStageTask {
  department: string;
  instruction: string;
  assignTo?: string;  // specific agent id, or omit for director
}

export interface PipelineStage {
  name: string;
  displayName: string;
  parallel: boolean;
  dependsOn: string[];
  contextFrom: string[];
  tasks: PipelineStageTask[];
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
}

export type PipelineRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineRunStage {
  name: string;
  displayName: string;
  status: StageStatus;
  taskIds: string[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: PipelineRunStatus;
  stages: PipelineRunStage[];
  context: Record<string, string>;  // stage output context
  createdAt: string;
  completedAt: string | null;
}
