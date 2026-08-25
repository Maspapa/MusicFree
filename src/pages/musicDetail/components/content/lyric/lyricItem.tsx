import React, { memo } from "react";
import { StyleSheet, Text } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";
import { tokenizeLyricLine } from "@/utils/lyricWords";

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
    onWordPress?: (word: string) => void;

    onLayout?: (index: number, height: number) => void;
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
    const { light, highlight, text = "", translation, wordLearning, onWordPress, onLayout, index, fontSize } = props;

    const colors = useColors();

    return (
        <Text
            onLayout={({ nativeEvent }) => {
                if (index !== undefined) {
                    onLayout?.(index, nativeEvent.layout.height);
                }
            }}
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
                ? tokenizeLyricLine(text).map((token, tokenIndex) => token.isWord ? (
                    <Text
                        key={`${tokenIndex}-${token.text}`}
                        style={lyricStyles.clickableWord}
                        onPress={() => onWordPress?.(token.text)}>
                        {token.text}
                    </Text>
                ) : token.text)
                : text}
            {translation ? <Text style={lyricStyles.translation}>{`\n${translation}`}</Text> : null}
        </Text>
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
