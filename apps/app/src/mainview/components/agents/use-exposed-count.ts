import { useConnections } from "@/components/launcher/connections/connections-provider";

export const useExposedCount = (exposedIds: readonly string[]): number => {
  const { state } = useConnections();
  return state.connections.filter((connection) =>
    exposedIds.includes(connection.id)
  ).length;
};
