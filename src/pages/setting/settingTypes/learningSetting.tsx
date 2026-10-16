import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import TranslationModels, { useTranslationModels } from "@/core/translationModels";
import LyricDictionary from "@/native/lyricDictionary";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import CantoneseVoiceSettings from "./cantoneseVoiceSettings";
import { modelDownloadPresentation } from "@/utils/modelDownloadPresentation";

function DownloadProgress() {
    const colors = useColors();
    const position = useRef(new Animated.Value(0)).current;
    const [width, setWidth] = useState(240);
    useEffect(() => {
        const animation = Animated.loop(Animated.timing(position, { toValue: 1, duration: 1300, useNativeDriver: true }));
        animation.start();
        return () => {
            animation.stop(); 
        };
    }, [position]);
    return <View accessibilityRole="progressbar" accessibilityValue={{ text: "下载中，字节进度不可用" }} style={[styles.bar, { backgroundColor: colors.border }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <Animated.View style={{ height: "100%", width: "25%", backgroundColor: colors.primary, transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [-width / 4, width] }) }] }} />
    </View>;
}

export default function LearningSetting() {
    const models = useTranslationModels();
    const colors = useColors();
    const completed = models.models.filter(model => model.downloaded).length;
    const busy = models.batch || models.changingNetwork || models.models.some(model => model.active || model.downloading || models.pending[model.language] || models.controls[model.language]);
    useEffect(() => {
        void TranslationModels.refresh();
        const interval = setInterval(() => {
            void TranslationModels.refresh(); 
        }, 1500);
        return () => clearInterval(interval);
    }, []);
    return <ScrollView contentContainerStyle={styles.page}>
        <ThemeText fontSize="title">离线翻译模型</ThemeText>
        <ThemeText style={styles.note}>英语已内置。英译中需中文模型；日译中需中文和日文模型。每个约几十 MB。</ThemeText>
        <View style={styles.row}>
            <ThemeText>仅 Wi-Fi 下载</ThemeText>
            <Switch accessibilityLabel="仅 Wi-Fi 下载" disabled={models.changingNetwork} value={models.wifiOnly} onValueChange={value => {
                void TranslationModels.setWifiOnly(value);
            }} />
        </View>
        <ThemeText style={styles.note}>{models.changingNetwork ? "正在取消旧任务并应用新网络设置…" : "切换网络选项会重建未完成任务；系统的大文件限制仍需在下载管理中处理。"}</ThemeText>
        {!models.wifiOnly && <ThemeText style={styles.note}>已允许使用移动数据，下载会消耗流量；系统的大文件限制仍可能需要在系统下载管理中调整。</ThemeText>}
        <ThemeText>{models.loaded ? `已就绪 ${completed} / 2 个模型` : "正在读取模型状态…"}</ThemeText>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 2, now: completed, text: `已就绪 ${completed} / 2` }} style={[styles.bar, { backgroundColor: colors.border }]}>
            <View style={{ height: "100%", width: `${completed / 2 * 100}%`, backgroundColor: colors.primary }} />
        </View>
        {models.error ? <ThemeText selectable style={styles.error}>{models.error}</ThemeText> : null}
        <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy || !models.loaded || !!models.error || completed === 2} onPress={() => {
                void TranslationModels.downloadAll(); 
            }} style={[styles.button, { borderColor: colors.primary, opacity: busy || !models.loaded || !!models.error || completed === 2 ? 0.4 : 1 }]}><ThemeText>下载全部所需模型</ThemeText></Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
                void TranslationModels.refresh(); 
            }}><ThemeText>刷新状态</ThemeText></Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
                void LyricDictionary.openModelDownloads().catch(error => Toast.warn(error.message));
            }}><ThemeText>系统下载管理</ThemeText></Pressable>
        </View>
        {models.models.map(model => {
            const transfer = modelDownloadPresentation(model, !!models.pending[model.language]);
            const controlling = models.changingNetwork || models.controls[model.language] || model.status === "resetting";
            const error = model.downloaded ? "" : models.failures[model.language] || model.error;
            return <View key={model.language} style={[styles.card, { borderColor: colors.border }]}>
                <View style={styles.row}>
                    <ThemeText fontWeight="bold" style={{ flex: 1 }}>{model.language === "zh" ? "中文模型（英／日共用）" : "日文模型"}</ThemeText>
                    <ThemeText>{controlling ? "取消中" : transfer.label}</ThemeText>
                </View>
                {!model.downloaded && transfer.percent !== undefined && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: transfer.percent }} style={[styles.bar, { backgroundColor: colors.border }]}><View style={{ height: "100%", width: `${transfer.percent}%`, backgroundColor: colors.primary }} /></View>}
                {!model.downloaded && transfer.animate && <DownloadProgress />}
                {!model.downloaded && !!transfer.progressText && <ThemeText>{transfer.progressText}</ThemeText>}
                {!model.downloaded && !error && !!model.statusMessage && model.status === transfer.status && <ThemeText style={styles.note}>{model.statusMessage}</ThemeText>}
                {error ? <ThemeText selectable style={styles.error}>{error}</ThemeText> : null}
                {!model.downloaded && <View style={styles.actions}>
                    <Pressable accessibilityRole="button" disabled={!!controlling || !models.loaded || !!models.error} onPress={() => {
                        void TranslationModels.retry(model.language);
                    }} style={[styles.button, { opacity: controlling || !models.loaded || !!models.error ? 0.4 : 1 }]}><ThemeText>{transfer.active ? "按当前设置重试" : error ? "重试下载" : "下载模型"}</ThemeText></Pressable>
                    {transfer.active && <Pressable accessibilityRole="button" disabled={!!controlling} style={styles.button} onPress={() => {
                        void TranslationModels.cancel(model.language);
                    }}><ThemeText>取消下载</ThemeText></Pressable>}
                </View>}
            </View>;
        })}
        <ThemeText style={styles.note}>从系统下载管理读取真实状态和字节数。总大小已知时显示实际进度；排队、等待网络时不播放下载动画。无法读取时明确标注，不推测进度。重试会清理该模型的未完成任务，不删除已就绪模型。</ThemeText>
        <ThemeText fontSize="title">朗读语音包</ThemeText>
        <ThemeText style={styles.note}>朗读语音与翻译模型不同。英语／日语／普通话／粤语声音请在手机系统的“文字转语音”设置里下载安装。</ThemeText>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
            LyricDictionary.openSpeechSettings().catch(error => Toast.warn(error.message)); 
        }}><ThemeText>打开系统语音设置</ThemeText></Pressable>
        <CantoneseVoiceSettings />
    </ScrollView>;
}
const styles = StyleSheet.create({
    page: { padding: rpx(28), gap: rpx(18), paddingBottom: rpx(80) },
    note: { opacity: 0.7, lineHeight: rpx(36) },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: rpx(12) },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: rpx(12) },
    button: { padding: rpx(18), borderWidth: 1, borderColor: "#80808055", borderRadius: rpx(12), alignSelf: "flex-start" },
    card: { borderWidth: 1, borderRadius: rpx(16), padding: rpx(20), gap: rpx(16) },
    bar: { height: rpx(12), width: "100%", borderRadius: rpx(6), overflow: "hidden" },
    error: { color: "#db635b", lineHeight: rpx(34) },
});
