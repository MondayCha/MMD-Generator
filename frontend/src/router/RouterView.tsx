/**
 * @description: Router and Alert Container View
 */
import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routerConfig from './router.config';
import { ThemeProvider } from '@components/theme';
import AlertContainer from '@components/alert/AlertContainer';

function RouterView() {
  const AppRoutes = () => useRoutes(routerConfig);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <AlertContainer />
    </ThemeProvider>
  );
}

export default RouterView;
