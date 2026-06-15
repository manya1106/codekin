import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { demoProgress } from "@codekin/shared";
import { db } from "./firebase";
export function useProgress(uid) {
    const [progress, setProgress] = useState(demoProgress);
    const [live, setLive] = useState(false);
    useEffect(() => {
        if (!db || !uid)
            return;
        return onSnapshot(doc(db, "users", uid, "private", "progress"), (snapshot) => {
            if (snapshot.exists())
                setProgress(snapshot.data());
            setLive(!snapshot.metadata.fromCache);
        });
    }, [uid]);
    return { progress, live };
}
