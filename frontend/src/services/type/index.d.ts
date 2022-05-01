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

export interface TrajectoryDetail {
  name: string;
  success: boolean;
  bounds: {
    left_top: CoordinateDetail;
    right_bottom: CoordinateDetail;
  };
  raw_traj: TCoordinateDetail[];
  matching_methods: MatchingMethodDetail[];
  common_trajs: SubTrajectoryDetail[];
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
  task_id: string;
  traj_name: string;
  bounds: Bounds;
  raw_traj: TCoordinateDetail[];
  matching_result: MethodResultDetail[];
}

export interface MatchingDetail {
  task_id: string;
  matching_result: {
    success: TrajectoryDetail[];
    failed: TrajectoryDetail[];
  };
}

export interface TaskDetail {
  task_id: string;
  matching_result: {
    success: string[];
    failed: string[];
  };
}
