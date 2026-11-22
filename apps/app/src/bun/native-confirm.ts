export interface ConfirmRequest {
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
}

export type ConfirmNative = (request: ConfirmRequest) => Promise<boolean>;

interface MessageBox {
  type: "warning";
  title: string;
  message: string;
  detail: string;
  buttons: string[];
  defaultId: number;
  cancelId: number;
}

export interface NativeConfirmDeps {
  showMessageBox(box: MessageBox): Promise<{ response: number }>;
  runModal<T>(open: () => Promise<T>): Promise<T>;
}

const CANCEL = 0;
const CONFIRM = 1;

// A webview can't click a native dialog, so a compromised renderer can't
// approve a new process or a downgraded tool on its own.
export const createNativeConfirm =
  (deps: NativeConfirmDeps): ConfirmNative =>
  async ({ title, message, detail, confirmLabel }) => {
    const { response } = await deps.runModal(() =>
      deps.showMessageBox({
        buttons: ["Cancel", confirmLabel],
        cancelId: CANCEL,
        defaultId: CANCEL,
        detail,
        message,
        title,
        type: "warning",
      })
    );
    return response === CONFIRM;
  };
