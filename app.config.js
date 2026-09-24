module.exports = ({ config }) => {
  // GitHub Pages용 baseUrl은 웹 export에만 필요하다.
  // EAS 네이티브 빌드에서는 에셋 경로를 깨뜨려 archive가 실패하므로 제거한다.
  if (process.env.EAS_BUILD === 'true' && config.experiments) {
    const { baseUrl, ...rest } = config.experiments;
    return { ...config, experiments: rest };
  }
  return config;
};
