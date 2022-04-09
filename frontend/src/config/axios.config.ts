let hostUrl: string;
switch (process.env.NODE_ENV) {
  case 'development':
    hostUrl = 'http://localhost:8000';
    break;
  case 'production':
    hostUrl = 'http://localhost:8000';
    break;
  default:
    hostUrl = 'https://v1.hitokoto.cn';
    break;
}
export const HOST_URL = hostUrl;
