import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

class FakeElement {
  classes = new Set<string>();
  className = '';
  src = '';
  alt = '';
  removed = false;
  classList = {
    add: (c: string) => this.classes.add(c),
    remove: (c: string) => this.classes.delete(c),
  };
  remove() { this.removed = true; }
}

function setupRotator(responses: Array<unknown>) {
  const disclaimer = new FakeElement();
  const images: FakeElement[] = [];
  const container = {
    appendChild: (el: FakeElement) => images.push(el),
    querySelectorAll: () => images.filter((img) => !img.removed),
  };
  const fetch = jest.fn(async () => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: true, json: async () => next };
  });
  const filename = path.resolve(__dirname, '../../public/js/modules/bannerRotator.js');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports: { createBannerRotator?: (c: unknown, d: unknown) => { reload: () => Promise<void> } } = {};
  vm.runInNewContext(outputText, {
    exports,
    document: { createElement: () => new FakeElement() },
    fetch,
    console: { warn: jest.fn() },
    setTimeout,
    clearTimeout,
    encodeURIComponent,
  }, { filename });
  const rotator = exports.createBannerRotator!(container, disclaimer);
  const visible = () => [disclaimer, ...images.filter((img) => !img.removed)].filter((el) => el.classes.has('active'));
  return { rotator, disclaimer, images, visible, fetch };
}

const banner = (id: string, durationSec: number, enabled = true) => ({ id, filename: `${id}.png`, durationSec, enabled });

describe('banner rotator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('rotates disclaimer and enabled banners with their own durations', async () => {
    const { rotator, disclaimer, images, visible } = setupRotator([
      { showDisclaimer: true, disclaimerSec: 5, banners: [banner('a', 3), banner('off', 3, false), banner('b', 4)] },
    ]);
    await rotator.reload();
    expect(images.map((img) => img.src)).toEqual(['/banners/image/a.png', '/banners/image/b.png']);
    expect(visible()).toEqual([disclaimer]);
    jest.advanceTimersByTime(5000);
    expect(visible()).toEqual([images[0]]);
    jest.advanceTimersByTime(3000);
    expect(visible()).toEqual([images[1]]);
    jest.advanceTimersByTime(4000);
    expect(visible()).toEqual([disclaimer]);
  });

  it('shows only the disclaimer when there are no enabled banners or fetching fails', async () => {
    const { rotator, disclaimer, visible } = setupRotator([
      { showDisclaimer: false, disclaimerSec: 5, banners: [banner('off', 3, false)] },
      new Error('offline'),
    ]);
    await rotator.reload();
    expect(visible()).toEqual([disclaimer]);
    await rotator.reload();
    expect(visible()).toEqual([disclaimer]);
    jest.advanceTimersByTime(60_000);
    expect(visible()).toEqual([disclaimer]);
  });

  it('hides the initially active disclaimer when it is switched off', async () => {
    const { rotator, disclaimer, images, visible } = setupRotator([
      { showDisclaimer: false, disclaimerSec: 5, banners: [banner('a', 3)] },
    ]);
    disclaimer.classList.add('active'); // as rendered by screen.html
    await rotator.reload();
    expect(visible()).toEqual([images[0]]);
  });

  it('reload replaces old slides and stops the old timer', async () => {
    const { rotator, images, visible } = setupRotator([
      { showDisclaimer: false, disclaimerSec: 5, banners: [banner('a', 3), banner('b', 3)] },
      { showDisclaimer: false, disclaimerSec: 5, banners: [banner('c', 10)] },
    ]);
    await rotator.reload();
    jest.advanceTimersByTime(3000);
    await rotator.reload();
    expect(images.filter((img) => !img.removed).map((img) => img.src)).toEqual(['/banners/image/c.png']);
    expect(visible()).toEqual([images[2]]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
