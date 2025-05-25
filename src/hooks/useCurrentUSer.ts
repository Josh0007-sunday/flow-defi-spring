import * as fcl from "@onflow/fcl";
import { useEffect, useState } from "react";

interface FlowUser {
  addr: string | null;
  loggedIn: boolean | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<FlowUser>({
    addr: null,
    loggedIn: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = fcl.currentUser().subscribe((user: FlowUser) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, isLoading };
}