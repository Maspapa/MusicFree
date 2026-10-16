import { showDialog } from "@/components/dialogs/useDialog";
import PersistStatus from "@/utils/persistStatus";
import checkUpdate from "@/utils/checkUpdate";
import Toast from "@/utils/toast";
import { compare } from "compare-versions";
import { useEffect } from "react";
import i18n from "@/core/i18n";

export const checkUpdateAndShowResult = (
    showToast = false,
    checkSkip = false,
) => {
    checkUpdate().then(updateInfo => {
        if (updateInfo?.needUpdate) {
            const { data } = updateInfo;
            const skipVersion = PersistStatus.get("app.skipVersion");
            if (
                checkSkip &&
                skipVersion &&
                compare(skipVersion, data.version, ">=")
            ) {
                return;
            }
            showDialog("DownloadDialog", {
                version: data.version,
                content: data.changeLog,
                fromUrl: data.download[0],
                backUrl: data.download[1],
            });
        } else {
            if (showToast) {
                Toast.success(i18n.t("checkUpdate.error.latestVersion"));
            }
        }
    }).catch(() => {
        if (showToast) Toast.warn("检查更新失败，请稍后重试（更新源：Maspapa/MusicFree）");
    });
};

export default function (callOnMount = true) {
    useEffect(() => {
        if (callOnMount) {
            checkUpdateAndShowResult(false, true);
        }
    }, []);

    return checkUpdateAndShowResult;
}
