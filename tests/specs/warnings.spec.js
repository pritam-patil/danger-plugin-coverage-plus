import mockFs from 'mock-fs';

import coverage from '../../src';
import { setupEnv } from '../utils';

describe('Warnings', () => {
  beforeEach(setupEnv);

  afterEach(() => {
    mockFs.restore();
  });

  it('warns if no report detected', async () => {
    mockFs();

    Object.assign(danger, {
      git: {
        created_files: ['from-custom-report.js'],
        modified_files: [],
      },
    });

    await coverage();

    const [warning] = warn.mock.calls?.[0] || [];

    expect(warning).toMatch(/No coverage report.*/);
    expect(warning).toMatchSnapshot();
  });

  it('does not log any warnings on no report if disabled', async () => {
    mockFs();

    Object.assign(danger, {
      git: {
        created_files: ['from-custom-report.js'],
        modified_files: [],
      },
    });

    await coverage({ warnOnNoReport: false });

    const [warning] = warn.mock.calls?.[0] || [];

    expect(warning).toBeUndefined();
  });
});
