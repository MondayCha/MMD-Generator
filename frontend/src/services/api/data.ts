/*
 * @Author: MondayCha
 * @Date: 2022-04-09 16:50:09
 * @Description: get matching result
 */
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { MatchingResultDetail } from '@services/type';

export const getRawTrajMatching = (groupHashid: string | undefined, dataName: string | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<MatchingResultDetail>>(
    `matchings/${groupHashid}/${dataName}`
  );

export const getModifiedTrajMatching = (
  groupHashid: string | undefined,
  modifiedTraj: string | Blob | undefined
) => {
  let formData = new FormData();
  groupHashid && formData.append('group_hashid', groupHashid);
  modifiedTraj && formData.append('raw_traj', modifiedTraj);
  return axiosInstance.post<unknown, AxiosResponseData<MatchingResultDetail>>(`matching`, formData);
};
