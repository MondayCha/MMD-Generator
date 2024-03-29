import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFlooksStore from '@hooks/useFlooksStore';
import { api } from '@services/api';
import log from '@middleware/logger';
import NavigationBar from '@/components/basic/NavigationBar';
import { TaskDetail } from '@/services/type';

function Home() {
  // hooks (theme, i18n)
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskDetail[]>([]);

  useEffect(() => {
    api.task.getTasks(1).then(({ detail }) => {
      const tasks = detail as TaskDetail[];
      setTasks(tasks);
    });
  }, []);

  return (
    <div className="max-w-screen min-h-screen bg-slate-50 dark:bg-slate-800">
      <NavigationBar />
      <div className="m-0 grid grid-flow-row grid-cols-4 flex-col gap-6 px-6 py-6 lg:px-36">
        {tasks
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((task) => (
            <div
              key={`${task.name}${task.hashid}`}
              className="card border-2 bg-white dark:border-0 dark:bg-slate-700 dark:shadow-md"
            >
              <div className="card-body m-0 p-4">
                <div className="card-actions justify-between">
                  <h3 className="text-lg font-semibold dark:text-white">{task.name}</h3>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/annotations/${task.hashid}/${task.name}`)}
                  >
                    标注
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default Home;
