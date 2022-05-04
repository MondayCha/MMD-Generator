/*
 * @Author: MondayCha
 * @Date: 2022-04-30 22:01:14
 * @Description: Map-Matching result annotation
 */
import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { useParams } from 'react-router-dom';
// Project
import { api } from '@services/api';
import log from '@middleware/logger';
import { AreaState, getMismatchedAreas } from '@utils/trajectory';
// Deck.gl
import { StaticMap, MapContext, NavigationControl } from 'react-map-gl';
import DeckGL, { PathLayer, PolygonLayer, FlyToInterpolator, TripsLayer } from 'deck.gl';
import { PathStyleExtension } from '@deck.gl/extensions';
import { WebMercatorViewport } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
// Nebula.gl
import { EditableGeoJsonLayer, DrawLineStringMode, DrawPolygonMode } from 'nebula.gl';
// Asserts
import {
  Refresh,
  Vector,
  MapSearch,
  Map2,
  Route,
  HandMove,
  ArrowsMaximize,
  Eraser,
  ChartArrowsVertical,
  Square0,
  Square1,
  Square3,
  Square2,
  SquareCheck,
} from 'tabler-icons-react';
import { debounce } from 'lodash';
import { PreprocessAreas, pre_annotate } from '@wasm/pre-annotation/package';
// Types
import type {
  TrajectoryDetail,
  CoordinateDetail,
  MatchingResultDetail,
  TCoordinateDetail,
} from '@services/type';
import type { MismatchedArea, OptionalTraj, BoundPolygon } from '@utils/trajectory';
import type { ViewStateProps } from '@deck.gl/core/lib/deck';
import type { Position2D } from 'deck.gl';
import toast from 'react-hot-toast';
import { useThemeContext } from '@/components/theme';
import useLocalStorage from '@/hooks/useLocalStorage';
import appConfig from '@/config/app.config';

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

interface AnnotationState {
  showRawTraj: boolean;
  isAnnotating: boolean;
  showDrawPolygonLayer: boolean;
}

const initailAnnotationState: AnnotationState = {
  showRawTraj: true,
  isAnnotating: false,
  showDrawPolygonLayer: false,
};

type AnnotationStateAction =
  | { type: 'toggleRawTraj' }
  | { type: 'startAnnotating' }
  | { type: 'endAnnotating' }
  | { type: 'toggleDrawPolygonLayer' };

function annotationStateReducer(
  state: AnnotationState,
  action: AnnotationStateAction
): AnnotationState {
  switch (action.type) {
    case 'toggleRawTraj':
      return { ...state, showRawTraj: !state.showRawTraj };
    case 'startAnnotating':
      return { showRawTraj: false, showDrawPolygonLayer: false, isAnnotating: true };
    case 'endAnnotating':
      return { ...state, isAnnotating: !state.isAnnotating };
    case 'toggleDrawPolygonLayer':
      return { ...state, showDrawPolygonLayer: !state.showDrawPolygonLayer };
    default:
      throw new Error();
  }
}

