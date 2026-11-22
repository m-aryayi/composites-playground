/** Small test runner: suites, deep compare with tolerance, and a result list. */

const RELATIVE_TOLERANCE = 1.0e-9;
const ABSOLUTE_TOLERANCE = 1.0e-12;
const MAX_REPORTED = 5;              // mismatches shown for one failed test

/** Return the largest absolute number in a value (numbers and nested arrays). */
function largest(value) {
    if (typeof value === "number") {
        return Math.abs(value);
    }
    if (Array.isArray(value)) {
        return value.reduce((most, item) => Math.max(most, largest(item)), 0);
    }
    return 0;
}

/** Add the differences of actual and expected at path to the list. */
function differences(actual, expected, path, scale, found) {
    if (found.length >= MAX_REPORTED) {
        return;
    }
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            found.push(`${path}: length ${actual?.length} `
                       + `instead of ${expected.length}`);
            return;
        }
        expected.forEach((item, index) => {
            differences(actual[index], item, `${path}[${index}]`, scale, found);
        });
        return;
    }
    // JSON has no NaN: null in the golden values means "NaN expected".
    if (expected === null) {
        if (!(actual === null || Number.isNaN(actual))) {
            found.push(`${path}: ${actual} instead of NaN`);
        }
        return;
    }
    if (typeof expected === "number") {
        const limit = ABSOLUTE_TOLERANCE + RELATIVE_TOLERANCE * scale;
        if (typeof actual !== "number" || !(Math.abs(actual - expected) <= limit)) {
            found.push(`${path}: ${actual} instead of ${expected}`);
        }
        return;
    }
    if (actual !== expected) {
        found.push(`${path}: ${JSON.stringify(actual)} `
                   + `instead of ${JSON.stringify(expected)}`);
    }
}

/**
 * Throw if actual differs from expected.
 *
 * Numbers may differ by 1e-12 + 1e-9 * scale. The default scale is the
 * largest number in expected, so round-off near zero does not fail a test.
 */
export function expectClose(actual, expected, { scale, label = "value" } = {}) {
    const found = [];
    differences(actual, expected, label, scale ?? largest(expected), found);
    if (found.length > 0) {
        throw new Error(found.join("\n"));
    }
}

/** Throw if a condition is false. */
export function expectTrue(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/** Return a new element with a class and a text. */
function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

/** Run the tests of one suite and return [passed, failures]. */
async function runSuite(definition) {
    const tests = [];
    const suite = { test: (name, fn) => tests.push({ name, fn }) };
    try {
        await definition.register(suite);
    } catch (error) {
        tests.push({ name: "Load the suite", fn: () => { throw error; } });
    }
    let passed = 0;
    const failures = [];
    for (const { name, fn } of tests) {
        try {
            await fn();
            passed += 1;
        } catch (error) {
            failures.push({ name, message: error.message });
        }
    }
    return { total: tests.length, passed, failures };
}

/**
 * Run all suites and show the results.
 *
 * A suite is { name, register(suite) }; register adds tests with
 * suite.test(name, fn). A test passes when fn does not throw.
 */
export async function runSuites(definitions, list, summary) {
    let total = 0;
    let passed = 0;
    for (const definition of definitions) {
        const result = await runSuite(definition);
        total += result.total;
        passed += result.passed;
        const ok = result.failures.length === 0;
        const group = element("section", "card test-group");
        const head = element("div", "test-group__head");
        const count = `${ok ? "✓" : "✕"} ${result.passed} of ${result.total}`;
        head.append(element("h2", "", definition.name),
                    element("span", `pill ${ok ? "pill--yes" : "pill--no"}`, count));
        group.append(head);
        for (const failure of result.failures) {
            const item = element("div", "test-failure");
            item.append(element("strong", "", `✕ ${failure.name}`),
                        element("pre", "code-block", failure.message));
            group.append(item);
        }
        list.append(group);
    }
    const ok = passed === total;
    summary.className = `pill ${ok ? "pill--yes" : "pill--no"}`;
    summary.textContent = `${ok ? "✓" : "✕"} ${passed} of ${total} checks pass`;
}
