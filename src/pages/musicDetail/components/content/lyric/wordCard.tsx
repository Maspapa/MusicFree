import React from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Icon from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useI18N } from "@/core/i18n";
import type { ILyricDictionaryEntry } from "@/native/lyricDictionary";

interface IProps {
    visible: boolean;
    surfaceWord: string;
    entry: ILyricDictionaryEntry | null;
    loading: boolean;
    onSpeak: () => void;
    onClose: () => void;
}

export default function WordCard(props: IProps) {
    const { visible, surfaceWord, entry, loading, onSpeak, onClose } = props;
    const colors = useColors();
    const { t } = useI18N();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.card} onPress={() => undefined}>
                    <View style={styles.heading}>
                        <View style={styles.wordBlock}>
                            <Text style={styles.word}>{surfaceWord}</Text>
                            {entry?.matchedWord && entry.matchedWord !== surfaceWord.toLowerCase() ? (
                                <Text style={styles.lemma}>→ {entry.matchedWord}</Text>
                            ) : null}
                        </View>
                        <Pressable
                            accessibilityLabel={t("lyric.wordLearning.pronounce")}
                            onPress={onSpeak}
                            style={[styles.speakButton, { backgroundColor: colors.primary }]}>
                            <Icon name="motion-play" size={rpx(34)} color="white" />
                        </Pressable>
                    </View>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} style={styles.loading} />
                    ) : entry ? (
                        <>
                            {entry.phonetic ? <Text style={styles.phonetic}>/{entry.phonetic}/</Text> : null}
                            {entry.translation ? <Text style={styles.translation}>{entry.translation}</Text> : null}
                            {entry.definition ? <Text style={styles.definition}>{entry.definition}</Text> : null}
                        </>
                    ) : (
                        <Text style={styles.empty}>{t("lyric.wordLearning.noEntry")}</Text>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.48)",
        padding: rpx(28),
    },
    card: {
        borderRadius: rpx(26),
        backgroundColor: "#ffffff",
        padding: rpx(32),
        minHeight: rpx(220),
    },
    heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    wordBlock: { flex: 1, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
    word: { color: "#182033", fontSize: rpx(42), fontWeight: "700" },
    lemma: { color: "#667085", fontSize: rpx(24), marginLeft: rpx(16) },
    speakButton: { width: rpx(64), height: rpx(64), borderRadius: rpx(32), alignItems: "center", justifyContent: "center" },
    loading: { marginVertical: rpx(36) },
    phonetic: { color: "#667085", fontSize: rpx(24), marginTop: rpx(14) },
    translation: { color: "#182033", fontSize: rpx(28), lineHeight: rpx(42), marginTop: rpx(24) },
    definition: { color: "#667085", fontSize: rpx(23), lineHeight: rpx(34), marginTop: rpx(16) },
    empty: { color: "#667085", fontSize: rpx(25), marginVertical: rpx(34) },
});
