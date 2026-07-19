import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { GameColors } from '@/constants/gameTheme';

type Props = {
  lives: number;
  max?: number;
};

/** Classic smooth heart (Material-style path), viewBox 0 0 24 24 */
const HEART_D =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

function Heart({ filled, id }: { filled: boolean; id: string }) {
  const gradId = `heartFill-${id}`;
  return (
    <View style={styles.heartWrap}>
      <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
        {filled ? (
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF6B78" />
              <Stop offset="0.55" stopColor="#FF3B4A" />
              <Stop offset="1" stopColor="#E0182C" />
            </LinearGradient>
          </Defs>
        ) : null}
        <Path
          d={HEART_D}
          fill={filled ? `url(#${gradId})` : 'rgba(255,255,255,0.35)'}
          stroke={filled ? GameColors.ink : 'rgba(26,28,44,0.35)'}
          strokeWidth={filled ? 1.6 : 1.8}
          strokeLinejoin="round"
        />
        {filled ? (
          <Path
            d="M8.2 7.2c.9-.9 2.2-1.15 3.1-.55"
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

export function Hearts({ lives, max = 3 }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} id={String(i)} filled={i < lives} />
      ))}
    </View>
  );
}

const SIZE = 22;

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heartWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
