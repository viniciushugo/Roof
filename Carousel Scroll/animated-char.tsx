import { FC } from "react";
import { Text } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

// alma-onboarding-carousel-animation 🔽

type Props = {
  char: string; // Individual character to animate
  index: number; // Character position in text for stagger timing calculation
  totalCount: number; // Total character count for dynamic animation scaling
  progress: SharedValue<number>; // Global animation trigger (0-1)
};

export const AnimatedChar: FC<Props> = ({ index, char, progress, totalCount }) => {
  // Individual character animation progress with staggered timing
  const charProgress = useDerivedValue(() => {
    const delayMs = index * 10; // 10ms delay per character for cascade effect

    return withDelay(
      delayMs,
      withSpring(progress.value, {
        damping: 100, // Low damping for bouncy, playful character entrance
        stiffness: 1400, // High stiffness for quick, snappy animation
      })
    );
  }, []);

  // Combine multiple animation properties for rich character entrance
  const rContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: charProgress.get(), // Fade in from 0 to 1
      transform: [
        {
          // Subtle horizontal slide for natural text flow
          translateX: interpolate(charProgress.get(), [0, 1], [-1, 0]),
        },
        {
          // Dynamic vertical movement - earlier characters start higher
          translateY: interpolate(
            charProgress.get(),
            [0, 1],
            [16 - index * (8 / Math.max(totalCount - 1, 1)), 0] // Range: 16px to 8px based on position
          ),
        },
        {
          // Scale animation for bouncy entrance effect
          scale: interpolate(charProgress.get(), [0, 1], [0.8, 1]),
        },
      ],
    };
  });

  return (
    <Animated.View style={rContainerStyle}>
      <Text className="text-3xl font-semibold" style={{ fontFamily: "LibreBaskerville_700Bold" }}>
        {char}
      </Text>
    </Animated.View>
  );
};

// alma-onboarding-carousel-animation 🔼
