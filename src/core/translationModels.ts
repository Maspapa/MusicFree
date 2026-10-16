import { atom, getDefaultStore, useAtomValue } from "jotai";
import LyricDictionary, { ITranslationModel } from "@/native/lyricDictionary";

type ModelLanguage = "zh" | "ja";
const initialModels: ITranslationModel[] = ["zh", "ja"].map(language => ({ language: language as ModelLanguage, downloaded: false, downloading: false, error: "" }));
const stateAtom = atom({ models: initialModels, loaded: false, error: "", wifiOnly: true, pending: {} as Partial<Record<ModelLanguage, boolean>>, failures: {} as Partial<Record<ModelLanguage, string>>, batch: false });
const store = getDefaultStore();
const state = () => store.get(stateAtom);
const patch = (value: Partial<ReturnType<typeof state>>) => store.set(stateAtom, { ...state(), ...value });
let refreshing: Promise<void> | undefined;

const TranslationModels = {
    get state() {
        return state(); 
    },
    refresh() {
        if (!refreshing) {
            refreshing = LyricDictionary.getTranslationModels().then(models => {
                patch({ models, loaded: true, error: "" });
            }).catch(error => {
                patch({ error: error instanceof Error ? error.message : String(error) });
            }).finally(() => {
                refreshing = undefined; 
            });
        }
        return refreshing;
    },
    setWifiOnly(wifiOnly: boolean) {
        patch({ wifiOnly }); 
    },
    async download(language: ModelLanguage): Promise<boolean> {
        if (state().pending[language]) return false;
        patch({ pending: { ...state().pending, [language]: true }, failures: { ...state().failures, [language]: "" } });
        try {
            await LyricDictionary.downloadTranslationModel(language, state().wifiOnly);
            return true;
        } catch (error) {
            patch({ failures: { ...state().failures, [language]: error instanceof Error ? error.message : String(error) } });
            return false;
        } finally {
            patch({ pending: { ...state().pending, [language]: false } });
            await this.refresh();
        }
    },
    async downloadAll() {
        if (state().batch) return;
        patch({ batch: true });
        try {
            await this.refresh();
            if (!state().loaded || state().error) return;
            for (const model of state().models) {
                if (!model.downloaded && !await this.download(model.language)) break;
            }
        } finally {
            patch({ batch: false }); 
        }
    },
};
export const useTranslationModels = () => useAtomValue(stateAtom);
export default TranslationModels;
