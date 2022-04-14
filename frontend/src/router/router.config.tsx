import React from 'react';
import { RouteObject } from 'react-router-dom';
// import loadable from '@loadable/component';
// Loading Page
// import Loading from '@/pages/Loading';

/**
 * Lazy loading components.
 * @example(non server-side render): const Component = React.lazy(() => import('./Component'));
 */
// const loadableFallback = { fallback: <Loading /> };
// const Home = loadable(() => import('@pages/Home'), loadableFallback);
// const Map = loadable(() => import('@pages/Map'), loadableFallback);

const Home = React.lazy(() => import('@pages/Home'));
const Map = React.lazy(() => import('@pages/Map'));
const Deck = React.lazy(() => import('@pages/Deck'));

export const routerConfig: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/home/:taskId',
    element: <Home />,
  },
  {
    path: '/map/:taskId/:trajName',
    element: <Map />,
  },
  {
    path: '/deck/:taskId/:trajName',
    element: <Deck />,
  },
];

export default routerConfig;
