import { useWindowDimensions } from 'react-native';

// 짧은 변을 폰 기준(430)으로 나눈 UI 스케일 — 폰은 1.0 유지, 태블릿·데스크톱은 최대 1.5배
export const getUiScale = (width, height) => {
  const base = Math.min(width, height) || 390;
  return Math.min(Math.max(base / 430, 1), 1.5);
};

// 텍스트는 레이아웃보다 완만하게 키운다 — 최대 약 1.25배
export const scaleFont = (size, scale) => Math.round(size * (1 + (scale - 1) * 0.5));

export const useUiScale = () => {
  const { width, height } = useWindowDimensions();
  return getUiScale(width, height);
};

// 태블릿 이상에서 콘텐츠를 중앙으로 모으는 최대 폭 — 폰은 그대로 전체 폭 사용
export const getContentMaxWidth = (width, scale) => (
  scale > 1 ? Math.min(Math.round(width * 0.85), Math.round(640 * scale)) : width
);

export const useContentMaxWidth = () => {
  const { width, height } = useWindowDimensions();
  return getContentMaxWidth(width || 0, getUiScale(width, height));
};
