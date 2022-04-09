import axiosInstance, { AxiosResponseData } from '@services/axios';
import { TrajectoryDetail } from '@services/type';

export const getTrajectory = (taskId: string | number | undefined, trajName: string | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<TrajectoryDetail>>('trajectories', {
    params: { task_id: taskId, traj_name: trajName },
  });
