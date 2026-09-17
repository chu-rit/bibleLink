function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { Gradient } from '../Components/Gradient';
const colors = ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)'];
const rightPosition = {
  start: {
    x: 0.5,
    y: 0
  },
  end: {
    x: 1,
    y: 0
  }
};
const leftPosition = {
  start: {
    x: 0.5,
    y: 0
  },
  end: {
    x: 0,
    y: 0
  }
};
const BackShadow = ({
  degrees,
  right
}) => {
  const position = right ? rightPosition : leftPosition;
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(Math.abs(degrees.value), [0, 130, 180], [1, 0.5, 0]);
    return {
      opacity
    };
  });
  return /*#__PURE__*/React.createElement(Animated.View, {
    pointerEvents: "none",
    style: [{
      ...StyleSheet.absoluteFillObject,
      zIndex: 4
    }, animatedStyle]
  }, /*#__PURE__*/React.createElement(Gradient, _extends({}, position, {
    colors: colors,
    style: {
      ...StyleSheet.absoluteFillObject
    }
  })));
};
export default BackShadow;
