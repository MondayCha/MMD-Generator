/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:23
 * @Description:
 */
import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
// import loadable from '@loadable/component';
// Loading Page
// import Loading from '@/pages/Loading';

/**
 * Lazy loading components.
 * @example(non server-side render): const Component = React.lazy(() => import('./Component'));
 */
const Home = lazy(() => import('@pages/Home'));
const Deck = lazy(() => import('@pages/Deck'));
const Annotation = lazy(() => import('@pages/Annotation'));
const AdminUpload = lazy(() => import('@pages/Admin/Upload'));

export const routerConfig: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/deck/:taskId/:trajName',
    element: <Deck />,
  },
  {
    path: '/annotations/:taskId/:trajName',
    element: <Annotation />,
  },
  {
    path: '/admin/upload',
    element: <AdminUpload />,
  },
  {
    path: '/admin/upload/:taskId',
    element: <AdminUpload />,
  },
];

export default routerConfig;
