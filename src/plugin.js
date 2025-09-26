import path from "path";

import { getCoverageReport } from "./report";

const newLine = "\n";

/**
 * Get flatened file details.
 */
const getFlatFiles = (coverage) => {
  const parentKey = ["project", "package"].find((key) => key in coverage);

  if (parentKey) {
    return [].concat(...coverage[parentKey].map((item) => getFlatFiles(item)));
  }

  return coverage.file || [];
};

/**
 * Converts Jest coverage metrics to SonarQube format
 *
 * Based on observation, SonarQube's UI appears to prioritize line coverage
 * more heavily than the documented formula suggests.
 */
function convertJestToSonarQube(jestMetrics) {
  const {
    statements,
    coveredstatements,
    conditionals,
    coveredconditionals,
    methods,
    coveredmethods,
    lines,
    coveredlines,
  } = jestMetrics;

  // SonarQube variables
  const CT = coveredconditionals; // Conditions evaluated to true at least once
  const B = conditionals || 1; // Total conditions (avoid division by zero)
  const LC = coveredlines; // Covered lines
  const EL = lines || 1; // Total executable lines (avoid division by zero)

  // Calculate individual coverage metrics
  const lineCoverage = LC / EL;
  const branchCoverage = B > 0 ? CT / B : 1; // If no branches, consider 100% covered

  // Calculate weighted average (80% line coverage, 20% branch coverage)
  // This appears to most closely match SonarQube's UI display
  const weightedAverage = lineCoverage * 0.8 + branchCoverage * 0.2;

  // Format as percentage
  const coveragePercentage = (weightedAverage * 100).toFixed(2);

  // For backward compatibility, calculate the original formula as well
  const originalSonarFormula = (CT + LC) / (B + EL);
  const originalCoveragePercentage = (originalSonarFormula * 100).toFixed(2);

  // Additional metrics that might be useful
  return {
    // Core SonarQube metrics
    conditions: B,
    uncovered_conditions: B - CT,
    covered_conditions: CT,
    lines_to_cover: EL,
    uncovered_lines: EL - LC,
    covered_lines: LC,

    // SonarQube formula components
    CT,
    B,
    LC,
    EL,

    // Final coverage metrics
    line_coverage: lineCoverage.toFixed(4),
    line_coverage_pct: (lineCoverage * 100).toFixed(2) + "%",
    branch_coverage: branchCoverage.toFixed(4),
    branch_coverage_pct: (branchCoverage * 100).toFixed(2) + "%",

    // New weighted coverage (matches SonarQube UI better)
    coverage_raw: weightedAverage.toFixed(4),
    coverage_pct: coveragePercentage + "%",

    // Original formula (kept for reference)
    original_coverage_raw: originalSonarFormula.toFixed(4),
    original_coverage_pct: originalCoveragePercentage + "%",

    // Additional Jest metrics
    statements_coverage:
      ((coveredstatements / statements) * 100).toFixed(2) + "%",
    functions_coverage: ((coveredmethods / methods) * 100).toFixed(2) + "%",
  };
}

/**
 * Get the percentage covered for a given metric.
 */
const getCoveredPercentage = (covered, total) => {
  const percentage = (covered / total) * 100;

  if (!Number(total)) {
    return 100;
  }

  if (Number.isNaN(percentage)) {
    return "-";
  }

  return Number(percentage.toFixed(2));
};

/**
 * Get the percentages for all metrics.
 */
const getMetricPercentages = (jestMetrics) => {
  const {
    statements,
    coveredstatements,
    conditionals,
    coveredconditionals,
    methods,
    coveredmethods,
    lines,
    coveredlines,
  } = jestMetrics;
  const sonarMetrics = convertJestToSonarQube(jestMetrics);

  return {
    coverage: sonarMetrics.coverage_pct,
    statements: getCoveredPercentage(coveredstatements, statements),
    branches: getCoveredPercentage(coveredconditionals, conditionals),
    functions: getCoveredPercentage(coveredmethods, methods),
    lines: getCoveredPercentage(coveredlines, lines),
  };
};

/**
 * Get the metrics for a file.
 */
const getFileMetrics = (file) => {
  const { line: lines = [], metrics } = file;
  const fileMetrics = metrics?.[0].$ || {};

  const uncoveredLines = lines.filter((line) => !Number(line.$?.count || 0));

  return {
    ...fileMetrics,
    lines: lines.length,
    coveredlines: lines.length - uncoveredLines.length,
    uncoveredLines,
  };
};

/**
 * Shorten a path so that it fits in a GitHub comment.
 */
