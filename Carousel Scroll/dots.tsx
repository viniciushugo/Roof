import React, { FC } from "react";
import { View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

// alma-onboarding-carousel-animation 🔽

interface DotsProps {
  numberOfDots: number; // Dynamic dot count for responsive pagination
  activeIndex: SharedValue<number>; // Shared value drives color transitions across all dots
}

export const Dots: FC<DotsProps> = ({ numberOfDots, activeIndex }) => {
  return (
    <View className="flex-row items-center justify-center gap-1">
      {Array.from({ length: numberOfDots }, (_, index) => (
        <Dot key={index} index={index} activeIndex={activeIndex} />
      ))}
    </View>
  );
};

interface DotProps {
  index: number; // Dot position for active state comparison
  activeIndex: SharedValue<number>; // Shared carousel state for color animation
}

const Dot: FC<DotProps> = ({ index, activeIndex }) => {
  // Animated color transition based on active carousel state
  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = withTiming(
      activeIndex.get() === index ? "#3C5627" : "#d6d3d1", // Active: Alma green, Inactive: neutral gray
      {
        duration: 200, // 200ms timing matches carousel page transition feel
      }
    );

    return {
      backgroundColor,
    };
  });

  return <Animated.View className="w-2 h-2 rounded-full" style={animatedStyle} />;
};

// alma-onboarding-carousel-animation 🔼
