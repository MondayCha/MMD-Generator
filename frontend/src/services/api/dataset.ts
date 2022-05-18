import { tokenManager } from '@/utils/tokenManager';
import { HOST_URL } from '@config/axios.config';
import axiosInstance, { AxiosResponseData } from '@services/axios';
import { DatasetDetail } from '@services/type';

export const getDatasets = () =>
  axiosInstance.get<unknown, AxiosResponseData<DatasetDetail[]>>('datasets');

const fetchOptions: RequestInit = {
  headers: {
    AUTHORIZATION: `Bearer ${tokenManager.getToken()}`,
  },
};

const fetchMedia = (url: string) =>
  fetch(url, fetchOptions).then((response) => {
    if (response.ok) {
      return response.blob();
    } else {
      return Promise.reject(response);
    }
  });

type DatasetFormat = 'json' | 'txt';

export const fetchDataset = (hashid: string, format: DatasetFormat) =>
  fetchMedia(`${HOST_URL}/media/datasets/${hashid}/${format}`);
