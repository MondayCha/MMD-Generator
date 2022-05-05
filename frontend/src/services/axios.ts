import axios, { AxiosRequestConfig, AxiosError, AxiosInstance } from 'axios';
import { HOST_URL } from '@config/axios.config';
import log from '@middleware/logger';
import toast from 'react-hot-toast';
import { tokenManager } from '@utils/tokenManager';
import appConfig from '@/config/app.config';

export interface AxiosResponseData<T> {
  detail: string | T;
  status_code: number;
  access_token?: string;
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
    config.headers!.AUTHORIZATION = `Bearer ${tokenManager.getToken()}`;
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
    const res = response.data;
    res.access_token && tokenManager.setToken(res.access_token);
    return res;
  },
  (error) => {
    if (error.response.status === 401) {
      tokenManager.clearAll();
      toast.error('登录已过期，请重新登录', { id: 'axiosError' });
      sessionStorage.setItem(appConfig.local_storage.auth.from, window.location.pathname);
      window.location.href = '/login';
    } else {
      log.error(error.response?.data?.detail ?? error.message);
      toast.error(error.response?.data?.detail ?? error.message, { id: 'axiosError' });
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
