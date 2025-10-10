import fs from 'fs';
import parseLcov from 'parse-lcov';

export const getSonarCoverage = (opts) => {
  try {
    // Check if the file path is provided
    if (!opts.sonarCoveragePath) {
      throw new Error('Sonar coverage path is required');
    }

    // Check if the file exists
    if (!fs.existsSync(opts.sonarCoveragePath)) {
      throw new Error(`Coverage file not found: ${opts.sonarCoveragePath}`);
    }

    const content = fs.readFileSync(opts.sonarCoveragePath, 'utf8');

    // Check if the file is empty
    if (!content.trim()) {
      throw new Error(`Coverage file is empty: ${opts.sonarCoveragePath}`);
    }

    const parsed = parseLcov(content);
    const coverageMap = {};

    parsed.forEach((entry) => {
      const { file, lines, branches } = entry;
      const LC = lines.hit;
      const EL = lines.found;
      const CT = branches.hit;
      const B = branches.found;
      const coverage = ((LC + CT) / (EL + B)) * 100;
      coverageMap[file] = Math.round(coverage);
    });

    return coverageMap;
  } catch (error) {
    console.error('Error reading coverage file:', error.message);
    warn(`Error reading coverage file: ${error.message}`);
    return {};
  }
};
