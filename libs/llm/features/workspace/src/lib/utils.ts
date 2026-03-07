export function healMalformedPatch(patch: string): string {
  const lines = patch.split('\n');
  const result: string[] = [];

  let headerIndex = -1;
  let removeCount = 0;
  let addCount = 0;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Standard headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      inHunk = false;
      result.push(line);
      continue;
    }

    // Start of a hunk
    if (line.startsWith('@@ ')) {
      // If we were already tracking a hunk, rewrite its header before starting the new one
      if (inHunk && headerIndex !== -1) {
        result[headerIndex] = rewriteHeader(
          result[headerIndex],
          removeCount,
          addCount,
        );
      }
      inHunk = true;
      headerIndex = result.length;
      removeCount = 0;
      addCount = 0;
      result.push(line);
      continue;
    }

    if (inHunk) {
      if (line.startsWith('-')) {
        removeCount++;
        result.push(line);
      } else if (line.startsWith('+')) {
        addCount++;
        result.push(line);
      } else if (line.startsWith(' ')) {
        removeCount++;
        addCount++;
        result.push(line);
      } else if (line === '') {
        // Common LLM hallucination: dropping the leading space on empty context lines
        removeCount++;
        addCount++;
        result.push(' ');
      } else if (line.startsWith('\\')) {
        // \ No newline at end of file
        result.push(line);
      } else {
        // We hit something outside the hunk boundaries
        inHunk = false;
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  // Flush the final hunk
  if (inHunk && headerIndex !== -1) {
    result[headerIndex] = rewriteHeader(
      result[headerIndex],
      removeCount,
      addCount,
    );
  }

  return result.join('\n');
}

function rewriteHeader(
  header: string,
  actualRemove: number,
  actualAdd: number,
): string {
  return header.replace(
    /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/,
    (match, startRem, startAdd) => {
      return `@@ -${startRem},${actualRemove} +${startAdd},${actualAdd} @@`;
    },
  );
}
