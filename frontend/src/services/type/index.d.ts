/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:24
 * @Description:
 */
export interface CoordinateDetail {
  longitude: number;
  latitude: number;
}

export interface TCoordinateDetail extends CoordinateDetail {
  timestamp: number;
}

export interface SubTrajectoryDetail {
  id: number;
  begin_index: number;
  end_index: number;
  trajectory: CoordinateDetail[];
}

export interface MatchingMethodDetail {
  name: string;
  unmatched_trajs: SubTrajectoryDetail[];
  raw_traj: CoordinateDetail[];
}

export interface MethodResultDetail {
  method_name: string;
  trajectory: CoordinateDetail[];
}

/**
 * @param {Array} bounds - [[lon, lat], [lon, lat]]
 */
export type Bounds = [[number, number], [number, number]];

export interface MatchingResultDetail {
  group_id: string;
  traj_name: string;
  bounds: Bounds;
  raw_traj: TCoordinateDetail[];
  matching_result: MethodResultDetail[];
}

export interface GroupDetail {
  group_id: string;
  matching_result: {
    success: string[];
    failed: string[];
  };
}

export interface UserDetail {
  username: string;
  usertype: number;
}

export interface TaskDetail {
  hashid: string;
  name: string;
}

export const enum TaskType {
  FAILED = 0,
  SUCCESS,
  MATCHED,
  CHECKED,
}

export const enum AnnotationType {
  UNREVIEW = -1,
  FAILED,
  SELECTED,
}

export interface AnnotationDetail {
  hashid: string;
  data_name: string;
  group_hashid: string;
  status: number;
}

export interface MethodMetricDetail {
  mismatched_area_count: number;
  mismatched_point_count: number;
  total_point_count: number;
}

export type MethodAnalysisDetail = [string, MethodMetricDetail];

export interface ReviewDetail {
  analysis: MethodAnalysisDetail[];
  comment: string | null;
  data_name: string;
  group_hashid: string;
  raw_traj: TCoordinateDetail[];
  trajectory: CoordinateDetail[];
  bounds: Bounds;
  annotator: string;
}

export interface DatasetDetail {
  hashid: string;
  name: string;
  size: {
    failed: number;
    processed: number;
    annotated: number;
    checked: number;
    total: number;
  };
}
