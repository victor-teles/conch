import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const MiniAppView = lazy(async () => {
  const module = await import("@/components/mini-app/window/mini-app-view");
  return { default: module.MiniAppView };
});

export const Route = createFileRoute("/app/$appId")({
  component: AppRoute,
});

function AppRoute() {
  const { appId } = Route.useParams();
  return (
    <Suspense fallback={null}>
      <MiniAppView appId={appId} key={appId} />
    </Suspense>
  );
}
