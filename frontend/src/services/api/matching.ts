import axiosInstance, { AxiosResponseData } from '@services/axios';
import { AxiosRequestConfig } from 'axios';
import { MatchingDetail } from '@services/type';

export const mapMatching = (formData: FormData, config: AxiosRequestConfig) =>
  axiosInstance.post<unknown, AxiosResponseData<MatchingDetail>>('matching', formData, config);
