import { FC, memo } from "react";
import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { NutrientsItem } from "../../routes/nutrients";

// alma-nutrients-circular-carousel-animation 🔽

// Angle step divides full circle (2π) into 9.5 segments
// 9.5 creates slightly tighter spacing than 9, preventing overlap
// Each item occupies ~37.9° arc, allowing ~5 visible items at once
const ANGLE_STEP = (2 * Math.PI) / 9.5;

// Lighter spring config for background element fade/scale animation
// Lower damping (40) allows subtle bounce on background reveal
// Reduced stiffness (200) creates gentler entrance than carousel movement
const SPRING_CONFIG = {
  damping: 40,
  stiffness: 200,
  mass: 4.5,
};

type Props = {
  index: number;
  slide: NutrientsItem;
  currentIndex: SharedValue<number>;
  animatedIndex: SharedValue<number>;
  radius: number;
};

const CarouselItem: FC<Props> = ({ slide, index, currentIndex, animatedIndex, radius }) => {
  // Tracks item height for vertical centering on circular path
  // Measured via onLayout to account for dynamic content sizing
  const itemHeight = useSharedValue(0);

  // Performance optimization: only animate items within ±2 index range
  // Items outside this range are hidden (opacity 0) and skip transform calculations
  // Reduces worklet execution from all items to ~5 visible items
  const isCircleAnimationRange = useDerivedValue(() => {
    return currentIndex.get() - 2 <= index && currentIndex.get() + 2 >= index;
  });

  // Interpolates item's angle on circular path based on scroll position
  // Input: animatedIndex relative to this item's index (±2 range)
  // Output: angle in radians, clamped to prevent extrapolation artifacts
  // Base angle (-π/2) starts items at top of circle, rotating clockwise
  const angle = useDerivedValue(() => {
    const baseAngle = -Math.PI / 2;

    return interpolate(
      animatedIndex.get(),
      [index - 2, index - 1, index, index + 1, index + 2],
      [
        baseAngle - ANGLE_STEP * 2,
        baseAngle - ANGLE_STEP,
        baseAngle,
        baseAngle + ANGLE_STEP,
        baseAngle + ANGLE_STEP * 2,
      ],
      Extrapolation.CLAMP
    );
  });

  // Horizontal position on circular path using cosine
  // Negative cosine moves items left as angle increases (clockwise rotation)
  // Only calculated when item is in visible range for performance
  const translateX = useDerivedValue(() => {
    if (!isCircleAnimationRange.get()) {
      return 0;
    }
    return -radius * Math.cos(angle.get());
  });

  // Vertical position on circular path using sine
  // Positive sine moves items down (bottom half of circle)
  // itemHeight/2 offset centers item vertically on its circular position
  const translateY = useDerivedValue(() => {
    if (!isCircleAnimationRange.get()) {
      return 0;
    }
    return radius * Math.sin(angle.get()) + itemHeight.get() / 2;
  });

  // Scale interpolation: center item at 100%, adjacent items at 75%
  // Creates depth effect where focused item appears larger
  // Input range: [index-1, index, index+1] maps to [0.75, 1, 0.75]
  // Clamped to prevent scale values outside intended range
  const scale = useDerivedValue(() => {
    return interpolate(
      animatedIndex.get(),
      [index - 1, index, index + 1],
      [0.75, 1, 0.75],
      Extrapolation.CLAMP
    );
  });

  // Rotation keeps item text upright as it moves along circular path
  // Negative angle counteracts circular rotation, -π/2 aligns with vertical
  // Only calculated when visible to avoid unnecessary worklet execution
  const rotation = useDerivedValue(() => {
    if (!isCircleAnimationRange.get()) {
      return 0;
    }
    return -angle.get() - Math.PI / 2;
  });

  // Opacity culling: hide items outside visible range
  // Prevents rendering off-screen items, improving performance
  const opacity = useDerivedValue(() => {
    if (!isCircleAnimationRange.get()) {
      return 0;
    }
    return 1;
  });

  // Combined animated style applies all circular path transformations
  // Transform order matters: translate → scale → rotate preserves visual correctness
  // All values derived from shared animatedIndex, ensuring synchronized motion
  const rContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.get(),
      transform: [
        { translateX: translateX.get() },
        { translateY: translateY.get() },
        { scale: scale.get() },
        { rotate: `${rotation.get()}rad` },
      ],
    };
  });

  // Tracks if this item is the currently focused slide
  // Used to trigger background element reveal animation
  const isCurrent = useDerivedValue(() => {
    return currentIndex.get() === index;
  });

  // Background element fades and scales in when item becomes current
  // Spring animation creates smooth reveal/hide transition
  // Opacity and scale synchronized to same targetValue for cohesive effect
  const rBackgroundElementContainerStyle = useAnimatedStyle(() => {
    const targetValue = isCurrent.get() ? 1 : 0;

    return {
      opacity: withSpring(targetValue, SPRING_CONFIG),
      transform: [{ scale: withSpring(targetValue, SPRING_CONFIG) }],
    };
  });

  return (
    // Animated.createAnimatedComponent enables Reanimated worklets on View
    // Allows transform/opacity animations to run on UI thread (60fps)
    // See: https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent
    <Animated.View
      className="absolute w-[60%] aspect-[1/0.7]"
      style={[{ borderCurve: "continuous" }, rContainerStyle]}
      // Measure height once for vertical centering calculation
      // Height needed to offset translateY so item centers on circular path
      onLayout={(event) => {
        itemHeight.set(event.nativeEvent.layout.height);
      }}
    >
      <Animated.View
        className="absolute inset-0 justify-center items-center"
        style={rBackgroundElementContainerStyle}
      >
        {slide.backgroundElement}
      </Animated.View>
      <View className="flex-1 rounded-[36px] px-4 bg-white items-center justify-center shadow-lg shadow-black/5">
        <Text className="text-4xl mb-2">{slide.emoji}</Text>
        <Text className="text-2xl font-medium text-center">{slide.description}</Text>
      </View>
    </Animated.View>
  );
};

CarouselItem.displayName = "CarouselItem";

// memo prevents re-renders when parent updates but props unchanged
// Critical for performance: carousel renders many items, memo reduces React overhead
// Props comparison ensures items only update when their animation values change
export default memo(CarouselItem);

// alma-nutrients-circular-carousel-animation 🔼
