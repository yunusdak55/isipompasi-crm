"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useActionState ile calisan formlar icin kisa sureli "Kaydedildi" geri
 * bildirimi - basarili bir submit'ten sonra ~1.6s boyunca true doner, sonra
 * kendiliginden kapanir. Hata durumunda tetiklenmez.
 */
export function useSaveFeedback(isPending: boolean, error: string | null) {
  const [justSaved, setJustSaved] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (isPending) {
      submittedRef.current = true;
      return;
    }
    if (submittedRef.current) {
      submittedRef.current = false;
      if (error === null) {
        setJustSaved(true);
        const timer = setTimeout(() => setJustSaved(false), 1600);
        return () => clearTimeout(timer);
      }
    }
  }, [isPending, error]);

  return justSaved;
}
