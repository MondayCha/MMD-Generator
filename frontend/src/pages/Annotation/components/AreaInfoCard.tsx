import appConfig from '@/config/app.config';
import useLocalStorage from '@/hooks/useLocalStorage';

interface AreaInfoCardProps {
  fileName: string | undefined;
  gpsCount: number | undefined;
  methodCount: number | undefined;
  uncheckedCount: number | undefined;
}

const AreaInfoCard = (props: AreaInfoCardProps) => {
  const { fileName, gpsCount, methodCount, uncheckedCount } = props;

  return (
    <>
      <div className="mdc-card-header mb-1.5 mt-4">区域信息</div>
      <div className="mdc-card-body mb-4 flex-col space-y-3 px-4 text-sm">
        <div className="flex flex-row items-center justify-between">
          <p className="col-span-2">文件名</p>
          <p className="font-mono">{fileName?.split('.')[0]}</p>
        </div>
        <div className="flex flex-row items-center justify-between">
          <p className="col-span-2">原始坐标数</p>
          <p className="font-mono">{gpsCount}</p>
        </div>
        <div className="flex flex-row items-center justify-between">
          <p className="col-span-2">预标注方法</p>
          <p className="font-mono">{methodCount}</p>
        </div>
        <div className="flex flex-row items-center justify-between">
          <p className="col-span-2">待复核区域</p>
          <p className="font-mono">{uncheckedCount}</p>
        </div>
      </div>
    </>
  );
};

export default AreaInfoCard;
