import axiosInstance, { AxiosResponseData } from '@services/axios';
import { TaskDetail, TaskType } from '@services/type';

export const getTasks = (type: TaskType, size?: number) =>
  axiosInstance.get<unknown, AxiosResponseData<TaskDetail[]>>('tasks', {
    params: size ? { type: type, size: size } : { type: type },
  });
