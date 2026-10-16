import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import LyricDictionary from "@/native/lyricDictionary";
import { hasChineseTranslation, learningLanguage, LearningLanguage } from "@/utils/learningLyrics";
import rpx from "@/utils/rpx";
import { ROUTE_PATH, useNavigate } from "@/core/router";

export default function LearningTranslation({ text, translation, songLanguage }: { text: string; translation?: string; songLanguage: LearningLanguage }) {
    const [translated, setTranslated] = useState("");
    const [failed, setFailed] = useState("");
    const navigate = useNavigate();
    const [attempt, setAttempt] = useState(0);
    const provided = hasChineseTranslation(translation) ? translation : "";
    const language = learningLanguage(text, songLanguage);
    useEffect(() => {
        let cancelled = false;
        setTranslated("");
        setFailed("");
        if (provided || language === "zh" || language === "yue") return;
        LyricDictionary.translate(text, language).then(value => {
            if (!cancelled) setTranslated(value);
        }).catch(error => {
            if (!cancelled) setFailed(error instanceof Error ? error.message : String(error));
        });
        return () => {
            cancelled = true;
        };
    }, [text, provided, language, attempt]);
    if ((language === "zh" || language === "yue") && !provided) return null;
    return <View style={{ paddingHorizontal: rpx(30), paddingVertical: rpx(10), alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: rpx(26), textAlign: "center" }}>{provided || (translated ? `${translated}（机翻）` : failed || "正在离线翻译…")}</Text>
        {!!failed && <View style={{ flexDirection: "row" }}>
            <Pressable onPress={() => navigate(ROUTE_PATH.SETTING, { type: "learning" })} accessibilityRole="button"><Text style={{ color: "#66ccff", padding: rpx(10) }}>管理翻译模型</Text></Pressable>
            <Pressable onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={{ color: "#66ccff", padding: rpx(10) }}>重试翻译</Text></Pressable>
        </View>}
    </View>;
}
