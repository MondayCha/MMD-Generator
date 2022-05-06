import axiosInstance, { AxiosResponseData } from '@services/axios';

export const login = (params: { username: string; password: string }) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('auth/login', params);

export const logout = () => axiosInstance.post<unknown, AxiosResponseData<string>>('auth/logout');

export const register = (username: string, password: string) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('users', {
    username: username,
    password: password,
  });

export const getUserInfo = () => axiosInstance.get<unknown, AxiosResponseData<string>>('user');
