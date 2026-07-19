import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';

type Props = {
  lives: number;
  max?: number;
};

const HEART_FILLED = require('@/assets/images/heart-filled.png');
const HEART_EMPTY = require('@/assets/images/heart-empty.png');

function Heart({ filled }: { filled: boolean }) {
  return (
    <Image
      source={filled ? HEART_FILLED : HEART_EMPTY}
      style={styles.heart}
      contentFit="contain"
    />
  );
}

export function Hearts({ lives, max = 3 }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} filled={i < lives} />
      ))}
    </View>
  );
}

const SIZE = 24;

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heart: {
    width: SIZE,
    height: SIZE,
  },
});
