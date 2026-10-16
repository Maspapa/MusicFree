import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import LyricDictionary from "@/native/lyricDictionary";
import LearningMode from "@/core/learningMode";
import rpx from "@/utils/rpx";

export default function CantoneseVoiceSettings() {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");
    const mounted = useRef(true);
    const previewing = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (previewing.current) void LyricDictionary.stopSpeaking();
        };
    }, []);
    async function testVoice() {
        if (busy) return;
        setBusy(true);
        setStatus("正在检测当前系统语音引擎…");
        try {
            await LearningMode.pause();
            const voices = await LyricDictionary.getSpeechVoices("yue");
            if (!mounted.current) return;
            if (!voices.length) {
                setStatus("未找到已安装的粤语声音。请在系统文字转语音设置中安装粤语／香港中文语音包，或切换支持粤语的引擎。不会改用普通话。");
                return;
            }
            const offline = voices.some(voice => !voice.network);
            setStatus(`找到 ${voices.length} 个粤语声音，${offline ? "优先使用离线声音" : "仅有联网声音，播放需要网络"}。正在试听…`);
            previewing.current = true;
            await LyricDictionary.speakText("你好，我哋一齊學廣東話。", "yue", 0.5);
            if (mounted.current) setStatus(`粤语试听完成。${offline ? "当前引擎提供离线声音。" : "当前声音需要联网。"}`);
        } catch (error) {
            if (mounted.current) setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            previewing.current = false;
            if (mounted.current) setBusy(false);
        }
    }
    return <View style={{ gap: rpx(14) }}>
        <ThemeText>粤语声音</ThemeText>
        <ThemeText style={{ opacity: 0.7 }}>在歌词页的语言选项选择“粤语”，选择按歌曲保存。粤语声音由系统语音引擎提供，不是上方的翻译模型。</ThemeText>
        <Pressable accessibilityRole="button" disabled={busy} style={{ alignSelf: "flex-start", padding: rpx(18), borderWidth: 1, borderColor: "#80808055", borderRadius: rpx(12), opacity: busy ? 0.5 : 1 }} onPress={() => {
            void testVoice(); 
        }}><ThemeText>{busy ? "检测／试听中…" : "检测并试听粤语"}</ThemeText></Pressable>
        {!!status && <ThemeText selectable>{status}</ThemeText>}
    </View>;
}