const getShortPath = (filePath, maxChars) => {
  const parts = filePath
    .split("/")
    .reverse()
    .filter((x) => x);

  if (parts.length === 1) {
    return filePath;
  }

  const shortParts = [];

  let currentChars = 0;

  parts.forEach((part, index) => {
    const isLastPart = parts.length - 1 === index;
    currentChars += part.length + 1; // +1 for the path seperator
    const prefixLength = !isLastPart ? 3 : 0;

    if (currentChars + prefixLength < maxChars) {
      shortParts.push(part);
    }
  });

  if (shortParts.length < parts.length) {
    shortParts.push("..");
  }

  return shortParts.reverse().join("/");
};

// replace the replaceFilePrefix with an empty string
const getTrimmedPath = (filePath, replaceFilePrefix) => {
  const trimmedPath = filePath.replace(replaceFilePrefix, "");
  return trimmedPath;
};

/**
 * Insert whitespace into a path so that it wraps within the Markdown table.
 */
const getWrappedPath = (filePath) => {
  const parts = filePath.split("/");
  const maxPerLine = 25;
  let currentChars = 0;

  return parts
    .map((pathPart, i) => {
      const isLastPart = parts.length - 1 === i;
      const newPart = isLastPart ? pathPart : `${pathPart}/`;
      currentChars += pathPart.length;

      if (currentChars + (parts[i + 1]?.length || 0) > maxPerLine) {
        currentChars = 0;
        return `${newPart}<br>`;
      }

      return newPart;
    })
    .join("");
};

/**
 * Check if we have passed the thresholds for the given percentages.
 */
const hasPassed = (threshold, { statements, branches, functions, lines }) =>
  (Number(statements) >= threshold.statements || statements === "-") &&
  (Number(branches) >= threshold.branches || branches === "-") &&
  (Number(functions) >= threshold.functions || functions === "-") &&
  (Number(lines) >= threshold.lines || lines === "-");

/**
 * Build a row for the coverage table.
 */
const buildRow = (
  file,
  {
    threshold,
    maxChars,
    maxUncovered,
    wrapFilenames,
    altFileUrl,
    altFileUrlSuffix, // add this suffix to the file path
    replaceFilePrefix, // replace the filePath with this prefix
  }
) => {
  const fileMetrics = getFileMetrics(file);

  const { sha } = danger.git?.commits?.[danger.git.commits.length - 1] || {};

  const longPath = path.relative(process.cwd(), file.$.path);
  const shortPath = getShortPath(longPath, maxChars);
  const readablePath = wrapFilenames ? getWrappedPath(shortPath) : shortPath;

  const fileLink = altFileUrl
    ? `${altFileUrl}/${getTrimmedPath(
        longPath,
        replaceFilePrefix
      )}${altFileUrlSuffix}`
    : `../blob/${sha}/${longPath}`;
  const fileCell = sha ? `[${readablePath}](${fileLink})` : readablePath;

  const percentages = getMetricPercentages(fileMetrics);

  const noLines = !fileMetrics.lines;
  let emoji = hasPassed(threshold, percentages) ? ":white_check_mark:" : ":x:";

  if (noLines) {
    emoji = "-";
  }

  let uncoveredCell = fileMetrics.uncoveredLines
    .slice(0, maxUncovered)
    .map((line) => {
      const lineNumber = line.$.num;
      const anchor = `#L${lineNumber}`;

      return sha ? `[${lineNumber}](${fileLink + anchor})` : lineNumber;
    })
    .join(", ");

  if (fileMetrics.uncoveredLines.length > maxUncovered) {
    uncoveredCell += "...";
  }

  return [
    "",
    fileCell,
    noLines ? "-" : percentages.coverage,
    noLines ? "-" : percentages.statements,
    noLines ? "-" : percentages.branches,
    noLines ? "-" : percentages.functions,
    noLines ? "-" : percentages.lines,
    uncoveredCell,
    emoji,
    "",
  ].join("|");
};

/**
 * Join items in a table row.
 */
const joinRow = (items) => `|${items.map((item) => item).join("|")}|`;

/**
 * Build the coverage table.
 */
