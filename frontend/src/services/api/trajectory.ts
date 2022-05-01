/*
 * @Author: MondayCha
 * @Date: 2022-04-09 16:50:09
 * @Description: get matching result
 */
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { TrajectoryDetail, MatchingResultDetail } from '@services/type';

export const getTrajectory = (taskId: string | number | undefined, trajName: string | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<TrajectoryDetail>>('trajectories', {
    params: { task_id: taskId, traj_name: trajName },
  });

export const getMatchingResult = (taskId: string | undefined, trajName: string | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<MatchingResultDetail>>('sdk/results', {
    params: { task_id: taskId, traj_name: trajName },
  });
