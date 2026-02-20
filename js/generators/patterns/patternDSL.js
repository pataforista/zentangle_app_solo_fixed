/**
 * patternDSL.js
 * Layer 3: Pattern definitions and deterministic seeding.
 */

import { createRNG, hash } from "../../core/prng.js";

/**
 * Interface/Base for all Zentangle patterns.
 */
export class Pattern {
    constructor(id, metadata = {}) {
        this.id = id;
        this.metadata = metadata;
    }

    /**
     * @param {Object} cell - The cell object { id, polygon, centroid }
     * @param {number} globalSeed - The seed of the entire drawing
     * @param {AbstractPen} pen - The pen to draw with
     * @param {Object} params - Dynamic parameters for the pattern
     */
    render(cell, globalSeed, pen, params = {}) {
        // Each pattern gets its own deterministic RNG based on its name + cell ID + global seed
        const cellSeed = hash(globalSeed, cell.id ^ this._strHash(this.id));
        const rng = createRNG(cellSeed);

        this._execute(cell, rng, pen, params);
    }

    /**
     * Internal implementation of the pattern logic.
     */
    _execute(cell, rng, pen, params) {
        throw new Error("Pattern must implement _execute");
    }

    _strHash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h;
    }
}
