import { useWindowDimensions } from "react-native";

// 600 is the usual dp cutoff between phones and tablets (Android's "sw600dp",
// iPad mini is 744 wide in portrait). Uses the shorter side so a phone turned
// sideways is still a phone.
const TABLET_MIN_SHORT_SIDE = 600;

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;
}

// Phone-sized text looks small on a tablet held at arm's length, so senior
// screens read about a quarter larger there before the family's own text-size
// setting is applied on top.
export const TABLET_TEXT_BOOST = 1.25;
// Ceiling for the combined result so the biggest family setting on a tablet
// can't blow layouts apart.
export const MAX_TEXT_SCALE = 1.7;
