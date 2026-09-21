import PageFlipper from '@laffy1309/react-native-page-flipper';
import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { MANGA_PAGES } from '../utils/Constants';

// SDK 54 호환: native-base의 Box를 React Native View로 교체
const PortraitExample = ({}) => {
  return (
    <View style={styles.container}>
      <PageFlipper
        data={MANGA_PAGES}
        pageSize={{
          height: 334,
          width: 210,
        }}
        enabled={true}
        singleImageMode={true}
        portrait={true}
        pressable={true}
        contentContainerStyle={{
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
        renderPage={(data) => {
          return <View style={{ height: '100%', width: '100%', backgroundColor: data }} />;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

export { PortraitExample };
