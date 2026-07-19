import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  color?: string;
  outlineColor?: string;
  outlineWidth?: number;
};

const OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

export function OutlineText({
  children,
  style,
  color = GameColors.white,
  outlineColor = GameColors.ink,
  outlineWidth = 2,
}: Props) {
  return (
    <View>
      {OFFSETS.map(([x, y], i) => (
        <Text
          key={i}
          style={[
            styles.base,
            style,
            {
              position: 'absolute',
              left: x * outlineWidth,
              top: y * outlineWidth,
              color: outlineColor,
            },
          ]}>
          {children}
        </Text>
      ))}
      <Text style={[styles.base, style, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: GameFonts.display,
    textAlign: 'center',
  },
});
