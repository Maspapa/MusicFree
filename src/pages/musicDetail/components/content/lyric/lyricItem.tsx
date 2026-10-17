import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LearningTranslation from "./learningTranslation";
import { learningLanguage, LearningLanguage } from "@/utils/learningLyrics";
import { tokenizeLearningLine } from "@/utils/learningTokens";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";
import { tokenizeLyricLine, tokenizeLyricFallback } from "@/utils/lyricWords";
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
    wordLanguage?: LearningLanguage;
    learningLanguage?: LearningLanguage;
    activeToken?: number;
    onWordPress?: (word: string, language: LearningLanguage) => void;

    onLayout?: (index: number, height: number) => void;
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
    const { light, highlight, text = "", translation, wordLearning, onWordPress, onLayout, index, fontSize } = props;
    const [wordTokens, setWordTokens] = useState<{ text: string; language: LearningLanguage; tokens: ILyricToken[] } | null>(null);
    const [tokenError, setTokenError] = useState(false);
    const [retry, setRetry] = useState(0);
    const language = learningLanguage(text, props.wordLanguage ?? props.learningLanguage);
    useEffect(() => {
        let cancelled = false;
        setWordTokens(null);
        setTokenError(false);
        if (wordLearning && language !== "en") {
            tokenizeLearningLine(text, language).then(tokens => {
                if (!tokens.length && text.trim()) throw new Error("分词结果为空");
                if (!cancelled) setWordTokens({ text, language, tokens });
            }).catch(() => {
                if (!cancelled) setTokenError(true);
            });
        }
        return () => {
            cancelled = true;
        };
    }, [text, wordLearning, language, retry]);
    const tokens = language === "en" ? tokenizeLyricLine(text) : wordTokens?.text === text && wordTokens.language === language ? wordTokens.tokens : tokenizeLyricFallback(text);

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
                            onPress={() => onWordPress?.(token.text, learningLanguage(token.text, language))}>
                            {token.text}
                        </Text>
                    ) : token.text)
                    : text}
                {translation && !(highlight && props.learningLanguage) ? <Text style={lyricStyles.translation}>{`\n${translation}`}</Text> : null}
            </Text>
            {wordLearning && highlight && tokenError && <Text style={lyricStyles.tokenError} onPress={() => setRetry(value => value + 1)}>分词不可用，暂按文字片段点选 · 点击重试</Text>}
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
        prev.wordLanguage === curr.wordLanguage &&
        prev.learningLanguage === curr.learningLanguage &&
        prev.activeToken === curr.activeToken &&
        prev.onWordPress === curr.onWordPress,
);

export default LyricItemComponent;

const lyricStyles = StyleSheet.create({
    tokenError: { color: "#ffcf8a", textAlign: "center", fontSize: rpx(22), paddingHorizontal: rpx(24) },
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
