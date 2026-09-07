function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React from 'react';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { Gradient } from '../Components/Gradient';
const shadowColors = ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'];
const BookSpine2 = ({
  right,
  degrees
  // containerSize,
}) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(Math.abs(degrees.value), [0, 150, 180], [0, 0, 0.65]);
    return {
      opacity
    };
  });
  const position1 = right ? {
    start: {
      x: 1,
      y: 0
    },
    end: {
      x: 0,
      y: 0
    }
  } : {
    start: {
      x: 0,
      y: 0
    },
    end: {
      x: 1,
      y: 0
    }
  };
  const position2 = !right ? {
    start: {
      x: 1,
      y: 0
    },
    end: {
      x: 0,
      y: 0
    }
  } : {
    start: {
      x: 0,
      y: 0
    },
    end: {
      x: 1,
      y: 0
    }
  };
  return /*#__PURE__*/React.createElement(Animated.View, {
    pointerEvents: "none",
    style: [{
      position: 'absolute',
      height: '100%',
      width: '100%',
      zIndex: 1000,
      flexDirection: 'row'
    }, style]
  }, /*#__PURE__*/React.createElement(Gradient, _extends({}, position1, {
    colors: shadowColors,
    style: {
      width: '100%',
      height: '100%'
    }
  })), /*#__PURE__*/React.createElement(Gradient, _extends({}, position2, {
    colors: shadowColors,
    style: [{
      width: '100%',
      height: '100%',
      position: 'absolute'
    }, right ? {
      left: '100%'
    } : {
      right: '100%'
    }]
  })));
};
export { BookSpine2 };
