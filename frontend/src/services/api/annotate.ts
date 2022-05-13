/*
 * @Author: MondayCha
 * @Date: 2022-04-09 16:50:09
 * @Description: get matching result
 */
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { AnnotationType, AnnotationDetail, ReviewDetail } from '@services/type';

export const uploadAnnotation = (
  groupHashid: string | undefined,
  dataName: string | undefined,
  annotation: string | undefined,
  analysis: string | undefined,
  rawTraj: string | undefined,
  bounds: string | undefined,
  comment: string
) => {
  let formData = new FormData();
  groupHashid && formData.append('group_hashid', groupHashid);
  dataName && formData.append('data_name', dataName);
  annotation && formData.append('annotation', annotation);
  analysis && formData.append('analysis', analysis);
  rawTraj && formData.append('raw_traj', rawTraj);
  bounds && formData.append('bounds', bounds);
  comment.length > 0 && formData.append('comment', comment);
  return axiosInstance.post<unknown, AxiosResponseData<string>>(`annotations`, formData);
};

export const getAnnotations = (type?: AnnotationType) =>
  axiosInstance.get<unknown, AxiosResponseData<AnnotationDetail[]>>(
    `annotations`,
    type && {
      params: { type: type },
    }
  );

export const getAnnotation = (hashid: string) =>
  axiosInstance.get<unknown, AxiosResponseData<ReviewDetail>>(`annotations/${hashid}`);

export const reviewAnnotation = (hashid: string, status: number, comment: string) => {
  let formData = new FormData();
  formData.append('status', status.toString());
  comment.length > 0 && formData.append('review_comment', comment);
  return axiosInstance.put<unknown, AxiosResponseData<ReviewDetail>>(
    `annotations/${hashid}`,
    formData
  );
};
