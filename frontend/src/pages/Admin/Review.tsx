import { useEffect, useState } from 'react';
import { api } from '@services/api';
import toast from 'react-hot-toast';
import log from '@middleware/logger';
import { useNavigate } from 'react-router-dom';
import NavigationBar from '@/components/basic/NavigationBar';
import { AnnotationDetail } from '@/services/type';

function Review() {
  const navigate = useNavigate();
  const [annotations, setAnnotations] = useState<AnnotationDetail[]>([]);

  useEffect(() => {
    api.annotate.getAnnotations().then(({ detail }) => {
      setAnnotations(detail as AnnotationDetail[]);
    });
  }, []);

  return (
    <div className="max-w-screen min-h-screen bg-slate-50 dark:bg-slate-800">
      <NavigationBar />
      <div className="m-0 grid grid-flow-row grid-cols-4 flex-col gap-6 px-6 py-6 lg:px-36">
        {annotations
          .sort((a, b) => a.data_name.localeCompare(b.data_name))
          .map((annotation) => (
            <div
              key={`${annotation.hashid}`}
              className="card border-2 bg-white dark:border-0 dark:bg-slate-700 dark:shadow-md"
            >
              <div className="card-body m-0 p-4">
                <div className="card-actions justify-between">
                  <h3 className="text-lg font-semibold dark:text-white">{annotation.data_name}</h3>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/reviews/${annotation.hashid}`)}
                  >
                    检查
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default Review;
