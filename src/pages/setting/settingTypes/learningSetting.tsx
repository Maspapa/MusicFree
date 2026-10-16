import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import TranslationModels, { useTranslationModels } from "@/core/translationModels";
import LyricDictionary from "@/native/lyricDictionary";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";

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
    const busy = models.batch || models.models.some(model => model.downloading || models.pending[model.language]);
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
            <Switch accessibilityLabel="仅 Wi-Fi 下载" disabled={busy} value={models.wifiOnly} onValueChange={value => TranslationModels.setWifiOnly(value)} />
        </View>
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
        </View>
        {models.models.map(model => {
            const downloading = !!models.pending[model.language] || model.downloading;
            const error = model.downloaded ? "" : models.failures[model.language] || model.error;
            return <View key={model.language} style={[styles.card, { borderColor: colors.border }]}>
                <View style={styles.row}>
                    <ThemeText fontWeight="bold" style={{ flex: 1 }}>{model.language === "zh" ? "中文模型（英／日共用）" : "日文模型"}</ThemeText>
                    <ThemeText>{model.downloaded ? "已下载" : downloading ? "下载中" : error ? "下载失败" : "未下载"}</ThemeText>
                </View>
                {downloading && !model.downloaded && <DownloadProgress />}
                {error ? <ThemeText selectable style={styles.error}>{error}</ThemeText> : null}
                {!model.downloaded && <Pressable accessibilityRole="button" disabled={downloading || models.batch || !models.loaded || !!models.error} onPress={() => {
                    void TranslationModels.download(model.language); 
                }} style={[styles.button, { opacity: downloading || models.batch || !models.loaded || !!models.error ? 0.4 : 1 }]}><ThemeText>{downloading ? "正在下载…" : error ? "重试下载" : "下载模型"}</ThemeText></Pressable>}
            </View>;
        })}
        <ThemeText style={styles.note}>下载中显示动态进度条；SDK 不提供已下载字节数，因此不显示虚假的百分比。上方进度表示已完成模型数量。若长时间不动，请检查是否能访问 Google 模型下载服务，以及手机剩余存储。</ThemeText>
        <ThemeText fontSize="title">朗读语音包</ThemeText>
        <ThemeText style={styles.note}>朗读语音与翻译模型不同。英文／日文发音请在手机系统的“文字转语音”设置里下载安装。</ThemeText>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
            LyricDictionary.openSpeechSettings().catch(error => Toast.warn(error.message)); 
        }}><ThemeText>打开系统语音设置</ThemeText></Pressable>
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
