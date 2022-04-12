import * as React from 'react';
import { useState, useCallback } from 'react';
import { render } from 'react-dom';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MarkerDragEvent, LngLat } from 'react-map-gl';

const ICON = `M20.2,15.7L20.2,15.7c1.1-1.6,1.8-3.6,1.8-5.7c0-5.6-4.5-10-10-10S2,4.5,2,10c0,2,0.6,3.9,1.6,5.4c0,0.1,0.1,0.2,0.2,0.3
  c0,0,0.1,0.1,0.1,0.2c0.2,0.3,0.4,0.6,0.7,0.9c2.6,3.1,7.4,7.6,7.4,7.6s4.8-4.5,7.4-7.5c0.2-0.3,0.5-0.6,0.7-0.9
  C20.1,15.8,20.2,15.8,20.2,15.7z`;

const pinStyle = {
  fill: '#d00',
  stroke: 'none',
};

function Pin(props) {
  const { size = 20 } = props;

  return (
    <svg height={size} viewBox="0 0 24 24" style={pinStyle}>
      <path d={ICON} />
    </svg>
  );
}

const TOKEN =
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'; // Set your mapbox token here

const initialViewState = {
  latitude: 40,
  longitude: -100,
  zoom: 3.5,
};

export default function App() {
  const [marker, setMarker] = useState({
    latitude: 40,
    longitude: -100,
  });
  const [events, logEvents] = useState<Record<string, LngLat>>({});

  const onMarkerDragStart = useCallback((event: MarkerDragEvent) => {
    logEvents((_events) => ({ ..._events, onDragStart: event.lngLat }));
  }, []);

  const onMarkerDrag = useCallback((event: MarkerDragEvent) => {
    logEvents((_events) => ({ ..._events, onDrag: event.lngLat }));

    setMarker({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat,
    });
  }, []);

  const onMarkerDragEnd = useCallback((event: MarkerDragEvent) => {
    logEvents((_events) => ({ ..._events, onDragEnd: event.lngLat }));
  }, []);

  return (
    <div className="absolute w-full h-full">
      <Map
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/dark-v9"
        mapboxAccessToken={TOKEN}
      >
        <Marker
          longitude={marker.longitude}
          latitude={marker.latitude}
          anchor="bottom"
          draggable
          onDragStart={onMarkerDragStart}
          onDrag={onMarkerDrag}
          onDragEnd={onMarkerDragEnd}
        >
          <Pin size={20} />
        </Marker>

        <NavigationControl />
      </Map>
    </div>
  );
}
