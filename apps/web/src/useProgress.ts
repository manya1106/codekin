import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { UserProgress } from "@codekin/shared";
import { demoProgress } from "@codekin/shared";
import { db } from "./firebase";

export function useProgress(uid?: string) {
  const [progress, setProgress] = useState<UserProgress>(demoProgress);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!db || !uid) return;
    return onSnapshot(doc(db, "users", uid, "private", "progress"), (snapshot) => {
      if (snapshot.exists()) setProgress(snapshot.data() as UserProgress);
      setLive(!snapshot.metadata.fromCache);
    });
  }, [uid]);

  return { progress, live };
}
