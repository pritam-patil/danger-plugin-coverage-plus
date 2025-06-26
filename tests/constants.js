import path from 'path';

export const CLOVER_PATH = path.join(process.cwd(), 'coverage', 'clover.xml');

export const DEFAULT_METRICS = {
  statements: 10,
  coveredstatements: 10,
  conditionals: 10,
  coveredconditionals: 10,
  methods: 10,
  coveredmethods: 10,
};

export const DEFAULT_LINE = {
  num: 1,
  count: 1,
  type: 'stmt',
};
