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
    api.user
      .register({ username: username, password: password })
      .then((data) => {
        toast('注册成功');
      })
      .catch((err) => {
        toast.error(err.message, { id: 'register-failed' });
      });
  };

  // login
  return (
    <div className="h-screen">
      <form onSubmit={handleLogin}>
        <input type="text" name="username" />
        <input type="password" name="password" />
        <button className="btn btn-primary" type="submit">
          Login
        </button>
      </form>
      <form onSubmit={handleRegister}>
        <input type="text" name="username" />
        <input type="password" name="password" />
        <button className="btn btn-primary" type="submit">
          Register
        </button>
      </form>
      <button
        className="btn btn-primary"
        onClick={() => {
          api.user.getUser().then((data) => {
            log.info(data.detail);
          });
        }}
      >
        Me
      </button>
    </div>
  );
}
