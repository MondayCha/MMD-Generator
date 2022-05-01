/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:23
 * @Description: Router and Alert Container View
 */
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
