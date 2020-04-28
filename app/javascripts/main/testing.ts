import { app, BrowserWindow } from 'electron';
import path from 'path';
import { MessageType, TestIPCMessage } from '../../../test/TestIpcMessage';
import { CommandLineArgs } from '../shared/CommandLineArgs';
import { isTesting } from './utils';

const messageHandlers: {
  [key in MessageType]?: (...args: any) => unknown;
} = {};

export function handle(type: MessageType, handler: (...args: any) => unknown) {
  if (!isTesting()) return;
  messageHandlers[type] = handler;
}

export function send(type: MessageType) {
  if (!isTesting()) return;
  process.send!({ type });
}

export function setupTesting() {
  /** Allow a custom userData path to be used. */
  const userDataPathIndex = process.argv.indexOf(CommandLineArgs.UserDataPath);
  if (userDataPathIndex > 0) {
    const userDataPath = process.argv[userDataPathIndex + 1];
    if (typeof userDataPath === 'string') {
      app.setPath('userData', path.resolve(userDataPath));
    }
  }

  process.on('message', async (message: TestIPCMessage) => {
    const handler = messageHandlers[message.type];

    if (!handler) {
      process.send!({
        id: message.id,
        reject: `No handler registered for message type ${
          MessageType[message.type]
        }`,
      });
      return;
    }

    try {
      let returnValue = handler(...message.args);
      if (returnValue instanceof Promise) {
        returnValue = await returnValue;
      }
      process.send!({
        id: message.id,
        resolve: returnValue,
      });
    } catch (error) {
      process.send!({
        id: message.id,
        reject: error.toString(),
      });
    }
  });

  handle(MessageType.WindowCount, () => BrowserWindow.getAllWindows().length);

  setTimeout(() => {
    send(MessageType.Ready);
  }, 100);
}
