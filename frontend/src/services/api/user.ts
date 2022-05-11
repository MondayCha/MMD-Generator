import appConfig from '@/config/app.config';
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { UserDetail } from '../type';

export const login = (params: { username: string; password: string }) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('auth/login', params);

export const logout = () => {
  localStorage.removeItem(appConfig.local_storage.auth.info);
  return axiosInstance.post<unknown, AxiosResponseData<string>>('auth/logout');
};

export const register = (username: string, password: string) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('users', {
    username: username,
    password: password,
  });

export const getUserInfo = () => axiosInstance.get<unknown, AxiosResponseData<UserDetail>>('user');
