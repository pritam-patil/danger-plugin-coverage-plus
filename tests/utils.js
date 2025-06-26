import path from 'path';

const mockDangerGlobals = () => {
  global.fail = jest.fn();
  global.markdown = jest.fn();
  global.message = jest.fn();
  global.peril = jest.fn();
  global.schedule = jest.fn();
  global.warn = jest.fn();

  global.danger = {};
};

export const setupEnv = () => {
  mockDangerGlobals();
};

export const wrapXmlReport = (rows) => `
  <?xml version="1.0" encoding="UTF-8"?>
  <coverage generated="123" clover="3.2.0">
    <project timestamp="123" name="All files">
      ${rows}
    </project>
  </coverage>
`;

export const mapAttrs = (attrs) => Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ');

export const getFileXml = (filePath, metrics, lines = []) => `
  <file
    name="${path.basename(String(filePath))}"
    path="${filePath}"
  >
    <metrics ${mapAttrs(metrics)} />
    ${lines.map((line) => `<line ${mapAttrs(line)} />`)}
  </file>
`;

export const getMarkdownReport = () => markdown.mock.calls?.[0]?.[0];

export const translateMetric = (metric) => ({
  statements: 'statements',
  methods: 'functions',
  conditionals: 'branches',
}[metric] || metric);
