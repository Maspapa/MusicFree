import ThemeSwitch from "@/components/base/switch";
import { useI18N } from "@/core/i18n";
import { useLyricState } from "@/core/lyricManager";
import {
    setLyricLineNavigationEnabled,
    useLyricLineNavigationEnabled,
} from "@/core/playbackNavigation";
import { hasNavigableLyrics } from "@/utils/lyricLineNavigation";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function LyricLineModeSwitch() {
    const enabled = useLyricLineNavigationEnabled();
    const { loading, lyrics, meta } = useLyricState();
    const { t } = useI18N();
    const available = useMemo(
        () => hasNavigableLyrics(lyrics, +(meta?.offset ?? 0)),
        [lyrics, meta?.offset],
    );

    useEffect(() => {
        if (enabled && !loading && !available) {
            setLyricLineNavigationEnabled(false);
        }
    }, [available, enabled, loading]);

    const handleValueChange = (nextValue: boolean) => {
        if (!nextValue) {
            setLyricLineNavigationEnabled(false);
            return;
        }

        if (loading) {
            Toast.warn(t("lyric.lineNavigation.loading"));
            return;
        }

        if (!available) {
            Toast.warn(t("lyric.lineNavigation.requiresSyncedLyrics"));
            return;
        }

        setLyricLineNavigationEnabled(true);
    };

    return (
        <View style={[styles.wrapper, !available && styles.unavailable]}>
            <Text style={styles.label}>{t("lyric.lineNavigation")}</Text>
            <ThemeSwitch value={enabled} onValueChange={handleValueChange} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        height: rpx(48),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: rpx(16),
    },
    unavailable: {
        opacity: 0.55,
    },
    label: {
        color: "white",
        fontSize: rpx(24),
    },
});
