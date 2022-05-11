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
import { TaskDetail, TaskType } from '@/services/type';

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
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskDetail[]>([]);

  useEffect(() => {
    api.task.getTasks(3).then(({ detail }) => {
      const tasks = detail as TaskDetail[];
      setTasks(tasks);
    });
  }, []);

  return (
    <div className="max-w-screen min-h-screen bg-slate-50 dark:bg-slate-800">
      <NavigationBar />
      <div className="m-0 grid grid-flow-row grid-cols-4 gap-6 px-6 py-6 lg:px-36">
        {tasks.length > 0 ? (
          tasks
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((task) => (
              <div
                key={`${task.name}${task.hashid}`}
                className="card border-2 bg-white dark:border-0 dark:bg-slate-700 dark:shadow-md"
              >
                <div className="card-body m-0 p-4">
                  <div className="card-actions justify-between">
                    <h3 className="text-lg font-semibold dark:text-white">{task.name}</h3>
                    <Link
                      to={`/annotations/${task.hashid}/${task.name}`}
                      target="_blank"
                      style={{ textDecoration: 'none' }}
                    >
                      <button className="btn btn-primary btn-sm">标注</button>
                    </Link>
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
