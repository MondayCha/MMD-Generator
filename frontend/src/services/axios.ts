import axios, { AxiosRequestConfig, AxiosError, AxiosInstance } from 'axios';
import { HOST_URL } from '@config/axios.config';
import log from '@middleware/logger';
import toast from 'react-hot-toast';

export interface AxiosResponseData<T> {
  detail: string | T;
  status_code: number;
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${HOST_URL}/api`,
  withCredentials: true,
  onUploadProgress: (progressEvent) => {
    return progressEvent;
  },
  onDownloadProgress: (progressEvent) => {
    return progressEvent;
  },
});

/**
 * @description: request interceptor, add uuid in headers.
 */
axiosInstance.interceptors.request.use(
  (config: AxiosRequestConfig): AxiosRequestConfig => {
    config.headers!.AUTHORIZATION = `bear ${localStorage.getItem('token')}`;
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * @description: response interceptor, global error handler.
 */

axiosInstance.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    log.error(error.response?.data?.detail ?? error.message);
    toast.error(error.response?.data?.detail ?? error.message, { id: 'axiosError' });
    return Promise.reject(error);
  }
);

export default axiosInstance;
