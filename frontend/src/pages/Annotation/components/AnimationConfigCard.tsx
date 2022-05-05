import appConfig from '@/config/app.config';
import useLocalStorage from '@/hooks/useLocalStorage';

const AnimationConfigCard = () => {
  const [speed, setSpeed] = useLocalStorage<number>(appConfig.local_storage.animation.speed, 80);
  const [length, setLength] = useLocalStorage<number>(
    appConfig.local_storage.animation.length,
    180
  );

  return (
    <>
      <div className="mdc-card-header mb-1.5 mt-4">界面设置</div>
      <div className="mdc-card-body flex-col space-y-3 px-4">
        <div className="flex flex-row items-center justify-between space-x-1">
          <p className="text-sm">动画速度</p>
          <input
            type="number"
            className="input input-bordered input-xs w-16 max-w-xs pr-2 font-mono"
            value={speed}
            max={160}
            min={0}
            onChange={(e) => {
              setSpeed(Math.min(Math.max(Number(e.target.value), 0), 160));
            }}
          />
        </div>
        <div className="flex flex-row items-center justify-between space-x-1">
          <p className="text-sm">拖影长度</p>
          <input
            type="number"
            className="input input-bordered input-xs w-16 max-w-xs font-mono"
            value={length}
            max={500}
            min={0}
            onChange={(e) => {
              setLength(Math.min(Math.max(Number(e.target.value), 0), 500));
            }}
          />
        </div>
      </div>
    </>
  );
};

export default AnimationConfigCard;
