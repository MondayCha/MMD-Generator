/*
 * @Author: MondayCha
 * @Date: 2022-04-30 22:01:14
 * @Description: Map-Matching result annotation
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
// Project
import { api } from '@services/api';
import log from '@middleware/logger';
import { getUnmatchedAreas } from '@utils/trajectory';
// Deck.gl
import { StaticMap, MapContext, NavigationControl } from 'react-map-gl';
import DeckGL, { PathLayer, PolygonLayer, FlyToInterpolator } from 'deck.gl';
import { PathStyleExtension } from '@deck.gl/extensions';
import { WebMercatorViewport } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
// Asserts
import { Refresh } from 'tabler-icons-react';
import { debounce } from 'lodash';
import { pre_annotate } from '@wasm/analysis/pkg';
// Types
import type { TrajectoryDetail, CoordinateDetail, MatchingResultDetail } from '@services/type';
import type { UnmatchedArea, UnmatchedMethod, BoundPolygon } from '@utils/trajectory';
import type { ViewStateProps } from '@deck.gl/core/lib/deck';
import type { Position2D } from 'deck.gl';
import toast from 'react-hot-toast';

interface PathData {
  name: string | number;
  path: Position2D[];
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
  transitionInterpolator: new FlyToInterpolator(),
  transitionDuration: '500',
};

export default function Deck() {
  const { taskId, trajName } = useParams();
  const [initViewState, setInitViewState] = useState<ViewStateProps>(INITIAL_VIEW_STATE);
  const [viewState, setViewState] = useState<ViewStateProps>(INITIAL_VIEW_STATE);
  const [unmatchedAreas, setUnmatchedAreas] = useState<UnmatchedArea[]>([]);
  const [commonPaths, setCommonPaths] = useState<PathData[]>([]);
  const [rawTraj, setRawTraj] = useState<PathData[]>([]);
  const [showRawTraj, setShowRawTraj] = useState<boolean>(true);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [annotationIndex, setAnnotationIndex] = useState<number>(-1);
  const [checkAreas, setCheckAreas] = useState<UnmatchedArea[]>([]);
  const [checkTraj, setCheckTraj] = useState<UnmatchedMethod[]>([]);

  const debounceFetch = useMemo(
    () =>
      debounce(() => {
        api.trajectory.getMatchingResult(taskId, trajName).then(({ detail }) => {
          const { bounds, raw_traj, matching_result } = detail as MatchingResultDetail;
          const preAnnotation = pre_annotate(matching_result);
          log.info('[Pre Annotation]', preAnnotation);
          // const areas = getUnmatchedAreas(matching_methods);
          // setUnmatchedAreas(areas);
          setCommonPaths(
            preAnnotation.matched_areas.map((p) => ({
              name: p.id,
              path: traj2path(p.sub_traj.traj),
            }))
          );
          setRawTraj([
            {
              name: 'raw',
              path: traj2path(raw_traj),
            },
          ]);
          // fit bounds for raw_traj and each area
          let view = new WebMercatorViewport({
            width: window.innerWidth,
            height: window.innerHeight,
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
          setViewState(newViewState);
          setInitViewState(newViewState);
          //   areas.forEach((area) => {
          //     let { longitude, latitude, zoom } = view.fitBounds(area.bounds, { padding: 100 });
          //     area.setBoundsInfo(longitude, latitude, zoom);
          //   });
        });
      }, 1800),
    [taskId, trajName]
  );

  useEffect(() => {
    debounceFetch();
  }, [debounceFetch]);

  const layers = useMemo(() => {
    return [
      new PathLayer({
        id: 'raw-traj',
        data: rawTraj,
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 4,
        getPath: (d) => d.path,
        getColor: [250, 166, 26, 200],
        autoHighlight: true,
        highlightColor: [250, 166, 26, 255],
        visible: showRawTraj,
      }),
      new PathLayer({
        id: 'common-trajs',
        data: commonPaths,
        pickable: true,
        widthUnits: 'pixels',
        getWidth: 4,
        getPath: (d) => d.path,
        getColor: [0, 174, 239, 200],
        onClick: (o, e) => log.info('click common-trajs ', o.coordinate),
        visible: !showRawTraj,
      }),
      ...unmatchedAreas.map((area) => {
        return new PathLayer({
          id: `unmatched-path-${area.id}`,
          data: area.unmatchedMethods,
          pickable: true,
          widthUnits: 'pixels',
          getWidth: 4,
          getPath: (d) => d.trajectory,
          getColor: (d) => [...d.color, 200],
          onClick: (o, e) => log.info('click unmatchedAreas', o.coordinate),
          visible: !showRawTraj && !isAnnotating,
        });
      }),
      ...checkAreas.map((area) => {
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
      ...checkAreas.map((area) => {
        return new PathLayer({
          id: `check-path-${area.id}`,
          data: area.unmatchedMethods,
          widthUnits: 'pixels',
          getWidth: 4,
          getPath: (d) => d.trajectory,
          getColor: (d) => [...d.color, 200],
          visible: !showRawTraj && isAnnotating,
        });
      }),
      ...checkTraj.map((method) => {
        return new PathLayer({
          id: `check-traj-${method.id}`,
          data: [
            {
              name: method.name,
              color: method.color,
              path: method.trajectory,
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
          visible: !showRawTraj && isAnnotating,
        });
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRawTraj, isAnnotating, unmatchedAreas, checkAreas, checkTraj, rawTraj]);

  const handleArea = useCallback(
    (type: string) => {
      log.info('handleArea', type);
      if (type !== 'jump' && checkAreas.length > 0) {
        let newCheckTraj = checkAreas[0].unmatchedMethods.find((method) => method.name === type);
        if (newCheckTraj) {
          setCheckTraj((prev) => [...prev, newCheckTraj as UnmatchedMethod]);
        }
      }
      let index = annotationIndex + 1;
      setAnnotationIndex((prev) => prev + 1);
      if (index === 0) {
        setIsAnnotating(true);
      } else if (index === unmatchedAreas.length) {
        setAnnotationIndex(-1);
        setCheckAreas([]);
        setViewState(initViewState);
        return;
      }
      let checkArea = unmatchedAreas[index];
      setCheckAreas([checkArea]);
      let view = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight });
      let { latitude, longitude, zoom } = view.fitBounds(checkArea.bounds, { padding: 120 });
      setViewState({
        ...INITIAL_VIEW_STATE,
        longitude: longitude,
        latitude: latitude,
        zoom: zoom,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAnnotating, unmatchedAreas, annotationIndex]
  );

  return (
    <div className="absolute h-full w-full overflow-hidden">
      <DeckGL
        controller={true}
        layers={layers}
        ContextProvider={MapContext.Provider}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
      >
        <StaticMap mapStyle={MAP_STYLE_DARK} className="dark:brightness-150" />
        {/* <NavigationControl className="absolute top-4 right-4" /> */}
      </DeckGL>
      <div className="absolute top-4 left-4 flex space-x-2">
        <button className="btn btn-square btn-sm">{unmatchedAreas.length}</button>
        <button className="btn btn-square btn-sm" onClick={() => setViewState(initViewState)}>
          <Refresh size={20} />
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            setShowRawTraj((prev) => !prev);
            log.info('[Set Show RawTraj]', rawTraj);
          }}
        >
          {showRawTraj ? 'Show LCSS Result' : 'Show Raw Traj'}
        </button>
        {!isAnnotating && (
          <button className="btn btn-sm" onClick={() => handleArea('jump')}>
            Start
          </button>
        )}
      </div>
      {isAnnotating && (
        <div className="card absolute bottom-4 left-4 bg-base-100 shadow-xl">
          <div className="card-body m-4 p-0">
            <div className="card-title">到底要选哪个呢</div>
            <div className="card-actions justify-between">
              <button
                className="btn btn-warning btn-sm"
                onClick={() => handleArea('GHMapMatching')}
              >
                GHMapMatching
              </button>
              <button
                className="btn btn-error btn-sm"
                onClick={() => handleArea('SimpleMapMatching')}
              >
                SimpleMapMatching
              </button>
              <button className="btn btn-success btn-sm" onClick={() => handleArea('STMatching')}>
                STMatching
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
