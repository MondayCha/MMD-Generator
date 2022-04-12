import { LayersControl, MapContainer, TileLayer, Polyline } from 'react-leaflet';
import { useParams } from 'react-router-dom';
import { useMap } from 'react-leaflet';
import { api } from '@services/api';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression, PathOptions, LatLngBoundsExpression } from 'leaflet';
import log from '@middleware/logger';
import { useState, useEffect, useRef } from 'react';
import { TrajectoryDetail, MatchingMethodDetail, SubTrajectoryDetail } from '@services/type';

function getPathOptions(methodName?: string, opacity?: number): PathOptions {
  let color = '#ff0000';
  switch (methodName) {
    case 'GHMapMatching':
      color = '#f59e0b';
      break;
    case 'SimpleMapMatching':
      color = '#ef4444';
      break;
    case 'STMatching':
      color = '#06b6d4';
      break;
    case 'RawTraj':
      color = '#a855f7';
      break;
    default:
      color = '#22c55e';
  }
  return { color: color, opacity: opacity ?? 0.7 };
}

export default function Map() {
  const { taskId, trajName } = useParams();
  const layersControlRef = useRef<any>();
  const [matchingMethods, setMatchingMethods] = useState<MatchingMethodDetail[]>([]);
  const [commonTrajs, setCommonTrajs] = useState<SubTrajectoryDetail[]>([]);
  // const map = useMap();
  // Polyline Store
  const [commonPolylines, setCommonPolylines] = useState<LatLngExpression[][]>([]);
  const [rawTraj, setRawTraj] = useState<LatLngExpression[]>([]);
  const [mapBounds, setMapBounds] = useState<LatLngBoundsExpression>([
    [39.92679854210712, 116.47209120858315],
    [39.94784807972859, 116.40273470506943],
  ]);

  useEffect(() => {
    api.trajectory.getTrajectory(taskId, trajName).then(({ detail }) => {
      let { matching_methods, common_trajs, bounds, raw_traj } = detail as TrajectoryDetail;
      setCommonTrajs(common_trajs);
      setMatchingMethods(matching_methods);
      setCommonPolylines(
        common_trajs.map((subTraj) => {
          return subTraj.trajectory.map((point) => {
            return {
              lat: point.latitude,
              lng: point.longitude,
            } as LatLngExpression;
          });
        })
      );
      setRawTraj(
        raw_traj.map((point) => {
          return {
            lat: point.latitude,
            lng: point.longitude,
          } as LatLngExpression;
        })
      );
      setMapBounds([
        [bounds.left_top.latitude, bounds.left_top.longitude],
        [bounds.right_bottom.latitude, bounds.right_bottom.longitude],
      ]);
    });
  }, [taskId, trajName]);

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden">
      <MapContainer
        bounds={mapBounds}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <LayersControl ref={layersControlRef}>
          <LayersControl.BaseLayer name="Grayscale" checked={true}>
            <TileLayer
              attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
              url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw"
              id="mapbox/light-v9"
              tileSize={512}
              zoomOffset={-1}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets">
            <TileLayer
              attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
              url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw"
              id="mapbox/streets-v11"
              tileSize={512}
              zoomOffset={-1}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Amap">
            <TileLayer
              attribution='©2022 高德软件 <span id=\"mapCode\">GS(2021)6375号</span> - 甲测资字1100967'
              url="http://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"
              tileSize={256}
              maxZoom={18}
              subdomains={['1', '2', '3', '4']}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="RawTraj">
            <Polyline pathOptions={getPathOptions('RawTraj')} positions={rawTraj} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="LCSS" checked={true}>
            <Polyline pathOptions={getPathOptions()} positions={commonPolylines} />
          </LayersControl.Overlay>
        </LayersControl>
        <MyComponent
          matchingMethods={matchingMethods}
          layersControlRef={layersControlRef}
          bounds={mapBounds}
        />
      </MapContainer>
    </div>
  );
}

function MyComponent(props: {
  matchingMethods: MatchingMethodDetail[];
  layersControlRef: React.MutableRefObject<any>;
  bounds: LatLngBoundsExpression;
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(props.bounds);
  }, [map, props.bounds]);

  useEffect(() => {
    const { layersControlRef, matchingMethods } = props;
    const matchingGroups: (L.LayerGroup | L.Polyline)[] = [];
    matchingMethods.forEach((method) => {
      const matchingGroup = L.layerGroup();
      method.unmatched_trajs.forEach((subTraj) => {
        let latlngs = subTraj.trajectory.map((point) => {
          return {
            lat: point.latitude,
            lng: point.longitude,
          } as LatLngExpression;
        });
        L.polyline(latlngs, getPathOptions(method.name)).bindPopup(subTraj.id).addTo(matchingGroup);
      });
      layersControlRef.current.addOverlay(matchingGroup, method.name);
      matchingGroups.push(matchingGroup);
      // let rawLatlngs = method.raw_traj.map((point) => {
      //   return {
      //     lat: point.latitude,
      //     lng: point.longitude,
      //   } as LatLngExpression;
      // });
      // let rawPolyline = L.polyline(rawLatlngs, getPathOptions(method.name, 0.3)).bindPopup(
      //   method.name
      // );
      // layersControlRef.current.addOverlay(rawPolyline, `${method.name}Raw`);
      // matchingGroups.push(rawPolyline);
    });
    return () => {
      matchingGroups.forEach((matchingGroup) => {
        layersControlRef.current.removeLayer(matchingGroup);
      });
    };
  });

  console.log('map center:', map.getCenter());
  return null;
}
