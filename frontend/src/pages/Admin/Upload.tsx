/*
 * @Author: MondayCha
 * @Date: 2022-04-30 22:19:12
 * @Description: Upload GPS data to server
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams, useNavigate } from 'react-router-dom';
import useFlooksStore from '@hooks/useFlooksStore';
import { useDropzone } from 'react-dropzone';
import { api } from '@services/api';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@components/theme';
import { Language, Moon } from 'tabler-icons-react';
import toast from 'react-hot-toast';
import log from '@middleware/logger';
// Types
import type { GroupDetail } from '@services/type';
import type { AxiosRequestConfig } from 'axios';

enum MatchingStatus {
  idling,
  uploading,
  waiting,
  downloading,
  working,
}

const Upload = () => {
  // hooks (theme, i18n)
  const { t } = useTranslation();
  const { groupHashid } = useParams();
  const navigate = useNavigate();
  const { switchLocaleMode } = useFlooksStore();
  const { toggleTheme } = useThemeContext();
  // home page state
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>(MatchingStatus.idling);
  const [task, setTask] = useState<string>('');
  const [successTrajNames, setSuccessTrajNames] = useState<string[]>([]);
  const [failedTrajNames, setFailedTrajNames] = useState<string[]>([]);
  const [hasSaved, setHasSaved] = useState<boolean>(true);

  useEffect(() => {
    if (groupHashid && successTrajNames.length == 0 && failedTrajNames.length == 0) {
      api.group.getDataGroup(groupHashid).then(({ detail }) => {
        let { group_id: task_id, matching_result } = detail as GroupDetail;
        setSuccessTrajNames(matching_result.success);
        setFailedTrajNames(matching_result.failed);
        setMatchingStatus(MatchingStatus.working);
        setTask(task_id);
      });
    }
  }, [groupHashid]);

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
      }
    },
    onDownloadProgress: () => {
      setMatchingStatus(MatchingStatus.downloading);
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
        toast('Only text/* will be accepted', { id: 'dropZone' });
      }
      if (acceptedFiles.length > 0) {
        let formData = new FormData();
        acceptedFiles.map((acceptedFile) => formData.append('files', acceptedFile));
        api.group
          .uploadDataGroup(formData, matchingConfig)
          .then(({ detail }) => {
            let { group_id: task_id, matching_result } = detail as GroupDetail;
            toast(`Matching task ${task_id} is submitted`, { id: 'dropZone' });
            setTask(task_id);
            setSuccessTrajNames(matching_result.success);
            setFailedTrajNames(matching_result.failed);
            setMatchingStatus(MatchingStatus.working);
            setHasSaved(false);
            navigate(`/admin/upload/${task_id}`);
          })
          .catch(() => {
            setMatchingStatus(MatchingStatus.idling);
          });
      }
    },
  });

  return (
    <div className="max-w-screen min-h-screen bg-blue-100 dark:bg-slate-800">
      <div className="navbar mb-6 bg-base-100 px-6 shadow-md dark:bg-slate-700 lg:px-36">
        <div className="navbar-start">
          <a className="text-2xl font-extrabold normal-case text-slate-600 dark:text-white">
            {t('app.name')}
          </a>
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
      <div className="m-0 px-6 pt-2 pb-6 lg:px-36">
        <div className="grid grid-flow-row grid-cols-4 gap-6">
          <div className="card col-span-4 h-64 bg-base-100 shadow-md dark:bg-slate-700">
            {matchingStatus === MatchingStatus.idling ||
            matchingStatus === MatchingStatus.working ? (
              <div
                {...getRootProps({
                  className: 'card-body',
                })}
              >
                <input {...getInputProps()} />
                <div className="card-body flex items-center justify-center border-4 border-dashed border-slate-200 dark:border-slate-500">
                  <div className="text-center text-2xl font-semibold dark:text-white">
                    {t('upload.tips')}
                  </div>
                  <div className="dark:text-white">{t('upload.subtips')}</div>
                </div>
              </div>
            ) : (
              <div className="card-body">
                <div className="card-body flex items-center justify-center border-4 border-dashed border-gray-200 dark:border-slate-500">
                  <svg
                    className="my-2 h-16 w-16 animate-[spin_1.5s_linear_infinite] text-gray-500 dark:text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-10"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <p className="text-xl font-bold text-gray-400 dark:text-slate-400">
                    {matchingStatus === MatchingStatus.uploading
                      ? 'Uploading'
                      : matchingStatus === MatchingStatus.waiting
                      ? 'Waiting Server'
                      : 'Downloading'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {matchingStatus === MatchingStatus.working &&
            successTrajNames.map((successTrajName) => (
              <div key={successTrajName} className="card bg-base-100 shadow-md dark:bg-slate-700">
                <div className="card-body m-0 p-4">
                  <div className="card-actions justify-between">
                    <h3 className="text-lg font-semibold dark:text-white">{successTrajName}</h3>
                    <Link
                      to={`/annotations/${task}/${successTrajName}`}
                      target="_blank"
                      style={{ textDecoration: 'none' }}
                    >
                      <button className="btn btn-info btn-sm">{t('button.preview')}</button>
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
                    <h3 className="text-lg font-semibold dark:text-white">{failedTrajName}</h3>
                    <button
                      className="btn btn-error btn-sm"
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
};

export default Upload;
