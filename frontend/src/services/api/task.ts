import axiosInstance, { AxiosResponseData } from '@services/axios';
import { TaskDetail } from '@services/type';

export const getTaskInfo = (taskId: string | number | undefined) =>
  axiosInstance.get<unknown, AxiosResponseData<TaskDetail>>('tasks', {
    params: { task_id: taskId },
  });
