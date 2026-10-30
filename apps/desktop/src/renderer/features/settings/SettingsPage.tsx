import { PageHeader } from "@/components/PageHeader";
import { GatewaySettings } from "./GatewaySettings";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-xl">
        <GatewaySettings />
      </div>
    </>
  );
}
