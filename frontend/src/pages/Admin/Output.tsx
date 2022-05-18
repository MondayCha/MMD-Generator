import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams, useNavigate } from 'react-router-dom';
import useFlooksStore from '@hooks/useFlooksStore';
import { useDropzone } from 'react-dropzone';
import { api } from '@services/api';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@components/theme';
import { Language, Moon, Settings } from 'tabler-icons-react';
import toast from 'react-hot-toast';
import log from '@middleware/logger';
import type { AxiosRequestConfig } from 'axios';
import NavigationBar from '@/components/basic/NavigationBar';
import { DatasetDetail, TaskDetail, TaskType } from '@/services/type';

enum MatchingStatus {
  idling,
  uploading,
  waiting,
  downloading,
  working,
}

function Home() {
  // hooks (theme, i18n)
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetDetail[]>([]);

  useEffect(() => {
    api.dataset.getDatasets().then(({ detail }) => {
      setDatasets(detail as DatasetDetail[]);
    });
  }, []);

  const downloadDataset = (datasetId: string, onlyTraj: boolean) => {
    const format = onlyTraj ? 'txt' : 'json';
    api.dataset
      .fetchDataset(datasetId, format)
      .then((blob) => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `${datasetId}.zip`;
        a.click();
      })
      .catch(() => {
        toast('Fetch Rec Image Failed', { id: 'download' });
      });
  };

  return (
    <div className="max-w-screen min-h-screen bg-slate-50 dark:bg-slate-800">
      <NavigationBar />
      <div className="m-0 grid grid-flow-row gap-6 px-6 py-6 lg:px-36">
        {datasets.length > 0 ? (
          datasets.map((dataset) => (
            <div
              key={`${dataset.name}${dataset.hashid}`}
              className="card border-2 bg-white dark:border-0 dark:bg-slate-700 dark:shadow-md"
            >
              <div className="card-body m-0 p-4">
                <div className="grid grid-cols-4 items-center gap-3">
                  <h3 className="text-lg font-semibold dark:text-white">{dataset.name}</h3>
                  <div className="col-span-2 flex w-full flex-col space-y-2">
                    <progress
                      className="progress progress-primary w-full"
                      value={dataset.size.checked}
                      max={dataset.size.total}
                    ></progress>
                    <progress
                      className="progress progress-secondary w-full"
                      value={dataset.size.annotated}
                      max={dataset.size.total}
                    ></progress>
                  </div>
                  <div className="flex flex-row items-center justify-end space-x-2">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => downloadDataset(dataset.hashid, false)}
                    >
                      导出 JSON
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => downloadDataset(dataset.hashid, true)}
                    >
                      导出 TXT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-4 flex justify-center">暂无数据</div>
        )}
      </div>
    </div>
  );
}

export default Home;
