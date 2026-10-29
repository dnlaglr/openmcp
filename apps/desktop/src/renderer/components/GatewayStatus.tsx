export function GatewayStatus() {
  return (
    <div className="flex h-8 items-center gap-2 px-2 text-xs text-muted-foreground" title="Gateway not running">
      <span className="mx-1 size-2 shrink-0 rounded-full bg-muted-foreground" />
      <span className="truncate group-data-[collapsible=icon]:hidden">Gateway not running</span>
    </div>
  );
}
