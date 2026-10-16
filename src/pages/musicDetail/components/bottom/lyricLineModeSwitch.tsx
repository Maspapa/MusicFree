import ThemeSwitch from "@/components/base/switch";
import { useLyricState } from "@/core/lyricManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import LearningMode, { useLearningMode } from "@/core/learningMode";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function LyricLineModeSwitch() {
    const learning = useLearningMode();
    const { loading, lyrics, meta } = useLyricState();
    const music = useCurrentMusic();
    const identity = String(music?.platform) + ":" + String(music?.id);
    const previousIdentity = useRef(identity);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (previousIdentity.current !== identity || loading || !lyrics.some(item => item.lrc.trim())) {
            void LearningMode.exit();
        }
        previousIdentity.current = identity;
    }, [identity, loading, lyrics]);

    async function change(enabled: boolean) {
        if (busy) return;
        if (enabled && loading) {
            Toast.warn("歌词仍在加载，请稍后再试"); return;
        }
        setBusy(true);
        try {
            if (enabled) await LearningMode.enter(lyrics, +(meta?.offset ?? 0));
            else await LearningMode.exit();
        } catch {
            Toast.warn("无法开启朗读，请检查系统语音引擎");
        } finally {
            setBusy(false);
        }
    }
    return <View style={styles.wrapper}>
        <Text style={styles.label}>学习模式</Text>
        <ThemeSwitch value={learning.enabled} onValueChange={value => {
            void change(value);
        }} />
        {learning.enabled && <>
            <Text style={styles.label}>逐词 · 0.5×</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="单句循环" onPress={() => LearningMode.toggleLoop()}>
                <Text style={[styles.label, learning.loop && styles.active]}>单句循环{learning.loop ? " · 开" : ""}</Text>
            </Pressable>
        </>}
    </View>;
}
const styles = StyleSheet.create({
    wrapper: { height: rpx(48), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rpx(16) },
    label: { color: "white", fontSize: rpx(24) },
    active: { color: "#66ccff" },
});
