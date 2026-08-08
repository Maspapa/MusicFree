import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import SeekBar from "./seekBar";
import PlayControl from "./playControl";
import useOrientation from "@/hooks/useOrientation";
import LyricLineModeSwitch from "./lyricLineModeSwitch";

export default function Bottom() {
    const orientation = useOrientation();
    return (
        <View
            style={[
                style.wrapper,
                orientation === "horizontal"
                    ? {
                        height: rpx(204),
                    }
                    : undefined,
            ]}>
            <SeekBar />
            <LyricLineModeSwitch />
            <PlayControl />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(240),
    },
});