const buildTable = (files, opts) => {
  const { maxRows, showAllFiles } = opts;

  const headings = [
    `${showAllFiles ? "" : "Impacted "}Files`,
    "% Sonar",
    "% Stmts",
    "% Branch",
    "% Funcs",
    "% Lines",
    "Uncovered Lines",
    "",
  ];

  const headingRow = joinRow(headings);
  const seperator = joinRow(
    new Array(headings.length).fill().reduce(
      (acc, _, index) => [
        ...acc,
        index === 0 ? "---" : ":-:", // Center align all but the first column
      ],
      []
    )
  );

  const allFileRows = files.map((file) => buildRow(file, opts));
  const mainFileRows = allFileRows.slice(0, maxRows);
  const extraFileRows = allFileRows.slice(maxRows);

  let table = [headingRow, seperator, ...mainFileRows].join(newLine);

  if (extraFileRows.length) {
    table += [
      newLine,
      "<details>",
      "<summary>",
      `and ${extraFileRows.length} more...`,
      "</summary>",
      "",
      headingRow,
      seperator,
      ...extraFileRows,
      "</details>",
    ].join(newLine);
  }

  return table;
};

/**
 * Get a line for the threshold summary.
 */
const getThresholdSummaryLine = (percentages, key, threshold) => {
  const wasMet = Number(percentages[key]) >= (threshold[key] || 0);

  if (wasMet) {
    return "";
  }

  return `Coverage threshold for ${key} (${threshold[key]}%) not met: ${percentages[key]}%`;
};

const hasSummaryPassed = (metrics, threshold) => {
  const percentages = getMetricPercentages(metrics);
  const passed = hasPassed(threshold, percentages);

  return passed;
};

/**
 * Build the test summary.
 */
const buildSummary = (
  metrics,
  { successMessage, failureMessage, threshold }
) => {
  const percentages = getMetricPercentages(metrics);
  const passed = hasSummaryPassed(metrics, threshold);

  const thresholdSummary = [
    getThresholdSummaryLine(percentages, "statements", threshold),
    getThresholdSummaryLine(percentages, "branches", threshold),
    getThresholdSummaryLine(percentages, "functions", threshold),
    getThresholdSummaryLine(percentages, "lines", threshold),
  ].filter((x) => !!x); // Remove empty strings

  if (passed) {
    return `> ${successMessage}`;
  }

  return [
    `> ${failureMessage}`,
    ...(thresholdSummary.length ? ["", "```", ...thresholdSummary, "```"] : []),
  ].join(newLine);
};

/**
 * Get the combined metrics for the checked files.
 */
const getCombinedMetrics = (files) =>
  files.reduce((acc, file) => {
    const fileMetrics = getFileMetrics(file);

    Object.keys(fileMetrics).forEach((key) => {
      acc[key] = acc[key] || 0 + Number(fileMetrics[key]);
    });

    return acc;
  }, {});

/**
 * Get the relevant files.
 */
const getRelevantFiles = (coverageXml, { showAllFiles }) => {
  const files = getFlatFiles(coverageXml);
  const allFiles = [
    ...(danger.git?.created_files || []),
    ...(danger.git?.modified_files || []),
  ];

  const relevantFiles = files.filter((file) =>
    allFiles.includes(path.relative(process.cwd(), file.$.path))
  );

  if (showAllFiles) {
    return files;
  }

  return relevantFiles;
};

/**
 * Report coverage.
 */
export const coverage = async (initialOpts = {}) => {
  const opts = {
    title: "Coverage Report",
    note: null,
    successMessage: ":+1: Test coverage is looking good.",
    failureMessage:
      "Test coverage is looking a little low for the files created " +
      "or modified in this PR, perhaps we need to improve this.",
    cloverReportPath: null,
    reporter: "jest", // or 'sonar'
    maxRows: 3,
    maxChars: 100,
    maxUncovered: 10,
    wrapFilenames: true,
    showAllFiles: false,
    warnOnNoReport: true,
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    ...initialOpts,
  };

  const coverageXml = await getCoverageReport(opts.cloverReportPath);

  if (!coverageXml) {
    if (opts.warnOnNoReport) {
      warn(
        "No coverage report was detected. " +
          "Please output a report in the `clover.xml` format before running danger"
      );
    }
    return;
  }

  const relevantFiles = getRelevantFiles(coverageXml, opts);

  if (!relevantFiles.length) {
    return;
  }

  const combinedMetrics = getCombinedMetrics(relevantFiles);
  const table = buildTable(relevantFiles, opts);
  const summary = buildSummary(combinedMetrics, opts);
  const report = [
    `## ${opts.title}`,
    opts.note ? `> ${opts.note}` : "",
    summary,
    table,
  ].join(newLine + newLine);

  markdown(report);

  const summaryPassed = hasSummaryPassed(combinedMetrics, opts.threshold);

  if (!summaryPassed && typeof opts.onFailure === "function") {
    opts.onFailure(combinedMetrics, opts);
  }
};
