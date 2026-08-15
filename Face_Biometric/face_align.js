/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face Alignment: 5-point landmarks → similarity transform → 112×112 ──

/**
 * Pure-math 5-point face alignment (ArcFace convention).
 * Maps the detected 5 landmarks (eyes, nose, mouth corners) onto the canonical
 * 112×112 grid used by MobileFaceNet / ArcFace recognition models via a
 * similarity transform (scale + rotation + translation).
 */
var FaceAlign = {
    /** Default aligned output size in pixels. */
    SIZE: 112,

    /** Canonical ArcFace destination points for a 112×112 aligned face. */
    DST_POINTS: [
        [38.2946, 51.6963], // 0: right eye (person's right → image left)
        [73.5318, 51.5014], // 1: left eye
        [56.0252, 71.7366], // 2: nose tip
        [41.5493, 92.3655], // 3: right mouth corner
        [70.7299, 92.2041], // 4: left mouth corner
    ],

    /** MediaPipe FaceMesh (468 landmarks) indices for the 5 points above. */
    MESH_INDICES: [33, 263, 1, 291, 61],

    /**
     * Extract the 5 alignment points from a FaceMesh landmark array.
     * @param {Array|Float32Array} mesh 468×2 or 468×3 landmark points
     * @returns {Array<Array<number>>|null} [[x, y] × 5] or null when invalid
     */
    meshToLandmarks5: function (mesh) {
        var i, idx, p, out;
        if (!mesh || typeof mesh.length !== 'number' || mesh.length < 468) return null;
        out = [];
        for (i = 0; i < this.MESH_INDICES.length; i++) {
            idx = this.MESH_INDICES[i];
            p = mesh[idx];
            if (p && typeof p === 'object' && typeof p.x === 'number' && typeof p.y === 'number') {
                out.push([p.x, p.y]);
            } else if (typeof mesh[idx * 3] === 'number') {
                out.push([mesh[idx * 3], mesh[idx * 3 + 1]]);
            } else {
                return null;
            }
        }
        return out;
    },

    /**
     * Estimate the similarity transform mapping src5 → dst5.
     * Rotation + scale come from the eye baseline; translation is the
     * least-squares mean residual over all 5 points.
     * @param {Array} src5 5 source points ([x, y] or {x, y})
     * @param {Array} [dst5] 5 destination points (defaults to DST_POINTS)
     * @returns {{scale: number, angle: number, matrix: number[6], tx: number, ty: number}|null}
     */
    estimateSimilarity: function (src5, dst5) {
        var i, d, ex, ey, eyeDistSrc, eyeDistDst, scale, angle, cosA, sinA, tx, ty, sx, sy;
        if (!src5 || src5.length < 5) return null;
        if (!dst5 || dst5.length < 5) dst5 = this.DST_POINTS;
        sx = function (p) { return Array.isArray(p) ? p[0] : p.x; };
        sy = function (p) { return Array.isArray(p) ? p[1] : p.y; };
        ex = sx(src5[1]) - sx(src5[0]);
        ey = sy(src5[1]) - sy(src5[0]);
        eyeDistSrc = Math.sqrt(ex * ex + ey * ey);
        ex = sx(dst5[1]) - sx(dst5[0]);
        ey = sy(dst5[1]) - sy(dst5[0]);
        eyeDistDst = Math.sqrt(ex * ex + ey * ey);
        if (eyeDistSrc === 0) return null;
        scale = eyeDistDst / eyeDistSrc;
        if (!isFinite(scale) || scale < 0.1 || scale > 5) return null;
        angle =
            Math.atan2(sy(src5[1]) - sy(src5[0]), sx(src5[1]) - sx(src5[0])) -
            Math.atan2(sy(dst5[1]) - sy(dst5[0]), sx(dst5[1]) - sx(dst5[0]));
        cosA = Math.cos(angle);
        sinA = Math.sin(angle);
        tx = 0;
        ty = 0;
        for (i = 0; i < 5; i++) {
            d = dst5[i];
            tx += sx(d) - scale * (cosA * sx(src5[i]) - sinA * sy(src5[i]));
            ty += sy(d) - scale * (sinA * sx(src5[i]) + cosA * sy(src5[i]));
        }
        tx /= 5;
        ty /= 5;
        return {
            scale: scale,
            angle: angle,
            matrix: [scale * cosA, scale * sinA, -scale * sinA, scale * cosA, tx, ty],
            tx: tx,
            ty: ty,
        };
    },

    /**
     * Warp a source canvas so the 5 landmarks land on the canonical ArcFace
     * grid, producing an aligned (default 112×112) face canvas.
     * @param {HTMLCanvasElement} source
     * @param {Array} landmarks5 5 points ([x, y] or {x, y})
     * @param {number} [size] Output size in pixels (default 112)
     * @returns {{canvas: HTMLCanvasElement, matrix: number[6], scale: number, angle: number}|null}
     */
    alignFace: function (source, landmarks5, size) {
        var est, canvas, ctx;
        if (!source || !landmarks5 || landmarks5.length < 5) return null;
        est = this.estimateSimilarity(landmarks5, this.DST_POINTS);
        if (!est) return null;
        if (!size) size = this.SIZE;
        try {
            canvas = document.createElement('canvas');
        } catch (e) {
            return null;
        }
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext('2d');
        if (!ctx || typeof ctx.setTransform !== 'function') return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.setTransform(est.matrix[0], est.matrix[1], est.matrix[2], est.matrix[3], est.matrix[4], est.matrix[5]);
        ctx.drawImage(source, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return { canvas: canvas, matrix: est.matrix, scale: est.scale, angle: est.angle };
    },
};

/* c8 ignore start */
if (typeof window !== 'undefined') window.FaceAlign = FaceAlign;
/* c8 ignore stop */