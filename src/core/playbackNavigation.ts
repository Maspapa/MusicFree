import TrackPlayer from "@/core/trackPlayer";
import { getAdjacentLyricTime } from "@/utils/lyricLineNavigation";
import PersistStatus from "@/utils/persistStatus";

export function isLyricLineNavigationEnabled(): boolean {
    return PersistStatus.get("lyric.lineNavigation") ?? false;
}

export function setLyricLineNavigationEnabled(enabled: boolean): void {
    PersistStatus.set("lyric.lineNavigation", enabled);
}

export function useLyricLineNavigationEnabled(): boolean {
    return PersistStatus.useValue("lyric.lineNavigation", false) ?? false;
}

async function navigate(direction: "previous" | "next"): Promise<void> {
    if (isLyricLineNavigationEnabled()) {
        const currentMusic = TrackPlayer.currentMusic;
        const timeline = PersistStatus.get("lyric.lineNavigationTimeline");
        const timelineMatchesCurrentMusic =
            currentMusic &&
            timeline?.id === currentMusic.id &&
            timeline?.platform === currentMusic.platform;

        if (timelineMatchesCurrentMusic) {
            const position = (await TrackPlayer.getProgress()).position;
            const target = getAdjacentLyricTime(
                timeline.times,
                position,
                direction,
            );
            if (target !== null) {
                await TrackPlayer.seekTo(target);
                return;
            }
        }

        setLyricLineNavigationEnabled(false);
    }

    if (direction === "previous") {
        await TrackPlayer.skipToPrevious();
    } else {
        await TrackPlayer.skipToNext();
    }
}

const PlaybackNavigation = {
    previous: () => navigate("previous"),
    next: () => navigate("next"),
};

export default PlaybackNavigation;
