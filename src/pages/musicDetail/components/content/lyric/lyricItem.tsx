import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LearningTranslation from "./learningTranslation";
import { learningLanguage, LearningLanguage } from "@/utils/learningLyrics";
import { tokenizeLearningLine } from "@/utils/learningTokens";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";
import { tokenizeLyricLine } from "@/utils/lyricWords";
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
    activeToken?: number;
    onWordPress?: (word: string) => void;

    onLayout?: (index: number, height: number) => void;
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
    const { light, highlight, text = "", translation, wordLearning, japanese, onWordPress, onLayout, index, fontSize } = props;
    const [wordTokens, setWordTokens] = useState<{ text: string; language: LearningLanguage; tokens: ILyricToken[] } | null>(null);
    const language = props.learningLanguage ? learningLanguage(text, props.learningLanguage) : japanese ? "ja" : "en";
    useEffect(() => {
        let cancelled = false;
        setWordTokens(null);
        if (wordLearning && language !== "en") {
            tokenizeLearningLine(text, language).then(tokens => {
                if (!cancelled) setWordTokens({ text, language, tokens });
            }).catch(() => {});
        }
        return () => {
            cancelled = true;
        };
    }, [text, wordLearning, language]);
    const tokens = language !== "en" && wordTokens?.text === text && wordTokens.language === language ? wordTokens.tokens : tokenizeLyricLine(text);

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
                            style={[lyricStyles.clickableWord, props.activeToken === tokenIndex ? lyricStyles.speakingWord : null]}
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
        prev.activeToken === curr.activeToken &&
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
    speakingWord: {
        color: "#172554",
        backgroundColor: "#facc15",
        fontWeight: "bold",
        textDecorationLine: "none",
    },
    translation: {
        opacity: 0.72,
    },
});
