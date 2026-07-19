import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  color?: string;
  /** Kept for API compat — soft shadow only, no stacked black glyphs */
  outlineColor?: string;
  outlineWidth?: number;
};

/** Punchy game text without black outline ghost layers. */
export function OutlineText({
  children,
  style,
  color = GameColors.white,
  outlineWidth = 2,
}: Props) {
  return (
    <Text
      style={[
        styles.base,
        style,
        {
          color,
          textShadowColor: 'rgba(0,0,0,0.28)',
          textShadowOffset: { width: 0, height: Math.max(1, outlineWidth - 1) },
          textShadowRadius: outlineWidth + 1,
        },
      ]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: GameFonts.display,
    textAlign: 'center',
  },
});
