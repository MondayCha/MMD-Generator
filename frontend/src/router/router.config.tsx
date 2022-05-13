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
const Annotation = lazy(() => import('@/pages/Annotation'));
const AnnotationReview = lazy(() => import('@/pages/Review'));
const Login = lazy(() => import('@pages/Auth/Login'));
const Review = lazy(() => import('@pages/Admin/Review'));
const Upload = lazy(() => import('@pages/Admin/Upload'));
const Output = lazy(() => import('@pages/Admin/Output'));

export const routerConfig: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/annotations/:groupHashid/:dataName',
    element: <Annotation />,
  },
  {
    path: '/reviews/:annotationHashid',
    element: <AnnotationReview />,
  },
  {
    path: '/admin',
    children: [
      {
        path: '/admin/review',
        element: <Review />,
      },
      {
        path: '/admin/upload',
        element: <Upload />,
      },

      {
        path: '/admin/upload/:groupHashid',
        element: <Upload />,
      },
      {
        path: '/admin/output',
        element: <Output />,
      },
    ],
  },
];

export default routerConfig;
