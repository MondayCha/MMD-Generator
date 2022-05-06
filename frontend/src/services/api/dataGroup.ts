import axiosInstance, { AxiosResponseData } from '@services/axios';
import type { GroupDetail } from '@services/type';
import type { AxiosRequestConfig } from 'axios';

export const getDataGroup = (groupHashid: string | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<GroupDetail>>(`data_groups/${groupHashid}`);

/**
 * Map matching (run LCSS in wasm)
 * @param formData files
 * @param config show axios process
 * @returns success and failed list
 */
export const uploadDataGroup = (formData: FormData, config: AxiosRequestConfig) =>
  axiosInstance.post<unknown, AxiosResponseData<GroupDetail>>('data_groups', formData, config);
