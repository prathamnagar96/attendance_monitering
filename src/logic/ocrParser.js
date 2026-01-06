const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const SHORT_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function cleanText(text) {
    return text.replace(/[^a-zA-Z0-9\s\/\-\:\(\)]/g, "").trim();
}

export function parsePaddleOutput(ocrResult) {
    const { text, points } = ocrResult;
    if (!text || !points || text.length === 0) return [];

    // 1. Normalize Items with Center Points
    const items = text.map((str, i) => {
        const box = points[i];
        if (!box) return null;

        // Handle Paddle's nested vs flat arrays
        let minX, maxX, minY, maxY;
        if (Array.isArray(box[0])) {
            const xs = box.map(p => p[0]);
            const ys = box.map(p => p[1]);
            minX = Math.min(...xs); maxX = Math.max(...xs);
            minY = Math.min(...ys); maxY = Math.max(...ys);
        } else {
            return null;
        }

        return {
            text: cleanText(str),
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            w: maxX - minX,
            h: maxY - minY,
            raw: str
        };
    }).filter(Boolean);

    if (items.length === 0) return [];

    // 2. Find Table Boundaries (Outliers removed)
    // We sort by X and Y to find the "content box"
    const sortedX = [...items].sort((a, b) => a.x - b.x);
    const sortedY = [...items].sort((a, b) => a.y - b.y);

    // Ignore extreme outliers (top 5% / bottom 5%) to avoid noise
    const minTableX = sortedX[Math.floor(items.length * 0.05)].x;
    const maxTableX = sortedX[Math.floor(items.length * 0.95)].x;
    const minTableY = sortedY[Math.floor(items.length * 0.05)].y;
    const maxTableY = sortedY[Math.floor(items.length * 0.95)].y;

    // 3. Define Grid Slots (Assumes standard 6 Days x 8 Periods)
    // You can adjust these counts if your college has more/less
    const NUM_ROWS = 7; // Header + 6 Days
    const NUM_COLS = 9; // DayLabel + 8 Periods

    const rowHeight = (maxTableY - minTableY) / NUM_ROWS;
    const colWidth = (maxTableX - minTableX) / NUM_COLS;

    // Initialize Grid
    const grid = Array(NUM_ROWS).fill(null).map(() => Array(NUM_COLS).fill(""));

    // 4. Bucketing
    items.forEach(item => {
        // Calculate relative position
        const relX = item.x - minTableX;
        const relY = item.y - minTableY;

        // Determine Row/Col index
        let colIdx = Math.floor(relX / colWidth);
        let rowIdx = Math.floor(relY / rowHeight);

        // Clamp indices to be safe
        colIdx = Math.max(0, Math.min(colIdx, NUM_COLS - 1));
        rowIdx = Math.max(0, Math.min(rowIdx, NUM_ROWS - 1));

        // Append text to that slot
        grid[rowIdx][colIdx] += (grid[rowIdx][colIdx] ? " " : "") + item.text;
    });

    // 5. Cleanup
    // Ensure the first column contains Days (MON, TUE...) or we shift rows
    // This is a heuristic to fix alignment if the header row is missing

    // Return the raw grid. The Editor will display it.
    // The user can fix "Free" or typos manually.
    console.log("Spatial Grid:", grid);
    return grid;
}
