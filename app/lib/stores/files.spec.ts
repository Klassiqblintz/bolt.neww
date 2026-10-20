import type { WebContainer } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import { FilesStore } from '~/lib/stores/files';

const WORK_DIR = '/home/project';

function createStore() {
  const writeFile = vi.fn().mockResolvedValue(undefined);

  const webcontainer = {
    workdir: WORK_DIR,
    fs: { writeFile },
    internal: { watchPaths: vi.fn() },
  } as unknown as WebContainer;

  const store = new FilesStore(Promise.resolve(webcontainer));

  return { store, writeFile };
}

describe('FilesStore', () => {
  it('saves a file that has content', async () => {
    const { store, writeFile } = createStore();

    store.files.setKey(`${WORK_DIR}/index.html`, { type: 'file', content: '<h1>hi</h1>', isBinary: false });

    await store.saveFile(`${WORK_DIR}/index.html`, '<h1>hello</h1>');

    expect(writeFile).toHaveBeenCalledWith('index.html', '<h1>hello</h1>');
  });

  it('saves a file whose content was emptied', async () => {
    const { store, writeFile } = createStore();

    store.files.setKey(`${WORK_DIR}/empty.txt`, { type: 'file', content: '', isBinary: false });

    await store.saveFile(`${WORK_DIR}/empty.txt`, '');

    expect(writeFile).toHaveBeenCalledWith('empty.txt', '');
  });

  it('records the original content as a modification', async () => {
    const { store } = createStore();

    store.files.setKey(`${WORK_DIR}/index.html`, { type: 'file', content: 'before', isBinary: false });

    await store.saveFile(`${WORK_DIR}/index.html`, 'after');

    const modifications = store.getFileModifications() ?? {};

    expect(Object.keys(modifications)).toEqual([`${WORK_DIR}/index.html`]);
  });

  it('rejects a path that is not a known file', async () => {
    const { store, writeFile } = createStore();

    await expect(store.saveFile(`${WORK_DIR}/missing.txt`, 'content')).rejects.toThrow();

    expect(writeFile).not.toHaveBeenCalled();
  });
});
