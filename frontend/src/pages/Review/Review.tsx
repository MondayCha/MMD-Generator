/*
 * @Author: MondayCha
 * @Date: 2022-04-30 22:01:14
 * @Description: Map-Matching result annotation
 */
import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// Project
import { api } from '@services/api';
import log from '@middleware/logger';
import { AreaState, getMismatchedAreas } from '@utils/trajectory';
// Deck.gl
import { StaticMap, MapContext } from 'react-map-gl';
import DeckGL, { PathLayer, PolygonLayer, FlyToInterpolator, TripsLayer } from 'deck.gl';
import { PathStyleExtension } from '@deck.gl/extensions';
import { WebMercatorViewport } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
// Nebula.gl
import { EditableGeoJsonLayer, DrawRectangleMode, ModifyMode } from 'nebula.gl';
// Asserts
import {
  Refresh,
  Vector,
  MapSearch,
  Map2,
  Map,
  Route,
  HandMove,
  ArrowsMaximize,
  Eraser,
  SquarePlus,
  Square1,
  Square3,
  Square2,
  SquareCheck,
} from 'tabler-icons-react';
import { debounce } from 'lodash';
import { PreprocessAreas, pre_annotate } from '@wasm/pre-annotation/package';
// Types
import type {
  CoordinateDetail,
  MatchingResultDetail,
  ReviewDetail,
  TaskDetail,
} from '@services/type';
import type { MismatchedArea, BoundPolygon } from '@utils/trajectory';
import type { ViewStateProps } from '@deck.gl/core/lib/deck';
import type { Position2D } from 'deck.gl';
import toast from 'react-hot-toast';
import { useThemeContext } from '@/components/theme';
import useLocalStorage from '@/hooks/useLocalStorage';
import appConfig from '@/config/app.config';
import AnimationConfigCard from '@/pages/Annotation/components/AnimationConfigCard';

interface PathData {
  id: number;
  path: Position2D[];
}

interface WayPoint {
  coordinates: Position2D;
  timestamp: number;
}

interface TPathData {
  name: string | number;
  path: WayPoint[];
  time: { start: number; end: number };
}

interface MethodAnalysis {
  mismatched_area_count: number;
  mismatched_point_count: number;
  total_point_count: number;
}

/**
 * hex color to rgba
 * @param {string} hexColor - hex color like #ffffff
 * @returns {[number, number, number, number]} rgba color like rgba(255, 255, 255, 1)
 */
const hex2rgba = (hexColor: string): any => {
  return hexColor.match(/[0-9a-f]{2}/g)?.map((x) => parseInt(x, 16));
};

const traj2path = (traj: CoordinateDetail[]): Position2D[] =>
  traj.map((point) => [point.longitude, point.latitude]);

const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW_STATE: ViewStateProps = {
  latitude: 39.976919404646445,
  longitude: 116.31402279393426,
  zoom: 13,
  pitch: 0,
  transitionInterpolator: new FlyToInterpolator(),
  transitionDuration: '500',
};

const enum TrajIndex {
  RAW = -2,
  MATCHED = -1,
}

