export interface CoordinateDetail {
  longitude: number;
  latitude: number;
}

export interface SubTrajectoryDetail {
  id: string;
  begin_index: number;
  end_index: number;
  trajectory: CoordinateDetail[];
}

export interface MatchingMethodDetail {
  name: string;
  unmatched_trajs: SubTrajectoryDetail[];
}

export interface TrajectoryDetail {
  name: string;
  success: boolean;
  bounds: {
    left_top: CoordinateDetail;
    right_bottom: CoordinateDetail;
  };
  matching_methods: MatchingMethodDetail[];
  common_trajs: SubTrajectoryDetail[];
}

export interface MatchingDetail {
  task_id: number;
  matching_result: {
    success: TrajectoryDetail[];
    failed: TrajectoryDetail[];
  };
}

export interface TaskDetail {
  id: number;
  success: string[];
  failed: string[];
}