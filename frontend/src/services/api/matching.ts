/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:23
 * @Description: apis for map matching
 */
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { AxiosRequestConfig } from 'axios';
import { MatchingDetail, TaskDetail } from '@services/type';

/**
 * Map matching (run LCSS in backend)
 * @param formData files
 * @param config show axios process
 * @returns success and failed list
 */
export const mapMatching = (formData: FormData, config: AxiosRequestConfig) =>
  axiosInstance.post<unknown, AxiosResponseData<MatchingDetail>>('matching', formData, config);

/**
 * Map matching (run LCSS in wasm)
 * @param formData files
 * @param config show axios process
 * @returns success and failed list
 */
export const matchTraj = (formData: FormData, config: AxiosRequestConfig) =>
  axiosInstance.post<unknown, AxiosResponseData<TaskDetail>>('match', formData, config);
