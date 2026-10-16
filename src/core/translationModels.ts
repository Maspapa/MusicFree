import { atom, getDefaultStore, useAtomValue } from "jotai";
import LyricDictionary, { ITranslationModel } from "@/native/lyricDictionary";

type ModelLanguage = "zh" | "ja";
const initialModels: ITranslationModel[] = ["zh", "ja"].map(language => ({ language: language as ModelLanguage, downloaded: false, downloading: false, error: "", status: "idle" }));
const stateAtom = atom({ models: initialModels, loaded: false, error: "", wifiOnly: true, pending: {} as Partial<Record<ModelLanguage, boolean>>, controls: {} as Partial<Record<ModelLanguage, boolean>>, failures: {} as Partial<Record<ModelLanguage, string>>, batch: false, changingNetwork: false });
const store = getDefaultStore();
const state = () => store.get(stateAtom);
const patch = (value: Partial<ReturnType<typeof state>>) => store.set(stateAtom, { ...state(), ...value });
let refreshing: Promise<void> | undefined;
let batchGeneration = 0;
const requests: Partial<Record<ModelLanguage, number>> = {};
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

const TranslationModels = {
    get state() {
        return state(); 
    },
    refresh() {
        if (!refreshing) {
            refreshing = LyricDictionary.getTranslationModels().then(models => {
                patch({ models, loaded: true, error: "" });
            }).catch(error => {
                patch({ error: message(error) });
            }).finally(() => {
                refreshing = undefined; 
            });
        }
        return refreshing;
    },
    async setWifiOnly(wifiOnly: boolean) {
        if (state().changingNetwork || wifiOnly === state().wifiOnly) return;
        const active = state().models.filter(model => !model.downloaded && (model.active || model.downloading || state().pending[model.language]));
        patch({ wifiOnly });
        if (!active.length) return;
        patch({ changingNetwork: true });
        let cancelledAll = true;
        try {
            for (const model of active) if (!await this.cancel(model.language)) cancelledAll = false;
        } finally {
            patch({ changingNetwork: false });
        }
        // 重置 SDK 的旧条件后再排队，不复用“等待 Wi-Fi”的旧任务。
        if (cancelledAll) for (const model of active) void this.download(model.language);
    },
    async download(language: ModelLanguage): Promise<boolean> {
        if (state().pending[language] || state().controls[language] || state().changingNetwork) return false;
        const request = (requests[language] ?? 0) + 1;
        requests[language] = request;
        patch({ pending: { ...state().pending, [language]: true }, failures: { ...state().failures, [language]: "" } });
        try {
            await LyricDictionary.downloadTranslationModel(language, state().wifiOnly);
            return requests[language] === request;
        } catch (error) {
            if (requests[language] === request && (error as { code?: string })?.code !== "MODEL_CANCELLED") {
                patch({ failures: { ...state().failures, [language]: message(error) } });
            }
            return false;
        } finally {
            if (requests[language] === request) patch({ pending: { ...state().pending, [language]: false } });
            await this.refresh();
        }
    },
    async cancel(language: ModelLanguage): Promise<boolean> {
        if (state().controls[language]) return false;
        batchGeneration += 1;
        requests[language] = (requests[language] ?? 0) + 1;
        patch({ batch: false, controls: { ...state().controls, [language]: true }, failures: { ...state().failures, [language]: "" } });
        try {
            await LyricDictionary.cancelTranslationModel(language);
            return true;
        } catch (error) {
            patch({ failures: { ...state().failures, [language]: message(error) } });
            return false;
        } finally {
            patch({ pending: { ...state().pending, [language]: false }, controls: { ...state().controls, [language]: false } });
            await this.refresh();
        }
    },
    async retry(language: ModelLanguage) {
        if (await this.cancel(language)) return this.download(language);
        return false;
    },
    async downloadAll() {
        if (state().batch || state().changingNetwork) return;
        const sequence = ++batchGeneration;
        patch({ batch: true });
        try {
            await this.refresh();
            if (!state().loaded || state().error) return;
            for (const model of state().models) {
                if (sequence !== batchGeneration) break;
                if (!model.downloaded && !await this.download(model.language)) break;
            }
        } finally {
            if (sequence === batchGeneration) patch({ batch: false });
        }
    },
};
export const useTranslationModels = () => useAtomValue(stateAtom);
export default TranslationModels;
