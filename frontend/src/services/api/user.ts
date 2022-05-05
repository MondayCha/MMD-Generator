import axiosInstance, { AxiosResponseData } from '@services/axios';

export const login = (params: { username: string; password: string }) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('login', params);

export const register = (params: { username: string; password: string }) =>
  axiosInstance.post<unknown, AxiosResponseData<string>>('register', params);

export const getUser = () => axiosInstance.get<unknown, AxiosResponseData<string>>('user');

export const logout = () => {
  axiosInstance.post<unknown, AxiosResponseData<string>>('logout');
};
