import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import LyricDictionary from "@/native/lyricDictionary";
import { hasChineseTranslation, learningLanguage, LearningLanguage } from "@/utils/learningLyrics";
import rpx from "@/utils/rpx";

export default function LearningTranslation({ text, translation, songLanguage }: { text: string; translation?: string; songLanguage: LearningLanguage }) {
    const [translated, setTranslated] = useState("");
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const provided = hasChineseTranslation(translation) ? translation : "";
    const language = learningLanguage(text, songLanguage);
    useEffect(() => {
        let cancelled = false;
        setTranslated("");
        setFailed(false);
        if (provided || language === "zh") return;
        LyricDictionary.translate(text, language).then(value => {
            if (!cancelled) setTranslated(value);
        }).catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, [text, provided, language, attempt]);
    if (language === "zh" && !provided) return null;
    return <View style={{ paddingHorizontal: rpx(30), paddingVertical: rpx(10), alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: rpx(26), textAlign: "center" }}>{provided || (translated ? `${translated}（机翻）` : failed ? "翻译失败，点击重试" : "正在翻译（首次需 Wi-Fi 下载模型）")}</Text>
        {failed && <Pressable onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={{ color: "#66ccff", padding: rpx(10) }}>重试翻译</Text></Pressable>}
    </View>;
}
