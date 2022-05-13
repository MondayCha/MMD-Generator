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
  Route,
  HandMove,
  ArrowsMaximize,
  Eraser,
  Square1,
  Square3,
  Square2,
  SquareCheck,
} from 'tabler-icons-react';
import { debounce } from 'lodash';
import { PreprocessAreas, pre_annotate } from '@wasm/pre-annotation/package';
// Types
import type { CoordinateDetail, MatchingResultDetail, TaskDetail } from '@services/type';
import type { MismatchedArea, BoundPolygon } from '@utils/trajectory';
import type { ViewStateProps } from '@deck.gl/core/lib/deck';
import type { Position2D } from 'deck.gl';
import toast from 'react-hot-toast';
import { useThemeContext } from '@/components/theme';
import useLocalStorage from '@/hooks/useLocalStorage';
import appConfig from '@/config/app.config';
import AnimationConfigCard from './components/AnimationConfigCard';
import PreAnnotationCard from './components/PreAnnotationCard';
import AreaInfoCard from './components/AreaInfoCard';

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
  | { type: 'startDraw' }
  | { type: 'endDraw' };

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
      return { ...state, isAnnotating: false };
    case 'startDraw':
      return { ...state, showRawTraj: true, showDrawPolygonLayer: true };
    case 'endDraw':
      return { ...state, showDrawPolygonLayer: false };
    default:
      throw new Error();
  }
}

// nebula.gl
const initialFeaturesState = {
  type: 'FeatureCollection',
  features: [],
};

const enum EditState {
  NONE,
  DRAW_POLYGON,
  MODIFY_POINT,
  DONE,
}

