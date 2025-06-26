import path from 'path';
import mockFs from 'mock-fs';

import coverage from '../../src';
import { CLOVER_PATH, DEFAULT_METRICS, DEFAULT_LINE } from '../constants';
import {
  getFileXml,
  getMarkdownReport,
  setupEnv,
  translateMetric,
  wrapXmlReport,
} from '../utils';

const successMessage = '> :+1: Test coverage is looking good.';

const failureMessage = '> Test coverage is looking a little low for the files '
  + 'created or modified in this PR, perhaps we need to improve this.';

describe('Coverage Plugin', () => {
  beforeEach(setupEnv);

  afterEach(() => {
    mockFs.restore();
  });

  it('reports row as passing when all metrics meet the threshold', async () => {
    const file = getFileXml('src/one.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain('|src/one.js|100|100|100|100||:white_check_mark:|');
  });

  it.each([
    'statements',
    'conditionals',
    'methods',
  ])('reports row as failing when %s does not meet the threshold', async (metric) => {
    const file = getFileXml('src/one.js', {
      ...DEFAULT_METRICS,
      [metric]: 10,
      [`covered${metric}`]: 0,
    }, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport(file);
    const row = [
      '',
      'src/one.js',
      metric === 'statements' ? '0' : '100',
      metric === 'conditionals' ? '0' : '100',
      metric === 'methods' ? '0' : '100',
      '100', // lines tested separately
      '',
      ':x:',
      '',
    ].join('|');

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(failureMessage);
    expect(lines).toContain(`Coverage threshold for ${translateMetric(metric)} (80%) not met: 0%`);
    expect(lines).toContain(row);
  });

  it('reports row as failing when lines does not meet the threshold', async () => {
    const file = getFileXml('src/one.js', DEFAULT_METRICS, [
      {
        num: 1,
        count: 0,
        type: 'stmt',
      },
    ]);
    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(failureMessage);
    expect(lines).toContain('Coverage threshold for lines (80%) not met: 0%');
    expect(lines).toContain('|src/one.js|100|100|100|0|1|:x:|');
  });

  it.each(['project', 'package'])('handles multiple %ss', async (parentElement) => {
    const fileOne = getFileXml('src/one.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const fileTwo = getFileXml('src/two.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const fileThree = getFileXml('src/three.js', DEFAULT_METRICS, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport(`
      <${parentElement}>
        ${fileOne}
      </${parentElement}>
      <${parentElement}>
        ${fileTwo}
      </${parentElement}>
      <${parentElement}>
        ${fileThree}
      </${parentElement}>
    `);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: [
          'src/one.js',
          'src/two.js',
          'src/three.js',
        ],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain('|src/one.js|100|100|100|100||:white_check_mark:|');
    expect(lines).toContain('|src/two.js|100|100|100|100||:white_check_mark:|');
    expect(lines).toContain('|src/three.js|100|100|100|100||:white_check_mark:|');
  });

  it('only includes rows that have been created or modified', async () => {
    const fileOne = getFileXml('src/one.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const fileTwo = getFileXml('src/two.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const fileThree = getFileXml('src/three.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const xmlReport = wrapXmlReport([
      fileOne,
      fileTwo,
      fileThree,
    ].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: ['src/two.js'],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).not.toContain('|src/three.js|100|100|100|100||:white_check_mark:|');
  });

  it('adds any extra rows to a details block', async () => {
    const files = new Array(10).fill().map((_, i) => (
      getFileXml(i, DEFAULT_METRICS, [DEFAULT_LINE])
    ));
    const xmlReport = wrapXmlReport(files.join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: new Array(10).fill().map((_, i) => String(i)),
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain('and 7 more...');
  });

  it('passes if no total for each metric', async () => {
    const file = getFileXml('src/one.js', {
      statements: 0,
      coveredstatements: 0,
      conditionals: 0,
      coveredconditionals: 0,
      methods: 0,
      coveredmethods: 0,
    }, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain('|src/one.js|100|100|100|100||:white_check_mark:|');
  });

  it('ignores the row if no lines', async () => {
    const file = getFileXml('src/one.js', {
      statements: 0,
      coveredstatements: 0,
      conditionals: 0,
      coveredconditionals: 0,
      methods: 0,
      coveredmethods: 0,
    }, []);

    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain('|src/one.js|-|-|-|-||-|');
  });

  it('shortens and wraps long paths', async () => {
    const seg = new Array(10).fill('x').join('');
    const longPath = new Array(10).fill(seg).join('/');
    const file = getFileXml(longPath, DEFAULT_METRICS, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: [longPath],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(successMessage);
    expect(lines).toContain(
      `|../${seg}/${seg}/<br>${seg}/${seg}/<br>${seg}/${seg}/<br>${seg}/${seg}|100|100|100|100||:white_check_mark:|`,
    );
  });

  it('includes two digits after the decimal point', async () => {
    const file = getFileXml('src/one.js', {
      statements: 21,
      coveredstatements: 20,
      conditionals: 9,
      coveredconditionals: 3,
      methods: 3,
      coveredmethods: 2,
    }, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport(file);

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain(failureMessage);
    expect(lines).toContain('Coverage threshold for branches (80%) not met: 33.33%');
    expect(lines).toContain('Coverage threshold for functions (80%) not met: 66.67%');
    expect(lines).toContain('|src/one.js|95.24|33.33|66.67|100||:x:|');
  });

  it('includes a link to the committed file', async () => {
    const fileOne = getFileXml('src/one.js', DEFAULT_METRICS, [DEFAULT_LINE]);
    const fileTwo = getFileXml('src/two.js', DEFAULT_METRICS, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport([
      fileOne,
      fileTwo,
    ].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js', 'src/two.js'],
        modified_files: [],
        commits: [{ sha: 'abc123' }],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain('|[src/one.js](../blob/abc123/src/one.js)|100|100|100|100||:white_check_mark:|');
    expect(lines).toContain('|[src/two.js](../blob/abc123/src/two.js)|100|100|100|100||:white_check_mark:|');
  });

  it('does not report anything if no coverage reported', async () => {
    mockFs();

    await coverage();

    expect(getMarkdownReport()).toBeUndefined();
  });

  it('does not report anything if no coverage reported for the files changed', async () => {
    const fileOne = getFileXml('src/one.js', DEFAULT_METRICS, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport([fileOne].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['package.json'],
        modified_files: ['package.json', 'yarn.lock'],
        commits: [{ sha: 'abc123' }],
      },
    });

    await coverage();

    expect(getMarkdownReport()).toBeUndefined();
  });

  it('handles relative paths correctly', async () => {
    const fileOne = getFileXml(path.join(process.cwd(), '/src/index.js'), DEFAULT_METRICS, [DEFAULT_LINE]);

    const xmlReport = wrapXmlReport([fileOne].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/index.js'],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain('|src/index.js|100|100|100|100||:white_check_mark:|');
  });

  it('reports uncovered lines', async () => {
    const getUncoveredLine = (num) => ({
      num,
      count: 0,
      type: 'stmt',
    });

    const fileOneLines = new Array(11).fill().map((_, i) => getUncoveredLine(i + 1));
    const fileOne = getFileXml(path.join(process.cwd(), '/src/one.js'), DEFAULT_METRICS, fileOneLines);

    const fileTwoLines = [getUncoveredLine(1)];
    const fileTwo = getFileXml(path.join(process.cwd(), '/src/two.js'), DEFAULT_METRICS, fileTwoLines);

    const xmlReport = wrapXmlReport([
      fileOne,
      fileTwo,
    ].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: [
          'src/one.js',
          'src/two.js',
        ],
        modified_files: [],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');

    expect(report).toMatchSnapshot();
    expect(lines).toContain('|src/one.js|100|100|100|0|1, 2, 3, 4, 5, 6, 7, 8, 9, 10...|:x:|');
    expect(lines).toContain('|src/two.js|100|100|100|0|1|:x:|');
  });

  it('reports uncovered lines with link if sha available', async () => {
    const file = getFileXml(path.join(process.cwd(), '/src/one.js'), DEFAULT_METRICS, [
      {
        num: 1,
        count: 0,
        type: 'stmt',
      },
    ]);

    const xmlReport = wrapXmlReport([file].join('\n'));

    mockFs({
      [CLOVER_PATH]: xmlReport,
    });

    Object.assign(danger, {
      git: {
        created_files: ['src/one.js'],
        modified_files: [],
        commits: [{ sha: 'abc123' }],
      },
    });

    await coverage();

    const report = getMarkdownReport();
    const lines = report.split('\n');
    const fileLink = '../blob/abc123/src/one.js';

    expect(report).toMatchSnapshot();
    expect(lines).toContain(`|[src/one.js](${fileLink})|100|100|100|0|[1](${fileLink}#L1)|:x:|`);
  });
});
