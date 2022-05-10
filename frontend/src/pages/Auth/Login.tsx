import React from 'react';
import { api } from '@services/api';
import { tokenManager } from '@utils/tokenManager';
import toast from 'react-hot-toast';
import appConfig from '@/config/app.config';
import { useNavigate } from 'react-router-dom';
import log from '@middleware/logger';

export default function Login() {
  const from = sessionStorage.getItem(appConfig.local_storage.auth.from) || '/';
  const navigate = useNavigate();

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let formData = new FormData(event.currentTarget);
    let username = formData.get('username') as string;
    let password = formData.get('password') as string;
    api.user.login({ username: username, password: password }).then((data) => {
      if (data.status_code === 40102) {
        toast.error('用户名或密码错误', { id: 'login-failed' });
      } else {
        data.access_token && tokenManager.setToken(data.access_token);
        navigate(from, { replace: true });
      }
    });
  };

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let formData = new FormData(event.currentTarget);
    let username = formData.get('username') as string;
    let password = formData.get('password') as string;
    api.user.register(username, password).then((data) => {
      toast('注册成功');
    });
  };

  // login
  return (
    <div className="flex h-screen w-screen items-center justify-center space-x-10">
      <form onSubmit={handleRegister} className="card max-w-xs shadow-lg dark:bg-slate-700">
        <div className="card-body">
          <label>
            Username
            <input type="text" name="username" className="input w-full" />
          </label>
          <label>
            Password
            <input type="password" name="password" className="input w-full" />
          </label>
          <div className="card-actions mt-1 w-full">
            <button className="btn btn-primary w-full" type="submit">
              Register
            </button>
          </div>
        </div>
      </form>
      <form onSubmit={handleLogin} className="card max-w-xs shadow-lg dark:bg-slate-700">
        <div className="card-body">
          <label>
            Username
            <input type="text" name="username" className="input w-full" />
          </label>
          <label>
            Password
            <input type="password" name="password" className="input w-full" />
          </label>
          <div className="card-actions mt-1 grid w-full grid-cols-2">
            <button className="btn btn-primary" type="submit">
              Login
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                api.user.getUserInfo().then((data) => {
                  log.info(data.detail);
                });
              }}
            >
              Check Me
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
