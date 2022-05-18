import appConfig from '@/config/app.config';
import useLocalStorage from '@/hooks/useLocalStorage';

interface PreAnnotationCardProps {
  isEditing: boolean;
  sampleInterval: number;
  setSampleInterval: (sampleInterval: number) => void;
  onChange1: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PreAnnotationCard = (props: PreAnnotationCardProps) => {
  const { onChange1, isEditing, sampleInterval, setSampleInterval } = props;
  const [autoMergeCircle] = useLocalStorage<boolean>(
    appConfig.local_storage.pre_annotation.auto_merge_circle,
    true
  );

  return (
    <>
      <div className="mdc-card-header mb-1.5">标注设置</div>
      <div className="mdc-card-body flex-row items-center justify-between px-4">
        {isEditing ? (
          <>
            <p className="text-sm">采样间隔</p>
            <input
              type="number"
              className="input input-bordered input-xs w-16 max-w-xs font-mono"
              value={sampleInterval}
              min={1}
              max={100000}
              onChange={(e) => {
                setSampleInterval(Math.max(Number(e.target.value), 1));
              }}
            />
          </>
        ) : (
          <>
            <p className="text-sm">Merge U-turns</p>
            <input
              type="checkbox"
              className={`toggle toggle-xs border-slate-300 ${
                autoMergeCircle ? 'bg-primary dark:bg-slate-400' : 'bg-slate-300 dark:bg-slate-600'
              } dark:border-slate-600`}
              checked={autoMergeCircle}
              onChange={onChange1}
            />
          </>
        )}
      </div>
    </>
  );
};

export default PreAnnotationCard;
