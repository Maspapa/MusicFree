import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LearningTranslation from "./learningTranslation";
import type { LearningLanguage } from "@/utils/learningLyrics";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";
import { tokenizeLyricLine } from "@/utils/lyricWords";
import LyricDictionary from "@/native/lyricDictionary";
import type { ILyricToken } from "@/utils/lyricWords";

interface ILyricItemComponentProps {
    // 行号
    index?: number;
    // 显示
    light?: boolean;
    // 高亮
    highlight?: boolean;
    // 文本
    text?: string;
    // 字体大小
    fontSize?: number;
    translation?: string;
    wordLearning?: boolean;
    japanese?: boolean;
    learningLanguage?: LearningLanguage;
    onWordPress?: (word: string) => void;

    onLayout?: (index: number, height: number) => void;
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
    const { light, highlight, text = "", translation, wordLearning, japanese, onWordPress, onLayout, index, fontSize } = props;
    const [japaneseTokens, setJapaneseTokens] = useState<{ text: string; tokens: ILyricToken[] } | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (wordLearning && japanese) {
            LyricDictionary.tokenizeJapanese(text).then(tokens => {
                if (!cancelled) setJapaneseTokens({ text, tokens });
            }).catch(() => {});
        }
        return () => {
            cancelled = true;
        };
    }, [text, wordLearning, japanese]);
    const tokens = japanese && japaneseTokens?.text === text ? japaneseTokens.tokens : tokenizeLyricLine(text);

    const colors = useColors();

    return (
        <View
            onLayout={({ nativeEvent }) => {
                if (index !== undefined) {
                    onLayout?.(index, nativeEvent.layout.height);
                }
            }}>
            <Text
                style={[
                    lyricStyles.item,
                    {
                        fontSize: fontSize || fontSizeConst.content,
                    },
                    highlight
                        ? [
                            lyricStyles.highlightItem,
                            {
                                color: colors.primary,
                            },
                        ]
                        : null,
                    light ? lyricStyles.draggingItem : null,
                ]}>
                {wordLearning
                    ? tokens.map((token, tokenIndex) => token.isWord ? (
                        <Text
                            key={`${tokenIndex}-${token.text}`}
                            style={lyricStyles.clickableWord}
                            onPress={() => onWordPress?.(token.text)}>
                            {token.text}
                        </Text>
                    ) : token.text)
                    : text}
                {translation && !(highlight && props.learningLanguage) ? <Text style={lyricStyles.translation}>{`\n${translation}`}</Text> : null}
            </Text>
            {highlight && props.learningLanguage && <LearningTranslation text={text} translation={translation} songLanguage={props.learningLanguage} />}
        </View>
    );
}
// 歌词
const LyricItemComponent = memo(
    _LyricItemComponent,
    (prev, curr) =>
        prev.light === curr.light &&
        prev.highlight === curr.highlight &&
        prev.text === curr.text &&
        prev.index === curr.index &&
        prev.fontSize === curr.fontSize &&
        prev.translation === curr.translation &&
        prev.wordLearning === curr.wordLearning &&
        prev.japanese === curr.japanese &&
        prev.learningLanguage === curr.learningLanguage &&
        prev.onWordPress === curr.onWordPress,
);

export default LyricItemComponent;

const lyricStyles = StyleSheet.create({
    highlightItem: {
        opacity: 1,
    },
    item: {
        color: "white",
        opacity: 0.6,
        paddingHorizontal: rpx(64),
        paddingVertical: rpx(24),
        width: "100%",
        textAlign: "center",
        textAlignVertical: "center",
    },
    draggingItem: {
        opacity: 0.9,
        color: "white",
    },
    clickableWord: {
        textDecorationLine: "underline",
        textDecorationStyle: "dotted",
    },
    translation: {
        opacity: 0.72,
    },
});