export default function Deck() {
  const { taskId, trajName } = useParams();
  const { themeMode } = useThemeContext();

  // Map State
  const [initViewState, setInitViewState] = useState<ViewStateProps>(INITIAL_VIEW_STATE);
  const [viewState, setViewState] = useState<ViewStateProps>({
    ...INITIAL_VIEW_STATE,
    bearing: 30,
    pitch: 50,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Nebula.gl State
  const [features, setFeatures] = useState({
    type: 'FeatureCollection',
    features: [],
  });
  const [selectedFeatureIndexes] = useState([]);
  const [mode, setMode] = useState(() => DrawPolygonMode);

  const editableLayer = new EditableGeoJsonLayer({
    // id: "geojson-layer",
    data: features,
    mode,
    selectedFeatureIndexes,

    onEdit: ({ updatedData }) => {
      setFeatures(updatedData);
    },
  });

  // Wasm Matching Data
  const [sdkResult, setSdkResult] = useState<MatchingResultDetail>();
  const [allAreas, setAllAreas] = useState<PreprocessAreas>();
  const [matchedPaths, setMatchedPaths] = useState<PathData[]>([]);
  const [mismatchedAreas, setMismatchedAreas] = useState<MismatchedArea[]>([]);
  const [rawTraj, setRawTraj] = useState<TPathData[]>([]);

  // Data During Annotating
  const [currentArea, setCurrentArea] = useState<MismatchedArea[]>([]);
  const [checkedAreas, setCheckedAreas] = useState<MismatchedArea[]>([]);

  // Annotation State
  const [isLoading, setIsLoading] = useState(true);
  const [{ showRawTraj, isAnnotating, showDrawPolygonLayer }, annotationDispatch] = useReducer(
    annotationStateReducer,
    initailAnnotationState
  );

  // Animation
  const [time, setTime] = useState<number>(0);
  const [animation] = useState({});

  const animate = () => {
    //@ts-ignore
    setTime((t) => (t + 0.005) % 1.05);
    //@ts-ignore
    animation.id = window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (showRawTraj) {
      log.info('window requestAnimationFrame');
      //@ts-ignore
      animation.id = window.requestAnimationFrame(animate);
    }
    //@ts-ignore
    return () => window.cancelAnimationFrame(animation.id);
  }, [animation, showRawTraj]);

  // Right Panel
  const [comment, setComment] = useState<string>('');
  const [autoMergeCircle, setAutoMergeCircle] = useLocalStorage<boolean>(
    appConfig.local_storage.pre_annotation.auto_merge_circle,
    true
  );

  const debounceCloseLoading = useMemo(
    () =>
      debounce(() => {
        setIsLoading(false);
        toast('预标注已完成，可以开始标注了', { id: 'close-loading' });
      }, 500),
    []
  );

  const preAnnotation = useCallback(
    (result: MatchingResultDetail, options?: boolean) => {
      if (result) {
        const { bounds, raw_traj, matching_result } = result;
        const wasmAreas = pre_annotate(matching_result, options ?? autoMergeCircle);
        setAllAreas(wasmAreas);
        log.info('[Pre Annotation]', wasmAreas);
        const areas_need_check = getMismatchedAreas(wasmAreas.mismatched_areas);
        setMatchedPaths([
          ...wasmAreas.matched_areas.map((p) => ({
            id: p.id,
            path: traj2path(p.sub_traj.traj),
          })),
          ...wasmAreas.prematched_areas.map((p) => ({
            id: p.id,
            path: traj2path(p.sub_traj.traj),
          })),
        ]);
        setRawTraj([
          {
            name: 'raw',
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
        // fit bounds for raw_traj and each area
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
          longitude: longitude,
          latitude: latitude,
          zoom: zoom,
          pitch: 0,
        };
        setViewState({ ...newViewState, bearing: 30, pitch: 50 });
        setInitViewState(newViewState);
        areas_need_check.forEach((area) => {
          let { longitude, latitude, zoom } = view.fitBounds(area.bounds, { padding: 100 });
          area.setBoundsInfo(longitude, latitude, zoom);
        });
        setMismatchedAreas(areas_need_check);
        debounceCloseLoading();
      } else {
      }
    },
    [sdkResult, debounceCloseLoading]
  );

  useEffect(() => {
    api.trajectory.getMatchingResult(taskId, trajName).then(({ detail }) => {
      setSdkResult(detail as MatchingResultDetail);
      preAnnotation(detail as MatchingResultDetail);
    });
  }, [taskId, trajName]);

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
        getColor: [250, 166, 26, 50],
        // autoHighlight: true,
        // highlightColor: [250, 166, 26, 255],
        visible: showRawTraj,
      }),
      new TripsLayer({
        id: 'trips-layer',
        data: rawTraj,
        getPath: (d) => d.path.map((p) => p.coordinates),
        // deduct start timestamp from each data point to avoid overflow
        getTimestamps: (d) => d.path.map((p) => p.timestamp - d.time.start),
        getColor: [250, 166, 26],
        opacity: 0.9,
        widthMinPixels: 8,
        jointRounded: true,
        capRounded: true,
        trailLength: 250,
        currentTime: time * timeLength,
        visible: showRawTraj,
      }),
    ];
  }, [showRawTraj, rawTraj, time]);

  const layers = useMemo(() => {
    return [
      ...rawTrajLayers,
      new PathLayer({
        id: 'common-trajs',
        data: matchedPaths,
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 4,
        getPath: (d) => d.path,
        getColor: [0, 174, 239, 200],
        onClick: (o, e) => log.info('click common-trajs ', o.coordinate),
        visible: !showRawTraj,
      }),
      ...mismatchedAreas.map((area) => {
        return new PathLayer({
          id: `unmatched-path-${area.id}`,
          data: area.optionalTrajs,
          pickable: true,
          widthUnits: 'pixels',
          getWidth: 4,
          getPath: (d) => d.trajectory,
          getColor: (d) => [...d.color, 200],
          onClick: (o, e) => log.info('click unmatchedAreas', o.coordinate),
          visible: !showRawTraj && !isAnnotating,
        });
      }),
      ...currentArea.map((area) => {
        return new PolygonLayer({
          id: `check-poly-${area.id}`,
          data: area.getAreaBackground(),
          pickable: true,
          stroked: true,
          filled: true,
          wireframe: true,
          visible: !showRawTraj && isAnnotating,
          //@ts-ignore
          getPolygon: (d) => d.vertexs,
          getFillColor: [0, 174, 239, 5],
          getLineColor: [0, 174, 239, 50],
          autoHighlight: true,
          highlightColor: [0, 174, 239, 20],
          widthUnits: 'pixels',
          getLineWidth: 3,
          getDashArray: [6, 4],
          dashJustified: true,
          dashGapPickable: true,
          extensions: [new PathStyleExtension({ dash: true })],
          onClick: (o) => {
            if (o.object) {
              let d = o.object as BoundPolygon;
              let { latitude, longitude, zoom } = d.boundInfo;
              setViewState({
                ...INITIAL_VIEW_STATE,
                longitude: longitude,
                latitude: latitude,
                zoom: zoom,
              });
            }
          },
        });
      }),
      ...currentArea.map((area) => {
        return new PathLayer({
          id: `check-path-${area.id}`,
          data: area.optionalTrajs,
          widthUnits: 'pixels',
          getWidth: 4,
          getPath: (d) => d.trajectory,
          getColor: (d) => [...d.color, 200],
          visible: !showRawTraj && isAnnotating,
        });
      }),
      ...checkedAreas
        .filter((area) => area.areaState === AreaState.Checked)
        .map((area) => {
          return new PathLayer({
            id: `check-traj-${area.id}`,
            data: [
              {
                name: area.getSelectedTraj().name,
                color: area.getSelectedTraj().color,
                path: area.getSelectedTraj().trajectory,
              },
            ],
            widthUnits: 'pixels',
            getWidth: 4,
            getPath: (d) => d.path,
            getColor: hex2rgba('#00aeef'),
            //@ts-ignore
            getDashArray: [6, 4],
            dashJustified: true,
            dashGapPickable: true,
            extensions: [new PathStyleExtension({ dash: true })],
            visible: !showRawTraj,
          });
        }),
    ];
  }, [isAnnotating, mismatchedAreas, currentArea, checkedAreas, rawTrajLayers, matchedPaths]);

  const showNextUncheckedArea = () => {
    annotationDispatch({ type: 'startAnnotating' });
    const nextUncheckedArea =
      mismatchedAreas.find((area) => area.areaState === AreaState.Unchecked) ??
      mismatchedAreas.find((area) => area.areaState === AreaState.Skipped);
    if (nextUncheckedArea) {
      log.info('[Next Unchecked Area]', nextUncheckedArea);
      setCurrentArea([nextUncheckedArea]);
      setViewState({
        ...INITIAL_VIEW_STATE,
        ...nextUncheckedArea.boundInfo,
      });
    } else {
      setCurrentArea([]);
      annotationDispatch({ type: 'endAnnotating' });
      setViewState(initViewState);
    }
  };

  const handleArea = useCallback(
    (type: string) => {
      log.info('handleAreaType', type);
      if (currentArea.length > 0) {
        let currentCheckingArea = currentArea[0];
        let newCheckTraj =
          type === 'skip' ? currentCheckingArea.selectTraj() : currentCheckingArea.selectTraj(type);
        if (newCheckTraj) {
          setMismatchedAreas((prev) => prev.filter((area) => area.id !== currentCheckingArea.id));
          setCheckedAreas((prev) => [...prev, currentCheckingArea]);
        }
      }
      showNextUncheckedArea();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAnnotating, mismatchedAreas]
  );

  const handleSubmit = () => {
    let mergedTraj: Position2D[] = [];
    const mergedAreas: PathData[] = [
      ...matchedPaths,
      ...checkedAreas.map((area) => {
        const selectedTraj = area.getSelectedTraj();
        return {
          id: selectedTraj.id,
          path: selectedTraj.trajectory,
        };
      }),
    ].sort((a, b) => a.id - b.id);
    log.info('[Merged Areas]', mergedAreas);
    mergedAreas.forEach((area) => {
      if (mergedTraj.length === 0) {
        mergedTraj = area.path;
      } else if (area.path.length > 0) {
        mergedTraj = [...mergedTraj, ...area.path.slice(1)];
      }
    });
    log.info('[Merged Traj]', mergedTraj);
    setCheckedAreas([]);
    setMatchedPaths([{ id: -1, path: mergedTraj }]);
    setComment('');
    toast('提交成功', { id: 'submit-toast' });
  };

  return (
    <div className="absolute h-full w-full bg-slate-100 dark:bg-[#1e2433]">
      <div className="absolute left-12 right-0 flex h-8 flex-row items-center justify-start">
        <p className="select-none text-center font-semibold text-slate-400">
          地图匹配数据集标注工具
        </p>
        {/* <button
          className="btn btn-ghost  btn-sm"
          onClick={() => log.info('[Editable]', features, selectedFeatureIndexes)}
        >
          Print
        </button> */}
      </div>
      <div
        className="absolute top-8 left-12 bottom-8 right-52 overflow-hidden rounded-2xl shadow-inner lg:bottom-6"
        ref={mapContainerRef}
      >
        <div
          className={`absolute top-0 left-0 right-0 -bottom-8 transition duration-500 lg:-bottom-6 ${
            isLoading ? 'blur-xl' : ''
          }`}
        >
          <DeckGL
            layers={showDrawPolygonLayer ? [...rawTrajLayers, editableLayer] : layers}
            ContextProvider={MapContext.Provider}
            viewState={viewState}
            onViewStateChange={(v) => setViewState(v.viewState)}
            controller={{
              doubleClickZoom: false,
            }}
            // getCursor={editableLayer.getCursor.bind(editableLayer)}
          >
            <StaticMap
              mapStyle={themeMode === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
              preventStyleDiffing={true}
              className="dark:brightness-150"
            />
            {/*@ts-ignore*/}
            {/* <NavigationControl className="absolute top-4 left-4" showZoom={true} /> */}
          </DeckGL>
        </div>
      </div>
      <div className="absolute top-8 bottom-8 left-0 flex w-12 flex-col items-center justify-between lg:bottom-6">
        <div className="flex flex-col items-center justify-center">
          <div className="mx-2 flex flex-col border-b-2 border-slate-600 border-opacity-50  py-5">
            <button
              className="btn-toolbar"
              onClick={() => annotationDispatch({ type: 'toggleRawTraj' })}
            >
              {showRawTraj ? <Map2 size={28} /> : <MapSearch size={28} />}
              <p className="text-xs">
                {showRawTraj ? (
                  <>
                    原始
                    <br />
                    轨迹
                  </>
                ) : (
                  <>
                    预检
                    <br />
                    结果
                  </>
                )}
              </p>
            </button>
          </div>

          <div className="mx-2 flex flex-col space-y-5 py-5">
            {showRawTraj && (
              <>
                <button
                  className="btn-toolbar"
                  onClick={() => annotationDispatch({ type: 'toggleDrawPolygonLayer' })}
                >
                  <Vector size={28} />
                  <p className="text-xs">
                    选择
                    <br />
                    区域
                  </p>
                </button>
                <button
                  className="btn-toolbar"
                  onClick={() => annotationDispatch({ type: 'toggleDrawPolygonLayer' })}
                >
                  <HandMove size={28} />
                  <p className="text-xs">
                    修正
                    <br />
                    轨迹
                  </p>
                </button>
                <button
                  className="btn-toolbar"
                  onClick={() => annotationDispatch({ type: 'toggleDrawPolygonLayer' })}
                >
                  <Eraser size={28} />
                  <p className="text-xs">
                    清除
                    <br />
                    改动
                  </p>
                </button>
                <button
                  className="btn-toolbar"
                  onClick={() => annotationDispatch({ type: 'toggleDrawPolygonLayer' })}
                >
                  <Route size={28} />
                  <p className="text-xs">
                    生成
                    <br />
                    轨迹
                  </p>
                </button>
              </>
            )}
            {!showRawTraj && isAnnotating && currentArea.length > 0 && (
              <>
                <button className="btn-toolbar">
                  <SquareCheck size={28} />
                  <p className="text-xs">
                    全部
                    <br />
                    显示
                  </p>
                </button>
                {currentArea[0].optionalTrajs.map((traj) => (
                  <button className="btn-toolbar">
                    {traj.index_key === 1 ? (
                      <Square1 size={28} />
                    ) : traj.index_key === 2 ? (
                      <Square2 size={28} />
                    ) : (
                      <Square3 size={28} />
                    )}
                    <p className="text-xs">仅{traj.index_key}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="mx-2 flex flex-col space-y-5 border-t-2 border-slate-600  border-opacity-50 py-5">
          <button className="btn-toolbar" onClick={() => setViewState(initViewState)}>
            <ArrowsMaximize size={28} />
            <p className="text-xs">
              视图
              <br />
              复位
            </p>
          </button>
          <button className="btn-toolbar" onClick={() => setViewState(initViewState)}>
            <Refresh size={28} />
            <p className="text-xs">
              重新
              <br />
              标注
            </p>
          </button>
        </div>
      </div>
      <p className="absolute bottom-0 left-12 flex h-8 items-center justify-end text-sm italic text-slate-500 lg:h-6">
        ©
        <a
          href="https://carto.com/about-carto/"
          target="_blank"
          rel="noopener"
          className=" text-gray-500"
        >
          CARTO
        </a>
        , ©
        <a
          href="http://www.openstreetmap.org/about/"
          target="_blank"
          className="mr-1 text-gray-500"
        >
          OpenStreetMap
        </a>
        contributors
      </p>
      <div className="absolute right-0 top-8 bottom-8 flex w-52 flex-col items-stretch justify-between px-3 lg:bottom-6">
        <div className="flex flex-col">
          <div className="mb-1.5 items-start pl-3 font-semibold  text-slate-500">标注设置</div>
          <div className="card w-full rounded-xl bg-slate-200 shadow-inner dark:bg-[#2b313f]">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-row items-center justify-between">
                <p className="text-sm">启用自动环路剔除</p>
                <input
                  type="checkbox"
                  className="toggle toggle-xs m-auto"
                  checked={autoMergeCircle}
                  onChange={() => {
                    const newState = !autoMergeCircle;
                    setAutoMergeCircle(newState);
                    setIsLoading(true);
                    preAnnotation(sdkResult as MatchingResultDetail, newState);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 mb-1.5 items-start pl-3 font-semibold text-slate-500">界面设置</div>
          <div className="card w-full rounded-xl bg-slate-200 shadow-inner dark:bg-[#2b313f]">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-col items-stretch justify-between space-y-1">
                <p className="text-sm">动画速度: {trajName}</p>
                <p className="text-sm">拖影长度: {rawTraj[0]?.path.length}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 mb-1.5 items-start pl-3 font-semibold text-slate-500">区域信息</div>
          <div className="card mb-4 w-full rounded-xl bg-slate-200 shadow-inner dark:bg-[#2b313f]">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-col items-stretch justify-between space-y-1">
                <p className="text-sm">文件名: {trajName}</p>
                <p className="text-sm">原始坐标数: {rawTraj[0]?.path.length}</p>
                <p className="text-sm">预标注方法: 3</p>
                <p className="text-sm">待复核区域: {mismatchedAreas.length}</p>
              </div>
            </div>
          </div>
        </div>
        {isAnnotating && currentArea.length > 0 && (
          <div className="flex grow flex-col">
            <div className="mb-1.5 items-start pl-3 font-semibold text-slate-500">人工核验</div>
            <div className="card h-full w-full rounded-xl bg-[#2b313f] shadow-inner">
              <div className="card-body m-3 p-0">
                <div
                  className={`card-actions grid h-full grid-cols-1 ${
                    currentArea[0].optionalTrajs.length === 2 ? 'grid-rows-2' : 'grid-rows-3'
                  } gap-3`}
                >
                  {currentArea[0].optionalTrajs.map((traj) => {
                    return (
                      <button
                        className="flex h-full flex-row items-center justify-center rounded-lg pr-2 text-white opacity-90 bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90"
                        onClick={() => handleArea(traj.name)}
                        key={traj.name}
                        style={{
                          backgroundColor: `#${traj.color
                            .map((c) => {
                              const hex = c.toString(16);
                              return hex.length === 1 ? '0' + hex : hex;
                            })
                            .join('')}`,
                        }}
                      >
                        <div className="flex h-full w-12 items-center justify-center bg-gray-700 bg-opacity-20 ">
                          <p className=" text-4xl font-extrabold italic">
                            {traj.index_key.toString()}
                          </p>
                        </div>
                        {/* <p className="break-all text-left text-xs opacity-80">
                          {traj.owners.length} methods (
                          {traj.owners.map((owner) => owner.owner_type).join(', ')}) choice this
                          plan.
                        </p> */}
                        <p className="text-4xl font-extrabold italic opacity-50">
                          {((traj.owners.length / 3) * 100).toFixed(0)}
                          <span className="text-3xl">%</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {!isAnnotating && (
          <div className="flex grow flex-col">
            <div className="mb-1.5 items-start pl-3 font-semibold text-slate-500">
              {mismatchedAreas.length === 0 ? '结果提交' : '开始标注'}
            </div>
            <div className="card h-full w-full rounded-xl bg-slate-200 shadow-inner dark:bg-[#2b313f]">
              <div className="card-body m-3 flex-col p-0">
                <textarea
                  className="textarea flex w-full grow resize-none bg-slate-100 shadow-inner dark:bg-[#1e2433]"
                  value={comment}
                  placeholder="反馈匹配过程发现的问题"
                  onChange={(e) => setComment(e.target.value)}
                />
                {mismatchedAreas.length === 0 ? (
                  <button
                    className="mt-1.5 flex h-16 flex-row items-center justify-center rounded-lg bg-info pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
                    onClick={handleSubmit}
                  >
                    <p className="text-3xl font-extrabold italic opacity-70">Submit</p>
                  </button>
                ) : (
                  <button
                    className="mt-1.5 flex h-16 flex-row items-center justify-center rounded-lg bg-info pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
                    onClick={showNextUncheckedArea}
                  >
                    <p className="text-3xl font-extrabold italic opacity-70">Start</p>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}