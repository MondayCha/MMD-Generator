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
// Asserts

import { Refresh, Map } from 'tabler-icons-react';
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

interface PathData {
  name: string | number;
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
}

const initailAnnotationState: AnnotationState = {
  showRawTraj: true,
  isAnnotating: false,
};

type AnnotationStateAction =
  | { type: 'toggleRawTraj' }
  | { type: 'startAnnotating' }
  | { type: 'endAnnotating' };

function annotationStateReducer(
  state: AnnotationState,
  action: AnnotationStateAction
): AnnotationState {
  switch (action.type) {
    case 'toggleRawTraj':
      return { ...state, showRawTraj: !state.showRawTraj };
    case 'startAnnotating':
      return { showRawTraj: false, isAnnotating: true };
    case 'endAnnotating':
      return { ...state, isAnnotating: !state.isAnnotating };
    default:
      throw new Error();
  }
}

export default function Deck() {
  const { taskId, trajName } = useParams();

  // Map State
  const [initViewState, setInitViewState] = useState<ViewStateProps>(INITIAL_VIEW_STATE);
  const [viewState, setViewState] = useState<ViewStateProps>({
    ...INITIAL_VIEW_STATE,
    bearing: 30,
    pitch: 50,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Wasm Matching Data
  const [allAreas, setAllAreas] = useState<PreprocessAreas>();
  const [matchedPaths, setMatchedPaths] = useState<PathData[]>([]);
  const [mismatchedAreas, setMismatchedAreas] = useState<MismatchedArea[]>([]);
  const [rawTraj, setRawTraj] = useState<TPathData[]>([]);

  // Data During Annotating
  const [currentArea, setCurrentArea] = useState<MismatchedArea[]>([]);
  const [checkedAreas, setCheckedAreas] = useState<MismatchedArea[]>([]);

  // Annotation State
  const [{ showRawTraj, isAnnotating }, annotationDispatch] = useReducer(
    annotationStateReducer,
    initailAnnotationState
  );

  // Animation
  const [time, setTime] = useState<number>(0);
  const [animation] = useState({});

  const animate = () => {
    //@ts-ignore
    setTime((t) => (t + 0.005) % 1);
    //@ts-ignore
    animation.id = window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    log.info('window requestAnimationFrame');
    //@ts-ignore
    animation.id = window.requestAnimationFrame(animate);
    //@ts-ignore
    return () => window.cancelAnimationFrame(animation.id);
  }, [animation]);

  const debounceFetch = useMemo(
    () =>
      debounce(() => {
        api.trajectory.getMatchingResult(taskId, trajName).then(({ detail }) => {
          const { bounds, raw_traj, matching_result } = detail as MatchingResultDetail;
          const wasmAreas = pre_annotate(matching_result, true);
          setAllAreas(wasmAreas);
          log.info('[Pre Annotation]', wasmAreas);
          const areas_need_check = getMismatchedAreas(wasmAreas.mismatched_areas);
          setMatchedPaths([
            ...wasmAreas.matched_areas.map((p) => ({
              name: p.id,
              path: traj2path(p.sub_traj.traj),
            })),
            ...wasmAreas.prematched_areas.map((p) => ({
              name: p.last_common_id,
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
        });
      }, 500),
    [taskId, trajName]
  );

  useEffect(() => {
    debounceFetch();
  }, [debounceFetch]);

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
        //@ts-ignore
        rounded: true,
        fadeTrail: true,
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
    const nextUncheckedArea = mismatchedAreas.find(
      (area) => area.areaState === AreaState.Unchecked
    );
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

  return (
    <div className="absolute h-full w-full overflow-hidden dark:bg-[#1e2433]">
      <div className="relative left-12 flex h-8 w-full flex-row items-center justify-start">
        <p className="select-none text-center font-semibold">地图匹配数据集标注工具</p>
        <button className="btn btn-ghost btn-square btn-sm">{mismatchedAreas.length}</button>
        <button
          className="btn btn-ghost btn-square btn-sm"
          onClick={() => setViewState(initViewState)}
        >
          <Refresh size={20} />
        </button>
        <button
          className="btn btn-ghost  btn-sm"
          onClick={() => {
            annotationDispatch({ type: 'toggleRawTraj' });
            log.info('[Set Show RawTraj]', rawTraj);
          }}
        >
          {showRawTraj ? 'Show LCSS Result' : 'Show Raw Traj'}
        </button>
        {!isAnnotating &&
          (mismatchedAreas.length > 0 ? (
            <button className="btn btn-ghost  btn-sm" onClick={showNextUncheckedArea}>
              Start
            </button>
          ) : (
            <button className="btn btn-ghost  btn-sm" onClick={showNextUncheckedArea}>
              Submit
            </button>
          ))}
      </div>
      <div
        className="absolute top-8 left-12 bottom-8 right-52 overflow-hidden rounded-2xl shadow-xl lg:bottom-6"
        ref={mapContainerRef}
      >
        <div className="absolute top-0 left-0 right-0 -bottom-8 lg:-bottom-6">
          <DeckGL
            controller={true}
            layers={layers}
            ContextProvider={MapContext.Provider}
            viewState={viewState}
            onViewStateChange={(v) => setViewState(v.viewState)}
          >
            <StaticMap
              mapStyle={MAP_STYLE_DARK}
              preventStyleDiffing={true}
              className="dark:brightness-150"
            />
            {/*@ts-ignore*/}
            {/* <NavigationControl className="absolute top-4 left-4" showZoom={true} /> */}
          </DeckGL>
        </div>
      </div>
      <div className="absolute top-8 bottom-0 left-0 flex w-12 flex-col items-center justify-start"></div>
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
      <div className="absolute right-0 top-8 bottom-0 flex w-52 flex-col items-stretch justify-between  space-y-2 px-3 pb-2">
        <div className="flex flex-col">
          <div className="mb-1.5 items-start pl-3 font-semibold">预标注选项</div>
          <div className="card w-full rounded-xl bg-[#2b313f] shadow-inner">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-col items-stretch justify-between space-y-1">
                <p className="text-sm">启用自动环路剔除</p>
              </div>
            </div>
          </div>
          <div className="mt-4 mb-1.5 items-start pl-3 font-semibold">界面设置</div>
          <div className="card w-full rounded-xl bg-[#2b313f] shadow-inner">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-col items-stretch justify-between space-y-1">
                <p className="text-sm">动画速度: {trajName}</p>
                <p className="text-sm">拖影长度: {rawTraj[0]?.path.length}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 mb-1.5 items-start pl-3 font-semibold">区域信息</div>
          <div className="card mb-4 w-full rounded-xl bg-[#2b313f] shadow-inner">
            <div className="card-body m-3 p-0">
              <div className="card-actions flex-col items-stretch justify-between space-y-1">
                <p className="text-sm">文件名: {trajName}</p>
                <p className="text-sm">原始坐标数: {rawTraj[0]?.path.length}</p>
                <p className="text-sm">预标注方法: 3</p>
              </div>
            </div>
          </div>
        </div>
        {isAnnotating && currentArea.length > 0 && (
          <div className="flex h-full flex-col">
            <div className="mb-1.5 items-start pl-3 font-semibold">人工核验</div>
            <div className="card h-full w-full rounded-xl bg-[#2b313f] shadow-inner">
              <div className="card-body m-3 p-0">
                <div
                  className={`card-actions grid h-full grid-cols-1 ${
                    currentArea[0].optionalTrajs.length === 2 ? 'grid-rows-3' : 'grid-rows-4'
                  } gap-3`}
                >
                  {currentArea[0].optionalTrajs.map((traj) => {
                    return (
                      <button
                        className="flex h-full flex-row items-center justify-center rounded-lg pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90"
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
                        <div className="mr-2 flex h-full w-12 items-center justify-center bg-gray-700 bg-opacity-20 ">
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
                  <button
                    className="flex h-full flex-row items-center justify-center rounded-lg bg-info pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
                    onClick={() => handleArea('Skip')}
                  >
                    <div className="mr-2 flex h-full w-12 items-center justify-center bg-gray-700 bg-opacity-20">
                      <p className="text-4xl font-extrabold italic">
                        {currentArea[0].optionalTrajs.length + 1}
                      </p>
                    </div>
                    <p className="text-4xl font-extrabold uppercase italic opacity-50">
                      S<span className="text-3xl">kip</span>
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
