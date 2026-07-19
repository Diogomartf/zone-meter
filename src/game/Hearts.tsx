import { StyleSheet, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';

type Props = {
  lives: number;
  max?: number;
};

function Heart({ filled }: { filled: boolean }) {
  const fill = filled ? '#FF3B4A' : 'transparent';
  const gloss = filled ? 'rgba(255,255,255,0.45)' : 'transparent';
  const border = filled ? '#C2182B' : 'rgba(26,28,44,0.28)';

  return (
    <View style={styles.heartWrap}>
      <View style={[styles.lobe, styles.lobeL, { backgroundColor: fill, borderColor: border }]} />
      <View style={[styles.lobe, styles.lobeR, { backgroundColor: fill, borderColor: border }]} />
      <View style={[styles.point, { backgroundColor: fill, borderColor: border }]} />
      {filled ? <View style={[styles.gloss, { backgroundColor: gloss }]} /> : null}
    </View>
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

const SIZE = 20;

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  heartWrap: {
    width: SIZE,
    height: SIZE,
  },
  lobe: {
    position: 'absolute',
    top: 0,
    width: SIZE * 0.56,
    height: SIZE * 0.56,
    borderRadius: SIZE,
    borderWidth: 1.5,
  },
  lobeL: { left: 0 },
  lobeR: { right: 0 },
  point: {
    position: 'absolute',
    top: SIZE * 0.26,
    left: SIZE * 0.12,
    width: SIZE * 0.76,
    height: SIZE * 0.76,
    borderRadius: 3,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  gloss: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 5,
    height: 5,
    borderRadius: 999,
  },
});
