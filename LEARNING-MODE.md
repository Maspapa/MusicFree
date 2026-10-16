# 歌词学习模式

- 开启后暂停原曲，按当前位置选择歌词，以系统 TTS 的 0.5 语速逐词独立发音；词间停顿 0.4 秒，当前词高亮。仅保留逐词跟读，不提供整句朗读。退出后原曲仍暂停，进度保留。
- 英文按单词切分，日文按 Kuromoji 分词并使用词的语境读音（例如助词「は」），不按单个汉字拆读。
- 上一句、下一句切换原句；播放键重新朗读当前句，暂停会停止当前朗读，再次播放从句首开始。
- 默认不循环、不自动跳下一句。单句循环开启后间隔 2 秒重复当前句。
- 点击英文／日语词语：停止逐词跟读，正常语速读词并打开词典；关闭词卡后手动恢复当前句的逐词跟读。
- 歌词附带中文翻译时优先显示；中文原句不重复翻译。缺少译文时使用 Google ML Kit 在手机上机翻并标注，结果保存到本机，下次复用。
- 首次机翻需要 Wi-Fi 下载语言模型，下载失败可重试；歌词文本不会上传到翻译服务器，不使用 API 密钥。手机需安装对应英语、日语 TTS 语音数据，实际音色、速度由系统引擎决定。
- 日语使用 Kuromoji/IPADIC 分词和词形还原，词典显示假名读音、日英词典释义；中文释义由本机机翻补充并标注。歌词中人名、特殊读法仍可能需要人工核对。
- 无歌词不能开启，普通无时间轴歌词也可学习。快速切句、停止、切歌会取消旧朗读和循环。

## 数据来源与授权

英文词典沿用项目现有 ECDICT 数据。

日语词典使用 [EDRDG JMdict/EDICT2](https://www.edrdg.org/wiki/Edict_Overview.html)，著作权归 Electronic Dictionary Research and Development Group，按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 分发。内置 `japanese_dictionary.db` 是 EDICT2 的 SQLite 转换版本，保留词形、假名及英文释义，数据库转换成果同样按 CC BY-SA 4.0 提供。数据更新于构建时；本次原文件为 `edict2u.gz`。

可从 EDRDG Nihongo 档案下载原始 `edict2u.gz`，然后执行：

```powershell
node --experimental-sqlite generator/build-japanese-dictionary.mjs tmp/edict2u.gz 新的输出路径.db
```

生成脚本拒绝覆盖已有文件。词典仅在本机查询。

[Kuromoji](https://github.com/atilika/kuromoji) 使用 Apache 2.0；[IPADIC 授权](https://github.com/atilika/kuromoji/blob/master/kuromoji-ipadic/src/main/resources/META-INF/LICENSE)随其依赖分发。

翻译模型与语音质量参见 [ML Kit 文档](https://developers.google.com/ml-kit/language/translation/android)及 [Android TTS 文档](https://developer.android.com/reference/android/speech/tts/TextToSpeech)。
