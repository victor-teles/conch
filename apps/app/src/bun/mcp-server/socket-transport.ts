import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Socket } from "node:net";

import {
  ReadBuffer,
  serializeMessage,
} from "@modelcontextprotocol/sdk/shared/stdio.js";

const MAX_MESSAGE_BYTES = 1_000_000;

export class SocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  readonly #socket: Socket;
  readonly #buffer = new ReadBuffer({ maxBufferSize: MAX_MESSAGE_BYTES });
  #closed = false;

  constructor(socket: Socket) {
    this.#socket = socket;
  }

  start(): Promise<void> {
    this.#socket.on("data", this.#onData);
    this.#socket.on("error", this.#onError);
    this.#socket.on("close", this.#onClose);
    this.#socket.resume();
    return Promise.resolve();
  }

  send(message: JSONRPCMessage): Promise<void> {
    if (this.#closed) {
      return Promise.resolve();
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    if (this.#socket.write(serializeMessage(message))) {
      resolve();
    } else {
      this.#socket.once("drain", () => resolve());
    }
    return promise;
  }

  close(): Promise<void> {
    this.#socket.destroy();
    this.#onClose();
    return Promise.resolve();
  }

  readonly #onData = (chunk: Buffer): void => {
    try {
      this.#buffer.append(chunk);
      for (
        let message = this.#buffer.readMessage();
        message !== null;
        message = this.#buffer.readMessage()
      ) {
        this.onmessage?.(message);
      }
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      this.#socket.destroy();
      this.#onClose();
    }
  };

  readonly #onError = (error: Error): void => {
    this.onerror?.(error);
  };

  readonly #onClose = (): void => {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#socket.off("data", this.#onData);
    this.#buffer.clear();
    this.onclose?.();
  };
}
