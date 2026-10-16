import React from "react";
import { StyleSheet, Text, View } from "react-native";
import LearningMode, { useLearningMode } from "@/core/learningMode";
import rpx from "@/utils/rpx";
import SeekBar from "./seekBar";
import PlayControl from "./playControl";
import useOrientation from "@/hooks/useOrientation";
import LyricLineModeSwitch from "./lyricLineModeSwitch";
import { learningLanguageLabels } from "@/utils/learningLyrics";

export default function Bottom() {
    const learning = useLearningMode();
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
            {learning.enabled ? <Text style={{ color: "white", textAlign: "center", fontSize: rpx(22) }}>第 {learning.index + 1} / {LearningMode.count} 句 · {learningLanguageLabels[learning.languageChoice]}慢速跟读</Text> : <SeekBar />}
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
