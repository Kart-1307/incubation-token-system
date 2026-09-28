// Deterministic realistic QR Code SVG generator
export default function QRCodeSVG({
  value,
  size = 120,
  className = '',
  color = '#1e1b4b',
}: {
  value: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  // Simple deterministic hash to populate the data grid
  const hash = Array.from(value).reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 13), 0);

  const gridSize = 21; // 21x21 Version 1 QR matrix
  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Helper to draw a 7x7 finder pattern with 1px border, 1px white ring, 3x3 solid center
  const setFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 || // Outer ring
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)       // Center block
        ) {
          matrix[startY + r][startX + c] = true;
        } else {
          matrix[startY + r][startX + c] = false;
        }
      }
    }
  };

  // 3 Finder patterns (top-left, top-right, bottom-left)
  setFinder(0, 0);
  setFinder(14, 0);
  setFinder(0, 14);

  // Timing lines
  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data area based on hash and string character codes
  let bitIndex = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Skip finder pattern zones (including separators)
      const inTopLeft = r <= 7 && c <= 7;
      const inTopRight = r <= 7 && c >= 13;
      const inBottomLeft = r >= 13 && c <= 7;
      const inTiming = (r === 6 && c >= 8 && c <= 12) || (c === 6 && r >= 8 && r <= 12);

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming) {
        const charCode = value.charCodeAt(bitIndex % value.length);
        const pseudoRandom = Math.sin(hash * 0.1 + bitIndex * 17.3 + charCode) * 10000;
        matrix[r][c] = (pseudoRandom - Math.floor(pseudoRandom)) > 0.48;
        bitIndex++;
      }
    }
  }

  const cellSize = 100 / gridSize;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      shapeRendering="crispEdges"
      aria-label={`QR Code for ${value}`}
    >
      <rect width="100" height="100" fill="#ffffff" rx="4" />
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.05}
              height={cellSize + 0.05}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}
