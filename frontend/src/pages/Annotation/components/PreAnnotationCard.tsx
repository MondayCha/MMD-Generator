import appConfig from '@/config/app.config';
import useLocalStorage from '@/hooks/useLocalStorage';

interface PreAnnotationCardProps {
  onChange1: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PreAnnotationCard = (props: PreAnnotationCardProps) => {
  const { onChange1 } = props;
  const [autoMergeCircle, setAutoMergeCircle] = useLocalStorage<boolean>(
    appConfig.local_storage.pre_annotation.auto_merge_circle,
    true
  );

  return (
    <>
      <div className="mdc-card-header mb-1.5">标注设置</div>
      <div className="mdc-card-body flex-row items-center justify-between px-4">
        <p className="text-sm">Merge U-turns</p>
        <input
          type="checkbox"
          className={`toggle toggle-xs border-slate-300 ${
            autoMergeCircle ? 'bg-primary dark:bg-slate-400' : 'bg-slate-300 dark:bg-slate-600'
          } dark:border-slate-600`}
          checked={autoMergeCircle}
          onChange={onChange1}
        />
      </div>
    </>
  );
};

export default PreAnnotationCard;
