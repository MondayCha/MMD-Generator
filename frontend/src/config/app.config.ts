const appConfig = {
  locale: {
    default_locale: 'en',
  },
  local_storage: {
    auth: {
      token: 'config.auth.token',
      from: 'config.auth.from',
      info: 'config.auth.info',
    },
    uuid: 'config.uuid',
    locale: 'config.locale',
    pre_annotation: {
      auto_merge_circle: 'config.pre_annotation.auto_merge_circle',
      disable_st_matching: 'config.pre_annotation.disable_st_matching',
    },
    animation: {
      speed: 'config.animation.speed',
      length: 'config.animation.length',
    }
  },
};

export default appConfig;
