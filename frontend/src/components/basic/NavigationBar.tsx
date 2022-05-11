import appConfig from '@/config/app.config';
import useFlooksStore from '@/hooks/useFlooksStore';
import useLocalStorage from '@/hooks/useLocalStorage';
import { api } from '@/services/api';
import { UserDetail } from '@/services/type';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Language, Moon, UserCircle } from 'tabler-icons-react';
import { useThemeContext } from '../theme';

const INIT_USER_INFO: UserDetail = {
  username: '',
  usertype: 1,
};

const NavigationBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { switchLocaleMode } = useFlooksStore();
  const { toggleTheme } = useThemeContext();
  const [user, setUser] = useLocalStorage<UserDetail>(
    appConfig.local_storage.auth.info,
    INIT_USER_INFO
  );
  useEffect(() => {
    api.user.getUserInfo().then(({ detail }) => {
      const { username, usertype } = detail as UserDetail;
      setUser({ username, usertype });
    });
  }, []);

  return (
    <div className="navbar border-b-2 bg-white px-6 dark:border-0 dark:bg-slate-700 dark:shadow lg:px-36">
      <div className="navbar-start">
        <a className="text-2xl font-bold normal-case text-black dark:text-white">{t('app.name')}</a>
      </div>
      <div className="navbar-end">
        <button className="btn btn-ghost btn-circle dark:text-gray-400" onClick={switchLocaleMode}>
          <Language />
        </button>
        <button className="btn btn-ghost btn-circle dark:text-gray-400" onClick={toggleTheme}>
          <Moon />
        </button>
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle dark:text-gray-400">
            <UserCircle />
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu rounded-box mt-4 w-52 border-2 bg-base-100 p-2 dark:border-0 dark:shadow"
          >
            <div className="card-body m-2 flex flex-col items-stretch justify-between p-0">
              {/* <h3 className="card-title w-full">{user.username}</h3> */}
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
                Annotate
              </button>
              {user.usertype === 0 && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/admin/upload')}
                  >
                    Upload
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/admin/review')}
                  >
                    Review
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/admin/output')}
                  >
                    Output
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  api.user.logout().then((r) => {
                    api.user.getUserInfo();
                  });
                }}
              >
                Logout
              </button>
            </div>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NavigationBar;
