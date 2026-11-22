// The renderer drops messages sent before it subscribes, so a navigate that
// arrives early (a cold-start link, tray "Settings…") waits for its handshake.
// Only the latest view is kept: links never queue work.
export const createNavigationGate = <View>(send: (view: View) => void) => {
  let ready = false;
  let pending: { view: View } | null = null;

  return {
    isReady: () => ready,
    markReady: () => {
      ready = true;
      if (pending) {
        const { view } = pending;
        pending = null;
        send(view);
      }
    },
    navigate: (view: View) => {
      if (ready) {
        send(view);
        return;
      }
      pending = { view };
    },
  };
};