export default function Annotation() {
  const { annotationHashid } = useParams();
  const { themeMode } = useThemeContext();
  const navigate = useNavigate();

  // Map State
  const [initViewState, setInitViewState] = useState<ViewStateProps>(INITIAL_VIEW_STATE);
  const [viewState, setViewState] = useState<ViewStateProps>({
    ...INITIAL_VIEW_STATE,
    bearing: 30,
    pitch: 50,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Matching Data
  const [rawTraj, setRawTraj] = useState<TPathData[]>([]);
  const [matchedPath, setMatchedPath] = useState<PathData[]>([]);
  const [paths, setPaths] = useState<PathData[]>([]);

  // Annotation State
  const [isLoading, setIsLoading] = useState(true);
  const [speed, setSpeed] = useLocalStorage<number>(appConfig.local_storage.animation.speed, 80);
  const [length, setLength] = useLocalStorage<number>(
    appConfig.local_storage.animation.length,
    180
  );
  const [showTrajIndex, setShowTrajIndex] = useState<number>(-1);

  // Animation
  const [time, setTime] = useState<number>(0);
  const [animation] = useState({});

  const animate = () => {
    //@ts-ignore
    setTime((t) => (t + 0.0001 * speed) % 1.05);
    //@ts-ignore
    animation.id = window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (showTrajIndex) {
      log.info('window requestAnimationFrame');
      //@ts-ignore
      animation.id = window.requestAnimationFrame(animate);
    }
    //@ts-ignore
    return () => window.cancelAnimationFrame(animation.id);
  }, [animation, showTrajIndex, speed]);

  // Right Panel
  const [comment, setComment] = useState<string>('');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [message, setMessage] = useState({
    annotator: '',
    groupHashid: '',
    dataName: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [trajText, setTrajText] = useState<string>('');

  useEffect(() => {
    annotationHashid &&
      api.annotate.getAnnotation(annotationHashid).then(({ detail }) => {
        const { raw_traj, trajectory, comment, group_hashid, data_name, bounds, annotator } =
          detail as ReviewDetail;
        comment && setComment(comment);
        setMessage({
          annotator: annotator,
          groupHashid: group_hashid,
          dataName: data_name,
        });
        setMatchedPath([
          {
            id: 0,
            path: traj2path(trajectory),
          },
        ]);
        setRawTraj([
          {
            name: data_name,
            path: raw_traj.map((point) => {
              return {
                coordinates: [point.longitude, point.latitude],
                timestamp: point.timestamp,
              };
            }),
            time: {
              start: raw_traj[0]?.timestamp,
              end: raw_traj[raw_traj.length - 1]?.timestamp,
            },
          },
        ]);
        let view = new WebMercatorViewport({
          width: mapContainerRef.current?.clientWidth ?? window.innerWidth,
          height: mapContainerRef.current?.clientHeight ?? window.innerHeight,
        });
        log.info('[Fit Bounds] start', bounds);
        let { longitude, latitude, zoom } = view.fitBounds(bounds, {
          padding: 100,
        });
        log.info('[Fit Bounds] end', bounds, { longitude, latitude, zoom });
        let newViewState = {
          ...INITIAL_VIEW_STATE,
          longitude,
          latitude,
          zoom,
        };
        setViewState(newViewState);
        setInitViewState(newViewState);
        setIsLoading(false);
      });
  }, [annotationHashid]);

  const rawTrajLayers = useMemo(() => {
    if (rawTraj.length === 0) {
      return [];
    }
    const timeLength = rawTraj[0].time.end - rawTraj[0].time.start;
    return [
      new PathLayer({
        id: 'raw-traj',
        data: rawTraj,
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 6,
        getPath: (d) => d.path.map((p) => p.coordinates),
        getColor: themeMode === 'dark' ? [250, 166, 26, 50] : [250, 166, 26, 150],
        // autoHighlight: true,
        // highlightColor: [250, 166, 26, 255],
        visible: showTrajIndex === TrajIndex.RAW,
      }),
      new TripsLayer({
        id: 'trips-raw-layer',
        data: rawTraj,
        getPath: (d) => d.path.map((p) => p.coordinates),
        // deduct start timestamp from each data point to avoid overflow
        getTimestamps: (d) => d.path.map((p) => p.timestamp - d.time.start),
        getColor: [250, 166, 26],
        opacity: 0.9,
        widthMinPixels: 8,
        jointRounded: true,
        capRounded: true,
        trailLength: length,
        currentTime: time * timeLength,
        visible: showTrajIndex === TrajIndex.RAW,
      }),
    ];
  }, [showTrajIndex, rawTraj, time, length, themeMode]);

  const layers = useMemo(() => {
    return [
      new PathLayer({
        id: 'common-traj',
        data: matchedPath,
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 4,
        getPath: (d) => d.path,
        getColor: [0, 174, 239, 200],
        onClick: (o, e) => log.info('click common-trajs ', o.coordinate),
        visible: showTrajIndex === TrajIndex.MATCHED,
      }),
      new PathLayer({
        id: 'compare-traj',
        data: paths.filter((_, index) => index === showTrajIndex),
        widthUnits: 'pixels',
        getWidth: 4,
        getPath: (d) => d.path,
        getColor: [244, 63, 94, 200],
        visible: true,
      }),
    ];
  }, [showTrajIndex, matchedPath, paths]);

  const handleSubmit = (accept: boolean) => {
    if (annotationHashid) {
      if (accept) {
        api.annotate.reviewAnnotation(annotationHashid, 1, reviewComment).then(() => {
          toast.success('Accepted');
          navigate(`/admin/review`);
        });
      } else {
        api.annotate.reviewAnnotation(annotationHashid, 0, reviewComment).then(() => {
          toast.success('Rejected');
          navigate(`/admin/review`);
        });
      }
    }
  };

  const handleResetAll = () => {
    setViewState(initViewState);
    setSpeed(80);
    setLength(160);
  };

  const handleAddCompareTraj = () => {
    const path: PathData = {
      id: paths.length,
      path: trajText
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [longitude, latitude] = line.split(' ');
          return [Number(longitude), Number(latitude)];
        }),
    };
    setPaths((prevPaths) => [...prevPaths, path]);
    log.info('add compare traj', path);
    setTrajText('');
    setShowModal(false);
  };

  return (
    <div className="absolute h-full w-full bg-white dark:bg-[#1e2433]">
      <div className="absolute left-14 right-0 flex h-8 flex-row items-center justify-start">
        <p className="select-none text-center font-black tracking-tight text-primary dark:text-slate-600">
          Map-Matching Dataset Generator
        </p>
      </div>
      <div
        className="absolute top-8 left-14 bottom-8 right-52 overflow-hidden rounded-2xl border-2  dark:border-0 dark:shadow-inner lg:bottom-6"
        ref={mapContainerRef}
      >
        <div
          className={`absolute top-0 left-0 right-0 -bottom-8 transition duration-500 lg:-bottom-6 ${
            isLoading ? 'blur-xl' : ''
          }`}
        >
          <DeckGL
            layers={[...rawTrajLayers, ...layers]}
            ContextProvider={MapContext.Provider}
            viewState={viewState}
            onViewStateChange={(v) => setViewState(v.viewState)}
            controller={{
              doubleClickZoom: false,
            }}
          >
            <StaticMap
              mapStyle={themeMode === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
              preventStyleDiffing={true}
              className="dark:brightness-150"
            />
          </DeckGL>
        </div>
      </div>
      <div className="absolute top-8 left-0 bottom-8 flex w-14 flex-col items-center justify-between px-3 lg:bottom-6">
        <div className="flex flex-col items-center justify-center">
          <div className="mx-3 flex flex-col space-y-6 border-b-2 border-slate-600 border-opacity-25  py-6">
            <button
              className={`mdc-btn-toolbar ${showTrajIndex === TrajIndex.RAW && 'text-primary'}`}
              onClick={() => {
                setShowTrajIndex(TrajIndex.RAW);
              }}
            >
              <Map2 size={28} />
              <p className="select-none text-xs">
                原始
                <br />
                轨迹
              </p>
            </button>
            <button
              className={`mdc-btn-toolbar ${showTrajIndex === TrajIndex.MATCHED && 'text-primary'}`}
              onClick={() => {
                setShowTrajIndex(TrajIndex.MATCHED);
              }}
            >
              <MapSearch size={28} />
              <p className="select-none text-xs">
                预检
                <br />
                结果
              </p>
            </button>
          </div>
          <div className="mx-3 flex flex-col space-y-6 py-6">
            {paths.map((_, index) => (
              <button
                className={`mdc-btn-toolbar ${index === showTrajIndex && 'text-primary'}`}
                key={`choice-${index}`}
                onClick={() => {
                  setShowTrajIndex(index);
                }}
              >
                {index === 0 ? (
                  <Square1 size={28} />
                ) : index === 1 ? (
                  <Square2 size={28} />
                ) : (
                  <Square3 size={28} />
                )}
                <p className="text-xs">对照</p>
              </button>
            ))}
            {paths.length < 3 && (
              <button className="mdc-btn-toolbar" onClick={() => setShowModal(true)}>
                <SquarePlus size={28} />
                <p className="text-xs">
                  添加
                  <br />
                  对照
                </p>
              </button>
            )}
          </div>
        </div>
        <div className="mx-3 flex flex-col space-y-6 border-t-2 border-slate-600  border-opacity-25 py-6">
          <button className="mdc-btn-toolbar" onClick={() => setViewState(initViewState)}>
            <ArrowsMaximize size={28} />
            <p className="text-xs">
              视图
              <br />
              复位
            </p>
          </button>
          <button className="mdc-btn-toolbar" onClick={handleResetAll}>
            <Refresh size={28} />
            <p className="text-xs">
              恢复
              <br />
              默认
            </p>
          </button>
        </div>
      </div>
      <p className="absolute bottom-0 left-14 flex h-8 items-center justify-end text-sm italic text-slate-500 lg:h-6">
        ©
        <a
          href="https://carto.com/about-carto/"
          target="_blank"
          rel="noreferrer"
          className=" text-gray-500"
        >
          CARTO
        </a>
        , ©
        <a
          href="http://www.openstreetmap.org/about/"
          target="_blank"
          className="mr-1 text-gray-500"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        contributors
      </p>
      <div className="absolute right-0 top-8 bottom-8 flex w-52 flex-col items-stretch justify-between px-3 lg:bottom-6">
        <div className="flex flex-col">
          <div className="mdc-card-header mb-1.5">标注信息</div>
          <div className="mdc-card-body w-full flex-col space-y-3 text-sm">
            <div className="flex flex-row items-center justify-between px-1">
              <p className="col-span-2">文件名</p>
              <p className="font-mono">{message.dataName?.split('.')[0]}</p>
            </div>
            <div className="flex flex-row items-center justify-between px-1">
              <p className="col-span-2">标注者</p>
              <p className="">{message.annotator}</p>
            </div>
            <div className="textarea flex w-full grow resize-none break-all border-2 border-gray-200 bg-white dark:border-0 dark:bg-[#1e2433] dark:shadow-inner">
              {comment.length > 0 ? comment : '暂无备注'}
            </div>
          </div>
          <AnimationConfigCard />
        </div>
        <div className="flex grow flex-col">
          <div className="mdc-card-header mb-1.5 mt-4">质量管控</div>
          <div className="mdc-card-body h-full flex-col space-y-3">
            <textarea
              className="textarea flex w-full grow resize-none border-2 border-gray-200 bg-white dark:border-0 dark:bg-[#1e2433] dark:shadow-inner"
              value={reviewComment}
              placeholder="反馈遇到的问题"
              onChange={(e) => setReviewComment(e.target.value)}
            />
            <button
              className="mt-1.5 flex h-16 w-full flex-row items-center justify-center rounded-lg bg-secondary pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
              onClick={() => handleSubmit(false)}
            >
              <p className="text-2xl font-extrabold dark:opacity-70">拒绝标注</p>
            </button>
            <button
              className="mt-1.5 flex h-16 flex-row items-center justify-center rounded-lg bg-primary pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
              onClick={() => handleSubmit(true)}
            >
              <p className="text-2xl font-extrabold dark:opacity-70">接受标注</p>
            </button>
          </div>
        </div>
      </div>
      {showModal && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden outline-none focus:outline-none ">
            <div className="relative my-6 mx-auto w-auto max-w-3xl">
              <div className="mdc-card-body flex flex-col items-stretch justify-between space-y-3 p-4">
                <h3 className="mdc-card-header ml-0 pl-0 text-xl">添加对照</h3>
                <textarea
                  className="textarea flex h-60 w-96 grow border-2 border-gray-200 bg-white dark:border-0 dark:bg-[#1e2433] dark:shadow-inner"
                  value={trajText}
                  placeholder="每行格式：经度 纬度"
                  onChange={(e) => setTrajText(e.target.value)}
                />
                <div className="flex flex-row items-center justify-end space-x-2 pt-1">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowModal(false);
                    }}
                  >
                    取消
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleAddCompareTraj}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed inset-0 z-40 bg-black opacity-10"></div>
        </>
      )}
    </div>
  );
}
