import log from 'loglevel';

if (process.env.NODE_ENV === 'production') {
  log.disableAll(false);
} else {
  log.setLevel('debug');
}

export default log;