export default function Annotation() {
  const { groupHashid, dataName } = useParams();
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

  // Nebula.gl State
  const [features, setFeatures] = useState<any>(initialFeaturesState);
  const [selectedFeatureIndexes, setSelectedFeatureIndexes] = useState<number[]>([]);
  const [mode, setMode] = useState<any>(() => DrawRectangleMode);
  const [editState, setEditState] = useState(EditState.NONE);

  const editableLayer = new EditableGeoJsonLayer({
    // id: "geojson-layer",
    data: features,
    mode,
    selectedFeatureIndexes: selectedFeatureIndexes,
    getFillColor: [0, 174, 239, 50],
    getLineColor: [0, 174, 239, 200],
    lineWidthMinPixels: 4,
    getEditHandlePointColor: [0, 174, 239, 255],
    getEditHandlePointRadius: 6,

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
  const [currentPathIndex, setCurrentPathIndex] = useState<number>(-1);
  const [checkedAreas, setCheckedAreas] = useState<MismatchedArea[]>([]);

  // Annotation State
  const [isLoading, setIsLoading] = useState(true);
  const [speed, setSpeed] = useLocalStorage<number>(appConfig.local_storage.animation.speed, 80);
  const [length, setLength] = useLocalStorage<number>(
    appConfig.local_storage.animation.length,
    180
  );
  const [{ showRawTraj, isAnnotating, showDrawPolygonLayer }, annotationDispatch] = useReducer(
    annotationStateReducer,
    initailAnnotationState
  );

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
    if (showRawTraj || currentPathIndex > -1) {
      log.info('window requestAnimationFrame');
      //@ts-ignore
      animation.id = window.requestAnimationFrame(animate);
    }
    //@ts-ignore
    return () => window.cancelAnimationFrame(animation.id);
  }, [animation, showRawTraj, speed, currentPathIndex]);

  // Right Panel
  const [comment, setComment] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [autoMergeCircle, setAutoMergeCircle] = useLocalStorage<boolean>(
    appConfig.local_storage.pre_annotation.auto_merge_circle,
    true
  );

  const handleToggleMergeUTurns = () => {
    const newState = !autoMergeCircle;
    setAutoMergeCircle(newState);
    resetAll();
    preAnnotation(sdkResult as MatchingResultDetail, newState);
  };

  const debounceCloseLoading = useMemo(
    () =>
      debounce(() => {
        setIsLoading(false);
        toast('预标注已完成，可以开始标注了', { id: 'pre-annotation' });
      }, 500),
    []
  );

  const preAnnotation = useCallback(
    (result: MatchingResultDetail, options?: boolean) => {
      if (result) {
        const { bounds, raw_traj, matching_result, traj_name } = result;
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
            name: traj_name,
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
          longitude,
          latitude,
          zoom,
          pitch: 0,
        };
        setViewState({ ...newViewState, bearing: 30, pitch: 50 });
        setInitViewState(newViewState);
        areas_need_check.forEach((area) => {
          let { longitude, latitude, zoom } = view.fitBounds(area.bounds, { padding: 60 });
          area.setBoundsInfo(longitude, latitude, zoom);
        });
        setMismatchedAreas(areas_need_check);
        debounceCloseLoading();
      }
    },
    [sdkResult, debounceCloseLoading]
  );

  useEffect(() => {
    api.data.getRawTrajMatching(groupHashid, dataName).then(({ detail }) => {
      setSdkResult(detail as MatchingResultDetail);
      preAnnotation(detail as MatchingResultDetail);
    });
  }, [groupHashid, dataName]);

  const rawTrajLayers = useMemo(() => {
    if (rawTraj.length === 0 || sdkResult === undefined) {
      return [];
    }
    const timeLength = rawTraj[0].time.end - rawTraj[0].time.start;
    return [
      new PathLayer({
        id: 'const-raw-traj',
        data: [sdkResult.raw_traj],
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 6,
        getPath: (d) => d.map((point) => [point.longitude, point.latitude] as Position2D),
        getColor: [77, 184, 72, 50],
        visible: showRawTraj && editState === EditState.DONE,
      }),
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
        visible: showRawTraj,
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
        visible: showRawTraj,
      }),
    ];
  }, [showRawTraj, rawTraj, time, length, editState, sdkResult]);

  const layers = useMemo(() => {
    return [
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
          data: area.optionalTrajs.filter(
            (_, index) => index === currentPathIndex || currentPathIndex < 0
          ),
          widthUnits: 'pixels',
          getWidth: 4,
          getPath: (d) => d.trajectory,
          getColor: (d) => [...d.color, currentPathIndex < 0 ? 222 : 100],
          visible: !showRawTraj && isAnnotating,
        });
      }),
      ...currentArea.map((area) => {
        return new TripsLayer({
          id: `current-trip-${area.id}`,
          data: area.optionalTrajs.filter((_, index) => index === currentPathIndex),
          getPath: (d) => d.trajectory,
          // deduct start timestamp from each data point to avoid overflow
          getTimestamps: (d) => d.trajectory.map((_, i) => i / d.trajectory.length),
          getColor: (d) => [...d.color],
          opacity: 0.9,
          widthMinPixels: 6,
          jointRounded: true,
          capRounded: true,
          trailLength: 0.3,
          currentTime: time,
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
  }, [
    time,
    showRawTraj,
    isAnnotating,
    mismatchedAreas,
    currentArea,
    checkedAreas,
    matchedPaths,
    currentPathIndex,
  ]);

  const showNextUncheckedArea = () => {
    setCurrentPathIndex(-1);
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
    // analysis
    let analysis = new Map<string, MethodAnalysis>();
    sdkResult?.matching_result.forEach((result) => {
      analysis.set(result.method_name, {
        mismatched_area_count: 0,
        mismatched_point_count: 0,
        total_point_count: result.trajectory.length,
      });
    });
    checkedAreas.forEach((area) => {
      const index = area.selectedTrajIndex;
      for (let i = 0; i < area.optionalTrajs.length; i += 1) {
        if (i !== index) {
          area.optionalTrajs[i].owners.forEach((owner) => {
            const prev = analysis.get(owner.owner_type);
            if (prev) {
              analysis.set(owner.owner_type, {
                mismatched_area_count: prev.mismatched_area_count + 1,
                mismatched_point_count:
                  prev.mismatched_point_count + owner.end_index - owner.start_index,
                total_point_count: prev.total_point_count,
              });
            }
          });
        }
      }
    });
    allAreas?.prematched_areas.forEach((area) => {
      const subTraj = area.sub_traj;
      subTraj.owners.forEach((owner) => {
        if (owner.has_error) {
          const prev = analysis.get(owner.owner_type);
          if (prev) {
            analysis.set(owner.owner_type, {
              mismatched_area_count: prev.mismatched_area_count + 1,
              mismatched_point_count:
                prev.mismatched_point_count + owner.end_index - owner.start_index,
              total_point_count: prev.total_point_count,
            });
          }
        }
      });
    });
    // merge traj
    let mergedPath: Position2D[] = [];
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
      if (mergedPath.length === 0) {
        mergedPath = area.path;
      } else if (area.path.length > 0) {
        mergedPath = [...mergedPath, ...area.path.slice(1)];
      }
    });
    const mergedTraj = mergedPath.map((p) => ({ longitude: p[0], latitude: p[1] }));
    log.info('[Merged Path]', mergedPath);
    api.annotate
      .uploadAnnotation(
        groupHashid,
        dataName,
        JSON.stringify(mergedTraj),
        JSON.stringify(Array.from(analysis.entries())),
        JSON.stringify(sdkResult?.raw_traj),
        JSON.stringify(sdkResult?.bounds),
        comment
      )
      .then((res) => {
        setCheckedAreas([]);
        setMatchedPaths([{ id: -1, path: mergedPath }]);
        setComment('');
        setShowModal(true);
      });
  };

  const handleTrajModify = () => {
    if (editState === EditState.MODIFY_POINT) {
      return;
    } else if (features.features.length === 0) {
      toast('未划定选区，将选择所有坐标', { id: 'draw-toast' });
    } else if (features.features.length > 1) {
      toast.error('检测到多个选区，将处理第一个选区', { id: 'draw-toast' });
    }
    annotationDispatch({ type: 'startDraw' });
    setEditState(EditState.MODIFY_POINT);
    let bounds: any = undefined;
    if (features.features.length > 0) {
      const rectangleArea = features.features[0];
      const boundInfo = {
        //@ts-ignore
        minLon: rectangleArea.geometry.coordinates[0][0][0] as number,
        //@ts-ignore
        minLat: rectangleArea.geometry.coordinates[0][0][1] as number,
        //@ts-ignore
        maxLon: rectangleArea.geometry.coordinates[0][2][0] as number,
        //@ts-ignore
        maxLat: rectangleArea.geometry.coordinates[0][2][1] as number,
      };
      if (boundInfo.minLon > boundInfo.maxLon) {
        [boundInfo.minLon, boundInfo.maxLon] = [boundInfo.maxLon, boundInfo.minLon];
      } else if (boundInfo.minLat > boundInfo.maxLat) {
        [boundInfo.minLat, boundInfo.maxLat] = [boundInfo.maxLat, boundInfo.minLat];
      }
      log.info('[Bound Info]', boundInfo);
      bounds = boundInfo;
    }
    if (rawTraj.length > 0) {
      let filteredTraj = rawTraj[0].path.map((p, index) => ({
        index: index,
        timestamp: p.timestamp,
        coordinates: p.coordinates,
      }));
      if (bounds) {
        filteredTraj = filteredTraj.filter(
          (p) =>
            bounds.minLon <= p.coordinates[0] &&
            p.coordinates[0] <= bounds.maxLon &&
            bounds.minLat <= p.coordinates[1] &&
            p.coordinates[1] <= bounds.maxLat
        );
        let view = new WebMercatorViewport({
          width: mapContainerRef.current?.clientWidth ?? window.innerWidth,
          height: mapContainerRef.current?.clientHeight ?? window.innerHeight,
        });
        let { longitude, latitude, zoom } = view.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat],
          ],
          {
            padding: 60,
          }
        );
        setViewState({ ...INITIAL_VIEW_STATE, longitude, latitude, zoom });
      } else {
        setViewState(initViewState);
      }
      log.info('[Filtered Traj]', filteredTraj);
      setFeatures({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { index: filteredTraj.map((p) => p.index) },
            geometry: {
              type: 'LineString',
              coordinates: filteredTraj.map((p) => p.coordinates),
            },
          },
        ],
      });
      setMode(() => ModifyMode);
      setSelectedFeatureIndexes([0]);
    }
  };

  const handleGenerateNewRawTraj = () => {
    if (
      editState !== EditState.MODIFY_POINT ||
      features.features.length === 0 ||
      rawTraj.length === 0
    ) {
      toast.error('请先修正轨迹', { id: 'draw-toast' });
      return;
    }
    const modifiedLine = features.features[0];
    const indexes: number[] = modifiedLine.properties.index;
    const coordinates: Position2D[] = modifiedLine.geometry.coordinates;
    if (indexes.length != coordinates.length) {
      toast.error('修正轨迹时请不要添加或删除点，请重新选择区域', { id: 'draw-toast' });
      setSelectedFeatureIndexes([]);
      setFeatures(initialFeaturesState);
      setEditState(EditState.DRAW_POLYGON);
      setMode(() => DrawRectangleMode);
      return;
    }
    log.info('[Modified Line]', modifiedLine);
    let modifiedRawTraj: TPathData = rawTraj[0];
    modifiedRawTraj.path.forEach((way, index) => {
      const order = indexes.findIndex((v) => v === index);
      if (order > -1) {
        way.coordinates = coordinates[order];
      }
    });
    setRawTraj([modifiedRawTraj]);
    annotationDispatch({ type: 'endDraw' });
    setSelectedFeatureIndexes([]);
    setFeatures(initialFeaturesState);
    setEditState(EditState.DONE);
    setCurrentArea([]);
    annotationDispatch({ type: 'endAnnotating' });
    const modifiedTrajString = JSON.stringify(modifiedRawTraj);
    setIsLoading(true);
    toast('轨迹已修正，正在重新预标注', { id: 'pre-annotation' });
    api.data.getModifiedTrajMatching(groupHashid, modifiedTrajString).then(({ detail }) => {
      preAnnotation(detail as MatchingResultDetail);
    });
  };

  const clearEditData = () => {
    annotationDispatch({ type: 'endDraw' });
    setFeatures(initialFeaturesState);
    setEditState(EditState.NONE);
    setSelectedFeatureIndexes([]);
  };

  const resetAll = () => {
    setCurrentArea([]);
    annotationDispatch({ type: 'endAnnotating' });
    setIsLoading(true);
    setCheckedAreas([]);
    clearEditData();
  };

  const handleResetAll = () => {
    resetAll();
    setAutoMergeCircle(true);
    setSpeed(80);
    setLength(160);
    preAnnotation(sdkResult as MatchingResultDetail);
    log.info('[Reset All]', mismatchedAreas);
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
            layers={
              showDrawPolygonLayer
                ? [...rawTrajLayers, editableLayer]
                : [...rawTrajLayers, ...layers]
            }
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
          <div className="mx-3 flex flex-col border-b-2 border-slate-600 border-opacity-25  py-6">
            <button
              className="mdc-btn-toolbar"
              onClick={() => {
                if (editState === EditState.NONE || editState === EditState.DONE) {
                  annotationDispatch({ type: 'toggleRawTraj' });
                } else {
                  toast.error('正在编辑原始轨迹数据，无法切换', { id: 'left-panel' });
                }
              }}
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

          <div className="mx-3 flex flex-col space-y-6 py-6">
            {showRawTraj && (
              <>
                <button
                  className={`mdc-btn-toolbar ${
                    editState === EditState.DRAW_POLYGON ? 'text-primary' : ''
                  }`}
                  onClick={() => {
                    if (editState === EditState.MODIFY_POINT) {
                      toast.error('轨迹修正未完成，请先清除改动或生成轨迹', { id: 'draw-toast' });
                    } else {
                      annotationDispatch({ type: 'startDraw' });
                      setEditState(EditState.DRAW_POLYGON);
                      setMode(() => DrawRectangleMode);
                    }
                  }}
                >
                  <Vector size={28} />
                  <p className="text-xs">
                    选择
                    <br />
                    区域
                  </p>
                </button>
                <button
                  className={`mdc-btn-toolbar ${
                    editState === EditState.MODIFY_POINT ? 'text-primary' : ''
                  }`}
                  onClick={handleTrajModify}
                >
                  <HandMove size={28} />
                  <p className="text-xs">
                    修正
                    <br />
                    轨迹
                  </p>
                </button>
                <button className="mdc-btn-toolbar" onClick={clearEditData}>
                  <Eraser size={28} />
                  <p className="text-xs">
                    清除
                    <br />
                    改动
                  </p>
                </button>
                <button className="mdc-btn-toolbar" onClick={handleGenerateNewRawTraj}>
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
                <button
                  className={`mdc-btn-toolbar ${currentPathIndex === -1 ? 'text-primary' : ''}`}
                  onClick={() => setCurrentPathIndex(-1)}
                >
                  <SquareCheck size={28} />
                  <p className="text-xs">
                    全部
                    <br />
                    显示
                  </p>
                </button>
                {currentArea[0].optionalTrajs.map((traj) => (
                  <button
                    className={`mdc-btn-toolbar ${
                      currentPathIndex + 1 === traj.index_key ? 'text-primary' : ''
                    }`}
                    key={`choice-${traj.index_key}`}
                    onClick={() => {
                      setCurrentPathIndex(traj.index_key - 1);
                      log.info('[Only]', traj.index_key - 1);
                    }}
                  >
                    {traj.index_key === 1 ? (
                      <Square1 size={28} />
                    ) : traj.index_key === 2 ? (
                      <Square2 size={28} />
                    ) : (
                      <Square3 size={28} />
                    )}
                    <p className="text-xs">仅 {traj.index_key}</p>
                  </button>
                ))}
              </>
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
          <PreAnnotationCard onChange1={handleToggleMergeUTurns} />
          <AnimationConfigCard />
          <AreaInfoCard
            fileName={dataName}
            gpsCount={rawTraj[0]?.path.length}
            methodCount={sdkResult?.matching_result.length}
            uncheckedCount={mismatchedAreas.length}
          />
        </div>
        {isAnnotating && currentArea.length > 0 && (
          <div className="flex grow flex-col">
            <div className="mdc-card-header mb-1.5">人工核验</div>
            <div className="mdc-card-body h-full">
              <div
                className={`grid h-full w-full grid-cols-1 ${
                  currentArea[0].optionalTrajs.length === 2 ? 'grid-rows-2' : 'grid-rows-3'
                } gap-3`}
              >
                {currentArea[0].optionalTrajs.map((traj) => {
                  return (
                    <button
                      className="flex h-full flex-row items-center justify-between overflow-hidden rounded-lg text-white bg-blend-darken brightness-110 transition duration-200 hover:brightness-105 active:brightness-100 dark:brightness-100 dark:hover:brightness-95 dark:active:brightness-90"
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
                      <p className="grow text-4xl font-extrabold italic opacity-50">
                        {((traj.owners.length / 3) * 100).toFixed(0)}
                        <span className="text-3xl">%</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {!isAnnotating && (
          <div className="flex grow flex-col">
            <div className="mdc-card-header mb-1.5">
              {mismatchedAreas.length === 0 ? '结果提交' : '开始标注'}
            </div>
            <div className="mdc-card-body h-full flex-col space-y-3">
              <textarea
                className="textarea flex w-full grow resize-none border-2 border-gray-200 bg-white dark:border-0 dark:bg-[#1e2433] dark:shadow-inner"
                value={comment}
                placeholder="反馈遇到的问题"
                onChange={(e) => setComment(e.target.value)}
              />
              {mismatchedAreas.length === 0 ? (
                <button
                  className="mt-1.5 flex h-16 flex-row items-center justify-center rounded-lg bg-primary pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
                  onClick={handleSubmit}
                >
                  <p className="text-3xl font-extrabold italic dark:opacity-70">Submit</p>
                </button>
              ) : (
                <button
                  className="mt-1.5 flex h-16 flex-row items-center justify-center rounded-lg bg-primary pr-2 text-white bg-blend-darken transition duration-200 hover:brightness-95 active:brightness-90 "
                  onClick={showNextUncheckedArea}
                >
                  <p className="text-3xl font-extrabold italic dark:opacity-70">Start</p>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {showModal && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden outline-none focus:outline-none ">
            <div className="relative my-6 mx-auto w-auto max-w-3xl">
              <div className="mdc-card-body flex flex-col items-stretch justify-between space-y-3 p-5">
                <h3 className="mdc-card-header ml-0 pl-0 text-xl">提交成功</h3>
                <p>
                  已经完成了对数据集 {groupHashid} 数据 {dataName} 的标注
                </p>
                <div className="flex flex-row items-center justify-end space-x-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowModal(false);
                      navigate(`/`);
                    }}
                  >
                    Home
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowModal(false);
                      handleResetAll();
                    }}
                  >
                    Retry
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setShowModal(false);
                      api.task.getTasks(1, 1).then(({ detail }) => {
                        const tasks = detail as TaskDetail[];
                        if (tasks.length > 0) {
                          navigate(`/annotations/${tasks[0].hashid}/${tasks[0].name}`);
                        } else {
                          toast('No more tasks');
                        }
                      });
                    }}
                  >
                    Next
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
