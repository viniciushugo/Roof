import { View } from "react-native";
import { SharedValue, useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import type { FC } from "react";

import { AnimatedChar } from "./animated-char";
import React from "react";
import { scheduleOnRN } from "react-native-worklets";

// alma-onboarding-carousel-animation 🔽

type Props = {
  text: string; // Text content to animate character by character
  activeIndex: SharedValue<number>; // Current carousel state for visibility control
  showIndex: number[]; // Array of carousel indices where this text should be visible
};

export const StaggeredText: FC<Props> = ({ text, activeIndex, showIndex }: Props) => {
  // Animation progress shared value: 0 = hidden, 1 = fully visible
  const progress = useSharedValue(0);

  // Trigger staggered character animation with delay
  const show = () => {
    if (progress.value === 1) return; // Prevent duplicate animations
    setTimeout(() => {
      progress.value = 1; // Start character cascade animation
    }, 250); // 250ms delay allows carousel transition to settle
  };

  // React to carousel changes and control text visibility
  useAnimatedReaction(
    () => activeIndex.get(),
    (value) => {
      if (showIndex.includes(value)) {
        // Current carousel state matches this text's display indices
        scheduleOnRN(show); // Bridge to JS thread for setTimeout
      } else {
        // Hide text immediately when not in display range
        progress.value = 0;
      }
    }
  );

  return (
    <View className="flex-row flex-wrap">
      {text.split("").map((char, index) => (
        <React.Fragment key={index}>
          <AnimatedChar
            char={char}
            index={index} // Character position for stagger timing
            totalCount={text.length} // Total characters for animation calculations
            progress={progress} // Shared animation trigger
          />
        </React.Fragment>
      ))}
    </View>
  );
};

// alma-onboarding-carousel-animation 🔼
