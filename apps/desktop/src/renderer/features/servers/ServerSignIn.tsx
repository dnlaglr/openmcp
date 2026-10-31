import { LoaderCircle, LogIn, LogOut } from "lucide-react";

import type { InstalledServer } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSignedIn, useSignIn, useSignOut } from "./useServers";
import { Button } from "@/components/ui/button";

// Stays clickable while waiting, since clicking again is how an abandoned browser tab gets replaced.
export function SignInButton({ server }: { server: InstalledServer }) {
  const signIn = useSignIn();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Sign in to ${server.name}`}
            onClick={() => signIn.mutate(server.id)}
          />
        }
      >
        {signIn.isPending ? <LoaderCircle className="animate-spin" /> : <LogIn />}
      </TooltipTrigger>
      <TooltipContent>{signIn.isPending ? "Waiting for your browser — click to start over" : "Sign in"}</TooltipContent>
    </Tooltip>
  );
}

export function SignOutButton({ server }: { server: InstalledServer }) {
  const signedIn = useSignedIn();
  const signOut = useSignOut();
  if (!signedIn.data?.includes(server.id)) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Sign out of ${server.name}`}
            disabled={signOut.isPending}
            onClick={() => signOut.mutate(server.id)}
          />
        }
      >
        <LogOut />
      </TooltipTrigger>
      <TooltipContent>Sign out</TooltipContent>
    </Tooltip>
  );
}
