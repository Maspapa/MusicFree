import repeatModeConst from "@/constants/repeatModeConst";
import rpx from "@/utils/rpx";
import React from "react";
import { InteractionManager, StyleSheet, View } from "react-native";

import Icon from "@/components/base/icon.tsx";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";
import PlaybackNavigation from "@/core/playbackNavigation";
import LearningMode, { useLearningMode } from "@/core/learningMode";

export default function () {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();
    const learning = useLearningMode();
    const paused = learning.enabled ? !learning.speaking : musicIsPaused(musicState);

    const orientation = useOrientation();

    console.log(repeatMode, repeatModeConst[repeatMode]);

    return (
        <>
            <View
                style={[
                    style.wrapper,
                    orientation === "horizontal"
                        ? {
                            marginTop: 0,
                        }
                        : null,
                ]}>
                <Icon
                    color={learning.enabled && learning.loop ? "#66ccff" : "white"}
                    name={repeatModeConst[repeatMode].icon}
                    size={rpx(56)}
                    onPress={async () => {
                        if (learning.enabled) {
                            LearningMode.toggleLoop(); return;
                        }
                        InteractionManager.runAfterInteractions(async () => {
                            await delay(20, false);
                            TrackPlayer.toggleRepeatMode();
                        });
                    }}
                />
                <Icon
                    color={"white"}
                    name={"skip-left"}
                    size={rpx(56)}
                    onPress={() => {
                        PlaybackNavigation.previous();
                    }}
                />
                <Icon
                    color={"white"}
                    name={paused ? "play" : "pause"}
                    size={rpx(96)}
                    onPress={() => {
                        if (learning.enabled) {
                            void LearningMode.toggle(); return;
                        }
                        if (musicIsPaused(musicState)) {
                            TrackPlayer.play();
                        } else {
                            TrackPlayer.pause();
                        }
                    }}
                />
                <Icon
                    color={"white"}
                    name={"skip-right"}
                    size={rpx(56)}
                    onPress={() => {
                        PlaybackNavigation.next();
                    }}
                />
                <Icon
                    color={"white"}
                    name={"playlist"}
                    size={rpx(56)}
                    onPress={() => {
                        showPanel("PlayList");
                    }}
                />
            </View>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginTop: rpx(16),
        height: rpx(100),
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
});
