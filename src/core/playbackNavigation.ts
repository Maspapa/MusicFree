import TrackPlayer from "@/core/trackPlayer";
import LearningMode from "./learningMode";

async function navigate(direction: "previous" | "next"): Promise<void> {
    if (LearningMode.state.enabled) {
        await LearningMode.navigate(direction);
        return;
    }
    if (direction === "previous") await TrackPlayer.skipToPrevious();
    else await TrackPlayer.skipToNext();
}

export default {
    previous: () => navigate("previous"),
    next: () => navigate("next"),
};
