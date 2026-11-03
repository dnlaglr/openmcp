import { CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type { CatalogRunner } from "@openmcp/contracts";

import { checkRunner, type RuntimeCheck } from "./runtimes";
import { Callout } from "@/components/Callout";
import { Button } from "@/components/Button";
import { useRuntimes } from "./useCatalog";
import { Tag } from "@/components/Tag";

const link = "text-xs font-medium text-primary hover:underline";

export function RuntimeBanner({ runners }: { runners: CatalogRunner[] }) {
  const runtimes = useRuntimes();
  const [rechecked, setRechecked] = useState<string[]>([]);
  const checks = [...new Set(runners)].flatMap((runner) => checkRunner(runner, runtimes.data) ?? []);
  const missing = checks.filter((check) => !check.ready);
  const found = checks.filter((check) => check.ready && rechecked.includes(check.info.key));

  function recheck() {
    setRechecked(missing.map((check) => check.info.key));
    void runtimes.refetch();
  }

  const again = (
    <Button size="sm" busy={runtimes.isFetching} disabled={runtimes.isFetching} onClick={recheck}>
      {runtimes.isFetching ? "Checking…" : "Check again"}
    </Button>
  );

  const banner = (check: RuntimeCheck) =>
    check.found ? (
      <Callout
        key={check.runner}
        tone="warn"
        icon={<TriangleAlert />}
        title={`${check.info.name} isn’t running.`}
        actions={again}
      >
        <p className="text-xs">Start {check.info.name}, then check again.</p>
      </Callout>
    ) : (
      <Callout
        key={check.runner}
        tone="warn"
        icon={<TriangleAlert />}
        title={`${check.info.name} isn’t installed.`}
        actions={
          <>
            <a href={check.info.url} target="_blank" rel="noreferrer" className={link}>
              How to install {check.info.name}
            </a>
            {again}
          </>
        }
      >
        <p className="text-xs">
          Servers marked <Tag mono>{check.runner}</Tag> need it to run.
        </p>
      </Callout>
    );

  return (
    <>
      {missing.map(banner)}
      {found.map((check) => (
        <Callout
          key={check.runner}
          tone="ok"
          icon={<CircleCheck />}
          title={`Found ${check.info.name} ${check.version}.`}
        >
          <p className="text-xs">{check.runner} servers are ready to install.</p>
        </Callout>
      ))}
    </>
  );
}
