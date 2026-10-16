import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import { useTextScale } from "@/context/TextScaleContext";

// Drop-in replacement for RN's Text on senior-facing screens: multiplies
// whatever fontSize (and lineHeight, so enlarged text isn't clipped) the
// caller's stylesheet already sets by the family's chosen text scale, so
// screens don't need their styles rewritten.
export default function ScaledText({ style, ...props }: TextProps) {
  const scale = useTextScale();
  const flattened = StyleSheet.flatten(style);
  const fontSize = flattened?.fontSize ?? 17;
  const lineHeight = flattened?.lineHeight;
  return (
    <RNText
      {...props}
      style={[style, { fontSize: fontSize * scale }, lineHeight ? { lineHeight: lineHeight * scale } : null]}
    />
  );
}
