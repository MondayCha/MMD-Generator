/*
 * @Author: MondayCha
 * @Date: 2022-04-08 13:36:23
 * @Description: Router and Alert Container View
 */
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routerConfig from './router.config';
import { ThemeProvider } from '@components/theme';
import AlertContainer from '@components/alert/AlertContainer';
import { Suspense } from 'react';

function RouterView() {
  const AppRoutes = () => useRoutes(routerConfig);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex h-screen w-screen items-center justify-center">
              <svg
                className="my-2 h-16 w-16 animate-[spin_1.5s_linear_infinite] text-primary dark:text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-10"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          }
        >
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
      <AlertContainer />
    </ThemeProvider>
  );
}

export default RouterView;
