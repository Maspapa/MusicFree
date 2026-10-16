import ThemeSwitch from "@/components/base/switch";
import { useLyricState } from "@/core/lyricManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import LearningMode, { useLearningMode } from "@/core/learningMode";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getMediaExtraProperty, patchMediaExtra } from "@/utils/mediaExtra";
import { learningLanguageLabels, LearningLanguageChoice, validLearningLanguage } from "@/utils/learningLyrics";
import { ROUTE_PATH, useNavigate } from "@/core/router";

export default function LyricLineModeSwitch() {
    const learning = useLearningMode();
    const { loading, lyrics, meta } = useLyricState();
    const music = useCurrentMusic();
    const identity = String(music?.platform) + ":" + String(music?.id);
    const previousIdentity = useRef(identity);
    const [busy, setBusy] = useState(false);
    const [choice, setChoice] = useState(() => validLearningLanguage(getMediaExtraProperty(music, "learningLanguage")));
    const [showLanguages, setShowLanguages] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        setChoice(validLearningLanguage(getMediaExtraProperty(music, "learningLanguage")));
        setShowLanguages(false);
    }, [identity]);
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
            if (enabled) await LearningMode.enter(lyrics, +(meta?.offset ?? 0), validLearningLanguage(getMediaExtraProperty(music, "learningLanguage")));
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
        <Pressable accessibilityRole="button" accessibilityLabel="选择学习语言" onPress={() => setShowLanguages(true)}><Text style={styles.label}>{learningLanguageLabels[choice]} ▾</Text></Pressable>
        {learning.enabled && <>
            <Text style={styles.label}>逐词 · 0.5×</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="单句循环" onPress={() => LearningMode.toggleLoop()}>
                <Text style={[styles.label, learning.loop && styles.active]}>单句循环{learning.loop ? " · 开" : ""}</Text>
            </Pressable>
        </>}
        <Modal visible={showLanguages} transparent animationType="fade" onRequestClose={() => setShowLanguages(false)}>
            <Pressable style={styles.backdrop} onPress={() => setShowLanguages(false)}>
                <Pressable style={styles.sheet} onPress={() => undefined}>
                    <Text style={styles.heading}>这首歌的学习语言</Text>
                    {(Object.keys(learningLanguageLabels) as LearningLanguageChoice[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: choice === value }} style={styles.option} onPress={() => {
                        if (!music || busy) return;
                        patchMediaExtra(music, { learningLanguage: value });
                        setChoice(value);
                        setShowLanguages(false);
                        if (LearningMode.state.enabled) void LearningMode.setLanguage(value);
                    }}><Text style={styles.optionText}>{learningLanguageLabels[value]}{choice === value ? " ✓" : ""}</Text></Pressable>)}
                    <Text style={styles.note}>选择会按歌曲保存。自动模式不能可靠识别粤语，请手动选择；粤语需系统提供对应声音，不会改用普通话。</Text>
                    <Pressable style={styles.option} onPress={() => {
                        setShowLanguages(false);
                        navigate(ROUTE_PATH.SETTING, { type: "learning" });
                    }}><Text style={styles.link}>检测粤语声音／语音设置</Text></Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    </View>;
}
const styles = StyleSheet.create({
    wrapper: { minHeight: rpx(48), flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: rpx(12) },
    label: { color: "white", fontSize: rpx(24) },
    active: { color: "#66ccff" },
    backdrop: { flex: 1, justifyContent: "center", padding: rpx(40), backgroundColor: "#0009" },
    sheet: { backgroundColor: "#fff", borderRadius: rpx(20), padding: rpx(28) },
    heading: { color: "#172554", fontSize: rpx(30), fontWeight: "bold", marginBottom: rpx(12) },
    option: { paddingVertical: rpx(16) },
    optionText: { color: "#172554", fontSize: rpx(28) },
    note: { color: "#555", fontSize: rpx(23), lineHeight: rpx(34) },
    link: { color: "#2457cc", fontSize: rpx(26) },
});
