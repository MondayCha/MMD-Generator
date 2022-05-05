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
      <div className="mdc-card-body mb-4 grid grid-cols-3 gap-y-3 px-4 text-sm">
        <p className="col-span-2">文件名</p>
        <p className="font-mono">{fileName}</p>
        <p className="col-span-2">原始坐标数</p>
        <p className="font-mono">{gpsCount}</p>
        <p className="col-span-2">预标注方法</p>
        <p className="font-mono">{methodCount}</p>
        <p className="col-span-2">待复核区域</p>
        <p className="font-mono">{uncheckedCount}</p>
      </div>
    </>
  );
};

export default AreaInfoCard;
