/*
 * @Author: MondayCha
 * @Date: 2022-04-09 16:50:09
 * @Description: get matching result
 */
import axiosInstance, { AxiosResponseData } from '@services/axios';

export const uploadAnnotation = (
  groupHashid: string | undefined,
  dataName: string | undefined,
  annotation: string | undefined,
  analysis: string | undefined,
  comment: string
) => {
  let formData = new FormData();
  groupHashid && formData.append('group_hashid', groupHashid);
  dataName && formData.append('data_name', dataName);
  annotation && formData.append('annotation', annotation);
  analysis && formData.append('analysis', analysis);
  comment.length > 0 && formData.append('comment', comment);
  return axiosInstance.post<unknown, AxiosResponseData<string>>(`annotations`, formData);
};
