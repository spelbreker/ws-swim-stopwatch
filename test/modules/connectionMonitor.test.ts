import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

type Monitor = { handle: (event: string) => void; isOnline: () => boolean };
type CreateMonitor = (opts: { onChange: (online: boolean) => void; timeoutMs?: number; checkMs?: number }) => Monitor;

function loadCreateMonitor(): CreateMonitor {
  const filename = path.resolve(__dirname, '../../public/js/modules/connectionMonitor.js');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const exports: { createConnectionMonitor?: CreateMonitor } = {};
  vm.runInNewContext(outputText, { exports, Date, setInterval, clearInterval }, { filename });
  return exports.createConnectionMonitor!;
}

describe('connectionMonitor', () => {
  let onChange: jest.Mock;
  let monitor: Monitor;

  beforeEach(() => {
    jest.useFakeTimers();
    onChange = jest.fn();
    monitor = loadCreateMonitor()({ onChange });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays silent while connecting', () => {
    jest.advanceTimersByTime(60_000);
    expect(onChange).not.toHaveBeenCalled();
    expect(monitor.isOnline()).toBe(false);
  });

  it('reports online on open and offline on close', () => {
    monitor.handle('open');
    expect(onChange).toHaveBeenLastCalledWith(true);
    monitor.handle('close');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('reports offline when the server goes silent while the socket looks open', () => {
    monitor.handle('open');
    jest.advanceTimersByTime(12_000);
    expect(onChange).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(monitor.isOnline()).toBe(false);
  });

  it('keeps the connection alive as long as messages arrive', () => {
    monitor.handle('open');
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(5000);
      monitor.handle('message');
    }
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('recovers when a message arrives after a silent period', () => {
    monitor.handle('open');
    jest.advanceTimersByTime(13_000);
    monitor.handle('message');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('ignores messages after close and leaves no timer running', () => {
    monitor.handle('open');
    monitor.handle('close');
    monitor.handle('message');
    expect(monitor.isOnline()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
