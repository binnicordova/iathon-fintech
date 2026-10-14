import {useEffect, useState} from "react";
import {Dimensions, Keyboard, LayoutAnimation, Platform} from "react-native";

const IOS = Platform.OS === "ios";

const glide = (duration?: number) => {
    if (IOS) {
        LayoutAnimation.configureNext({
            duration: duration ?? 250,
            update: {type: LayoutAnimation.Types.keyboard},
        });
    }
};

/**
 * The on-screen keyboard. `height` is how much of the screen it covers (0 when
 * hidden). Use `inset` as bottom padding: Android is edge-to-edge too (the
 * window no longer resizes for the keyboard), and web has no soft keyboard.
 */
export const useKeyboard = () => {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        const subscriptions = IOS
            ? [
                  Keyboard.addListener("keyboardWillChangeFrame", (event) => {
                      glide(event.duration);
                      // Distance from the keyboard's top edge to the bottom of the
                      // screen: also right for the predictive bar and short keyboards.
                      setHeight(
                          Math.max(
                              0,
                              Dimensions.get("screen").height -
                                  event.endCoordinates.screenY
                          )
                      );
                  }),
                  Keyboard.addListener("keyboardWillHide", (event) => {
                      glide(event.duration);
                      setHeight(0);
                  }),
              ]
            : [
                  Keyboard.addListener("keyboardDidShow", (event) =>
                      setHeight(event.endCoordinates.height)
                  ),
                  Keyboard.addListener("keyboardDidHide", () => setHeight(0)),
              ];
        return () => {
            for (const subscription of subscriptions) {
                subscription.remove();
            }
        };
    }, []);

    return {visible: height > 0, height, inset: height};
};
