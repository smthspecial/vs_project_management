import { WebviewMessage } from "./types";

// acquireVsCodeApi() may only be called once per webview. Export a shared singleton.
declare const acquireVsCodeApi: () => {
  postMessage(msg: WebviewMessage): void;
  getState<T = unknown>(): T | undefined;
  setState<T = unknown>(state: T): void;
};

export const vscode = acquireVsCodeApi();
