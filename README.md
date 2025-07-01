# danger-plugin-coverage-plus

[![npm version](https://badge.fury.io/js/danger-plugin-coverage-plus.svg)](https://badge.fury.io/js/danger-plugin-coverage-plus)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

> A Danger plugin to report code coverage.

This plugin detects and parses coverage reports, posting the results as a
Markdown table back to the pull request.

It uses the `clover.xml` format, which is output by [Istanbul](https://istanbul.js.org/),
a coverage reporter integrated with JavaScript testing tools such as
[Jest](https://jestjs.io/) and [Karma](https://karma-runner.github.io/).

This format can also be output by testing libraries for other languages, such as
[PHPUnit](https://phpunit.de/). So, while this is primarily intended as a tool
to run against JavaScript packages it would technically work as a coverage
reporter for other languages too.

<details>
  <summary>View an example report</summary>

## Coverage Report

> Test coverage is looking a little low for the files created or modified in this PR, perhaps we need to improve this.

```
Coverage threshold for branches (80%) not met: 49.08%
Coverage threshold for functions (80%) not met: 74.46%
```

|Impacted Files|% Stmts|% Branch|% Funcs|% Line|Uncovered Lines||
|---|:-:|:-:|:-:|:-:|:-:|:-:|
|[src/module-one.js]()|100|100|100|100||:white_check_mark:|
|[src/module-two.js]()|95.24|33.33|66.67|80|[1](), [42](), [1337]()...|:x:|
|[src/module-three.js]()|82.33|10.25|44.55|45.55|[12](), [15](), [32]()...|:x:|
|[src/module-four.js]()|100|0|10|32.5|[54](), [65](), [94]()...|:x:|
|[src/module-five.js]()|100|100|100|100||:white_check_mark:|

<details>
<summary>
and 2 more...
</summary>

|Impacted Files|% Stmts|% Branch|% Funcs|% Line|Uncovered Lines||
|---|:-:|:-:|:-:|:-:|:-:|:-:|
|[src/module-six.js]()|100|100|100|100||:white_check_mark:|
|[src/module-seven.js]()|100|100|100|100||:white_check_mark:|
</details>

</details>

## Usage

Install:

```sh
yarn add danger-plugin-coverage-plus --dev
```

At a glance:

```js
// dangerfile.js
import coverage from 'danger-plugin-coverage-plus';

schedule(coverage());
```

Note that the coverage report output by your test runner must exist before Danger
is run. By default we will look for the report at `coverage/clover.xml`, which
is the default output location for Jest.

## Settings

The function accepts a settings object with the following properties:

| name                 | description                                                                                  |
|----------------------|----------------------------------------------------------------------------------------------|
| `title`             | Custom title for the coverage report (defaults to "Coverage Report").                         |
| `note`              | Optional note to display below the title.                                                     |
| `successMessage`     | A custom message to show when coverage is above the threshold.                               |
| `failureMessage`     | A custom message to show when coverage is below the threshold.                               |
| `cloverReportPath`   | Override automatic coverage report detection to provide the relative path to a report.       |
| `maxRows`            | The number of rows to show (additional rows will be collapsed within a `<details>` element). |
| `maxChars`           | The maximum number of characters to allow in a file name cell.                               |
| `maxUncovered`       | The maximum number of uncovered lines to show.                                               |
| `wrapFilenames`      | Wrap long file names to help the table fit in a PR comment.                                  |
| `threshold`          | The thresholds at which to show the failure messaging.                                       |
| `warnOnNoReport`     | Show a warning if no coverage report was detected.                                           |
| `onFailure`          | Custom handler for failures.                                           |
| `altFileUrl`           | Base URL path to use for file links instead of GitHub blob links.                            |
| `altFileUrlSuffix`     | Suffix to append to file paths when generating links.                                        |
| `replaceFilePrefix`     | Prefix to remove from file paths when generating links.                                      |

**Example (defaults shown):**

```js
import coverage from 'danger-plugin-coverage-plus';

schedule(coverage({
  title: "Custom Coverage Report",
  note: "View content by clicking on file names"
  successMessage: ':+1: Test coverage is looking good.',
  failureMessage: 'Test coverage is looking a little low for the files created '
    + 'or modified in this PR, perhaps we need to improve this.',
  cloverReportPath: './coverage/clover.xml',
  maxRows: 3,
  maxChars: 100,
  maxUncovered: 10,
  wrapFilenames: true,
  warnOnNoReport: true,
  showAllFiles: false,
  threshold: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  onFailure: function log() { markdown("Failure") },
  altFileUrl: 'https://coverage.example.com', // Coverage report is hosted here
  altFileUrlSuffix: ".html",
  replaceFilePrefix: 'src/js', // Remove this prefix from file paths when generating coverage report links
}));
```