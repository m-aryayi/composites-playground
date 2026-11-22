/** Small dense matrix helpers. A matrix is an array of rows of numbers. */

/** Return a rows x cols matrix of zeros. */
export function zeros(rows, cols) {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/** Return the transpose of a matrix. */
export function transpose(m) {
    return m[0].map((_, j) => m.map((row) => row[j]));
}

/** Return the product a b. */
export function matMul(a, b) {
    const result = zeros(a.length, b[0].length);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b[0].length; j += 1) {
            let sum = 0;
            for (let k = 0; k < b.length; k += 1) {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}

/** Return a new matrix with fn applied to each element. */
export function mapMatrix(m, fn) {
    return m.map((row) => row.map(fn));
}

/** Return the element-wise sum a + b. */
export function add(a, b) {
    return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

/** Return the part of m from row r0 to r1 and column c0 to c1 (ends excluded). */
export function block(m, r0, r1, c0, c1) {
    return m.slice(r0, r1).map((row) => row.slice(c0, c1));
}

/** Return the largest absolute value of a matrix or a vector. */
export function maxAbs(m) {
    return m.flat(Infinity)
        .reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
}

/**
 * Return x with a x = b (Gaussian elimination with partial pivoting).
 *
 * The same method as LAPACK dgesv (numpy.linalg.solve), so the results agree
 * to round-off.
 */
export function solve(a, b) {
    const n = a.length;
    const m = a.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }
        if (m[pivot][col] === 0) {
            throw new Error("The matrix is singular.");
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        for (let row = col + 1; row < n; row += 1) {
            const factor = m[row][col] / m[col][col];
            for (let k = col; k <= n; k += 1) {
                m[row][k] -= factor * m[col][k];
            }
        }
    }
    const x = new Array(n).fill(0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = m[row][n];
        for (let k = row + 1; k < n; k += 1) {
            sum -= m[row][k] * x[k];
        }
        x[row] = sum / m[row][row];
    }
    return x;
}
