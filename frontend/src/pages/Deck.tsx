import { useState, useEffect, useCallback } from 'react';
import { render, flushSync } from 'react-dom';
import { api } from '@services/api';
import { useParams } from 'react-router-dom';
import log from '@middleware/logger';
import { StaticMap, MapContext, NavigationControl } from 'react-map-gl';
import DeckGL, { PathLayer, PolygonLayer, FlyToInterpolator } from 'deck.gl';
import { LinearInterpolator, WebMercatorViewport } from 'react-map-gl';
import { TrajectoryDetail, MatchingMethodDetail, SubTrajectoryDetail } from '@services/type';
import type { UnmatchedArea, UnmatchedMethod } from '@utils/trajectory';
import { getUnmatchedAreas } from '@utils/trajectory';
import { PathStyleExtension } from '@deck.gl/extensions';

const hex2rgba = (hexColor: string): any => {
  return hexColor.match(/[0-9a-f]{2}/g)?.map((x) => parseInt(x, 16));
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export default function Deck() {
  const { taskId, trajName } = useParams();
  const [unmatchedAreas, setUnmatchedAreas] = useState<UnmatchedArea[]>([]);
  const [commonTrajs, setCommonTrajs] = useState<SubTrajectoryDetail[]>([]);
  const [commonPolylines, setCommonPolylines] = useState<any>([]);
  const [rawTraj, setRawTraj] = useState<any>([]);
  const [initViewState, setInitViewState] = useState({
    latitude: 39.976919404646445,
    longitude: 116.31402279393426,
    zoom: 13,
  });
  const [viewport, setViewport] = useState<any>({
    latitude: 39.976919404646445,
    longitude: 116.31402279393426,
    zoom: 13,
  });
  const [showRawTraj, setShowRawTraj] = useState<boolean>(false);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [annotationIndex, setAnnotationIndex] = useState<number>(-1);
  const [checkAreas, setCheckAreas] = useState<UnmatchedArea[]>([]);
  const [checkTraj, setCheckTraj] = useState<UnmatchedMethod[]>([]);

  useEffect(() => {
    api.trajectory.getTrajectory(taskId, trajName).then(({ detail }) => {
      let { matching_methods, common_trajs, bounds, raw_traj } = detail as TrajectoryDetail;
      setCommonTrajs(common_trajs);
      setUnmatchedAreas(getUnmatchedAreas(matching_methods));
      setCommonPolylines(
        common_trajs.map((subTraj) => {
          return {
            name: subTraj.id,
            color: '#00aeef',
            path: subTraj.trajectory.map((point) => [point.longitude, point.latitude]),
          };
        })
      );
      setRawTraj([
        {
          name: 'raw',
          color: '#faa61a',
          path: raw_traj.map((point) => [point.longitude, point.latitude]),
        },
      ]);
      // fit bounds
      let view = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight });
      let { latitude, longitude, zoom } = view.fitBounds(
        [
          [bounds.left_top.longitude, bounds.left_top.latitude],
          [bounds.right_bottom.longitude, bounds.right_bottom.latitude],
        ],
        {
          padding: 100,
        }
      );
      setViewport({
        ...viewport,
        longitude: longitude,
        latitude: latitude,
        zoom: zoom,
      });
      setInitViewState({
        longitude: longitude,
        latitude: latitude,
        zoom: zoom,
      });
    });
  }, [taskId, trajName]);

  const onClick = (info) => {
    // eslint-disable-next-line
    alert(`aaa${info}`);
  };

  const layers = [
    new PathLayer({
      id: 'raw-traj',
      data: rawTraj,
      pickable: true,
      widthUnits: 'pixels',
      getPath: (d) => d.path,
      getColor: [250, 166, 26, 100],
      autoHighlight: true,
      highlightColor: [250, 166, 26, 255],
      getWidth: (d) => 4,
      visible: showRawTraj,
      onClick: (o, e) => {
        log.info('click raw-traj ', o);
        if (o.layer) {
          const layerViewport = o.layer.context.viewport;
          //@ts-ignore
          if (o.coordinate) {
            setViewport({
              ...viewport,
              longitude: o.coordinate[0],
              latitude: o.coordinate[1],
              transitionInterpolator: new FlyToInterpolator(),
              transitionDuration: 'auto',
            });
          }
        }
      },
    }),
    new PathLayer({
      id: 'common-trajs',
      data: commonPolylines,
      pickable: true,
      widthUnits: 'pixels',
      visible: !showRawTraj,
      getPath: (d) => d.path,
      getColor: (d) => hex2rgba(d.color),
      getWidth: (d) => 4,
      onClick: (o, e) => log.info('click common-trajs ', o.coordinate),
    }),
    ...unmatchedAreas.map((area) => {
      return new PathLayer({
        id: `unmatched-path-area-${area.id}`,
        data: area.unmatchedMethods.map((method) => {
          return {
            name: method.name,
            color: method.color,
            path: method.trajectory,
          };
        }),
        pickable: true,
        widthUnits: 'pixels',
        visible: !showRawTraj && !isAnnotating,
        getPath: (d) => d.path,
        getColor: (d) => hex2rgba(d.color),
        getWidth: (d) => 4,
        onClick: (o, e) => log.info('click unmatchedAreas', o.coordinate),
      });
    }),
    ...checkAreas.map((area) => {
      return new PathLayer({
        id: `check-path-area-${area.id}`,
        data: area.unmatchedMethods.map((method) => {
          return {
            name: method.name,
            color: method.color,
            path: method.trajectory,
          };
        }),
        widthUnits: 'pixels',
        visible: !showRawTraj && isAnnotating,
        getPath: (d) => d.path,
        getColor: (d) => hex2rgba(d.color),
        getWidth: (d) => 4,
      });
    }),
    ...checkAreas.map((area) => {
      return new PolygonLayer({
        id: `check-poly-${area.id}`,
        data: [
          {
            contour: [
              [area.bounds[0][0], area.bounds[0][1]],
              [area.bounds[1][0], area.bounds[0][1]],
              [area.bounds[1][0], area.bounds[1][1]],
              [area.bounds[0][0], area.bounds[1][1]],
            ],
          },
        ],
        pickable: true,
        stroked: true,
        filled: true,
        wireframe: true,
        visible: !showRawTraj && isAnnotating,
        //@ts-ignore
        getPolygon: (d) => d.contour,
        getFillColor: (d) => [0, 0, 0, 0],
        getLineColor: [0, 174, 239, 50],
        autoHighlight: true,
        highlightColor: [0, 174, 239, 50],
        widthUnits: 'pixels',
        getLineWidth: 4,
        getDashArray: [6, 4],
        dashJustified: true,
        dashGapPickable: true,
        extensions: [new PathStyleExtension({ dash: true })],
        onClick: (o, e) => {
          log.info('click raw-traj ', o);
          if (o.layer) {
            const layerViewport = o.layer.context.viewport;
            //@ts-ignore
            let { latitude, longitude, zoom } = layerViewport.fitBounds(
              [
                //@ts-ignore
                o.object.contour[0],
                //@ts-ignore
                o.object.contour[2],
              ],
              {
                padding: 60,
              }
            );
            //@ts-ignore
            setViewport({
              ...viewport,
              longitude: longitude,
              latitude: latitude,
              zoom: zoom,
              transitionInterpolator: new FlyToInterpolator(),
              transitionDuration: '500',
            });
          }
        },
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
        visible: !showRawTraj && isAnnotating,
        getPath: (d) => d.path,
        getColor: (d) => hex2rgba('#00aeef'),
        getWidth: (d) => 4,
        //@ts-ignore
        getDashArray: [6, 4],
        dashJustified: true,
        dashGapPickable: true,
        extensions: [new PathStyleExtension({ dash: true })],
      });
    }),
  ];

  const onViewStateChange = useCallback(({ viewState }) => {
    flushSync(() => setViewport(viewState));
  }, []);

  const handleArea = useCallback(
    (type: string) => {
      if (type !== 'jump') {
        let newCheckTraj = checkAreas[0].unmatchedMethods.find((method) => method.name === type);
        if (newCheckTraj) {
          setCheckTraj([...checkTraj, newCheckTraj]);
        }
      }
      let index = annotationIndex + 1;
      setAnnotationIndex((prev) => prev + 1);
      if (index === 0) {
        setIsAnnotating(true);
      } else if (index === unmatchedAreas.length) {
        setAnnotationIndex(-1);
        setCheckAreas([]);
        setViewport({
          ...initViewState,
          transitionInterpolator: new FlyToInterpolator(),
          transitionDuration: '500',
        });
        return;
      }
      let checkArea = unmatchedAreas[index];
      setCheckAreas([checkArea]);
      let view = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight });
      let { latitude, longitude, zoom } = view.fitBounds(
        [
          [checkArea.bounds[0][0], checkArea.bounds[0][1]],
          [checkArea.bounds[1][0], checkArea.bounds[1][1]],
        ],
        {
          padding: 120,
        }
      );
      setViewport({
        ...viewport,
        longitude: longitude,
        latitude: latitude,
        zoom: zoom,
        transitionInterpolator: new FlyToInterpolator(),
        transitionDuration: '400',
      });
    },
    [isAnnotating, unmatchedAreas, annotationIndex]
  );

  return (
    <div className="absolute w-full h-full">
      <DeckGL
        controller={true}
        //@ts-ignore
        layers={layers}
        ContextProvider={MapContext.Provider}
        viewState={viewport}
        onViewStateChange={onViewStateChange}
      >
        <StaticMap mapStyle={MAP_STYLE} />
        <NavigationControl className="absolute top-4 right-4" />
      </DeckGL>
      <div className="absolute top-4 left-4 flex space-x-2">
        <button className="btn btn-sm btn-square">{unmatchedAreas.length}</button>
        <button className="btn btn-sm" onClick={() => setShowRawTraj((prev) => !prev)}>
          {showRawTraj ? 'Show LCSS Result' : 'Show Raw Traj'}
        </button>
        {!isAnnotating && (
          <button className="btn btn-sm" onClick={() => handleArea('jump')}>
            Start
          </button>
        )}
      </div>
      {isAnnotating && (
        <div className="absolute bottom-4 left-4 card bg-base-100 shadow-xl">
          <div className="card-body m-4 p-0">
            <div className="card-title">到底要选哪个呢</div>
            <div className="card-actions justify-between">
              <button
                className="btn btn-sm btn-warning"
                onClick={() => handleArea('GHMapMatching')}
              >
                GHMapMatching
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={() => handleArea('SimpleMapMatching')}
              >
                SimpleMapMatching
              </button>
              <button className="btn btn-sm btn-success" onClick={() => handleArea('STMatching')}>
                STMatching
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
