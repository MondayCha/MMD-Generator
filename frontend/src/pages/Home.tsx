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
// Types
import { MatchingDetail, TaskDetail } from '@services/type';
import { AxiosRequestConfig } from 'axios';
import log from '@middleware/logger';

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
  const { switchLocaleMode } = useFlooksStore();
  const { toggleTheme } = useThemeContext();
  // home page state
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>(MatchingStatus.idling);
  const [task, setTask] = useState<number>(0);
  const [successTrajNames, setSuccessTrajNames] = useState<string[]>([]);
  const [failedTrajNames, setFailedTrajNames] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [hasSaved, setHasSaved] = useState<boolean>(true);

  useEffect(() => {
    if (taskId && successTrajNames.length == 0 && failedTrajNames.length == 0) {
      api.task.getTaskInfo(taskId).then(({ detail }) => {
        let { id, success, failed } = detail as TaskDetail;
        setSuccessTrajNames(success);
        setFailedTrajNames(failed);
        setMatchingStatus(MatchingStatus.working);
        setTask(id);
      });
    }
  }, [taskId]);

  /**
   * Pop alert if files has not been saved before closing the window
   * @see {@link https://developer.mozilla.org/zh-CN/docs/Web/API/Window/beforeunload_event}
   */
  const handleWindowBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (!hasSaved) {
        e.preventDefault();
        return (e.returnValue = 'Unsaved changes, Are you sure to exit?');
      }
    },
    [hasSaved]
  );

  useEffect(() => {
    log.info('Add handleWindowBeforeUnload');
    window.addEventListener('beforeunload', handleWindowBeforeUnload);
    return () => {
      log.info('Remove handleWindowBeforeUnload');
      window.removeEventListener('beforeunload', handleWindowBeforeUnload);
    };
  }, [handleWindowBeforeUnload]);

  const matchingConfig: AxiosRequestConfig = {
    headers: { 'Content-Type': 'multipart/form-data' },
    withCredentials: true,
    onUploadProgress: (progress) => {
      setMatchingStatus(MatchingStatus.uploading);
      let percentProgress = (progress.loaded / progress.total) * 100;
      if (percentProgress === 100) {
        setMatchingStatus(MatchingStatus.waiting);
        setProgress(0);
      } else {
        setProgress(percentProgress);
      }
    },
    onDownloadProgress: (progress) => {
      setMatchingStatus(MatchingStatus.downloading);
      setProgress((progress.loaded / progress.total) * 100);
    },
  };

  /**
   * React dropzone handler
   * @see {@link https://react-dropzone.js.org/#section-previews}
   */
  const { getRootProps, getInputProps } = useDropzone({
    accept: 'text/*',
    onDrop: (acceptedFiles, fileRejections) => {
      setMatchingStatus(MatchingStatus.uploading);
      if (fileRejections.length > 0) {
        toast('Only text will be accepted', { id: 'dropZone' });
      }
      if (acceptedFiles.length > 0) {
        let formData = new FormData();
        acceptedFiles.map((acceptedFile) => formData.append('files', acceptedFile));
        api.matching
          .mapMatching(formData, matchingConfig)
          .then(({ detail }) => {
            let { task_id, matching_result } = detail as MatchingDetail;
            toast(`Matching task ${task_id} is submitted`, { id: 'dropZone' });
            setTask(task_id);
            setSuccessTrajNames(matching_result.success.map((result) => result.name));
            setFailedTrajNames(matching_result.failed.map((result) => result.name));
            setMatchingStatus(MatchingStatus.working);
            setHasSaved(false);
            navigate(`/home/${task_id}`);
          })
          .catch(() => {
            setMatchingStatus(MatchingStatus.idling);
          });
      }
    },
  });

  return (
    <div className="bg-gray-100 dark:bg-slate-800 w-screen min-h-screen">
      <div className="navbar bg-base-100 dark:bg-slate-700 mb-6 shadow-md">
        <div className="navbar-start">
          <a className="btn btn-ghost normal-case text-xl dark:text-white">{t('app.name')}</a>
        </div>
        <div className="navbar-end">
          <button
            className="btn btn-ghost btn-circle dark:text-gray-400"
            onClick={switchLocaleMode}
          >
            <Language />
          </button>
          <button className="btn btn-ghost btn-circle dark:text-gray-400" onClick={toggleTheme}>
            <Moon />
          </button>
        </div>
      </div>
      <div className="m-0 px-6 pt-2">
        <div className="grid grid-cols-5 grid-flow-row gap-6">
          <div
            {...getRootProps({
              className: 'card col-span-5 bg-base-100 shadow-md dark:bg-slate-700',
            })}
          >
            <input {...getInputProps()} />
            <div className="card-body">
              <div className="card-body flex items-center justify-center border-dashed border-4 border-slate-200 dark:border-slate-500">
                <div className="dark:text-white text-2xl font-semibold text-center">
                  {t('upload.tips')}
                </div>
                <div className="dark:text-white">{t('upload.subtips')}</div>
              </div>
            </div>
          </div>
          {matchingStatus === MatchingStatus.working &&
            successTrajNames.map((successTrajName) => (
              <div key={successTrajName} className="card bg-base-100 shadow-md dark:bg-slate-700">
                <div className="card-body m-0 p-4">
                  <div className="card-actions justify-between">
                    <h3 className="dark:text-white text-lg font-semibold">{successTrajName}</h3>
                    <Link
                      to={`/map/${task}/${successTrajName}`}
                      target="_blank"
                      style={{ textDecoration: 'none' }}
                    >
                      <button className="btn btn-sm btn-info">{t('button.preview')}</button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          {matchingStatus === MatchingStatus.working &&
            failedTrajNames.map((failedTrajName) => (
              <div key={failedTrajName} className="card bg-base-100 shadow-md dark:bg-slate-700">
                <div className="card-body m-0 p-4">
                  <div className="card-actions justify-between">
                    <h3 className="dark:text-white text-lg font-semibold">{failedTrajName}</h3>
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => toast(`${failedTrajName}`, { id: 'failed' })}
                    >
                      {t('button.failed')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
