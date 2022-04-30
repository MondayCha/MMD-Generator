/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:23
 * @Description:
 */
import React from 'react';
import { RouteObject } from 'react-router-dom';
// import loadable from '@loadable/component';
// Loading Page
// import Loading from '@/pages/Loading';

/**
 * Lazy loading components.
 * @example(non server-side render): const Component = React.lazy(() => import('./Component'));
 */
const Home = React.lazy(() => import('@pages/Home'));
const Deck = React.lazy(() => import('@pages/Deck'));
const Annotation = React.lazy(() => import('@pages/Annotation'));

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
    path: '/deck/:taskId/:trajName',
    element: <Deck />,
  },
  {
    path: '/annotation/:taskId/:trajName',
    element: <Annotation />,
  },
];

export default routerConfig;
