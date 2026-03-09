import { Injectable } from '@angular/core';

export interface ParsedRules {
  include: string[];
  exclude: string[];
}

@Injectable({ providedIn: 'root' })
export class YamlRulesService {
  /** Converts backend YAML string into UI-friendly arrays */
  parse(yaml: string): ParsedRules {
    const result: ParsedRules = { include: [], exclude: [] };
    if (!yaml) return result;

    let currentContext: 'include' | 'exclude' | null = null;
    const lines = yaml.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'include:') {
        currentContext = 'include';
      } else if (trimmed === 'exclude:') {
        currentContext = 'exclude';
      } else if (trimmed.startsWith('-') && currentContext) {
        // Strip the dash, trim whitespace, and remove surrounding quotes
        const value = trimmed
          .substring(1)
          .trim()
          .replace(/^["']|["']$/g, '');
        if (value) {
          result[currentContext].push(value);
        }
      }
    }
    return result;
  }

  /** Converts UI arrays back into strictly formatted YAML for the backend */
  stringify(rules: ParsedRules): string {
    let yaml = '';

    if (rules.include && rules.include.length > 0) {
      yaml += 'include:\n';
      rules.include.forEach((pattern) => {
        yaml += `  - "${pattern}"\n`;
      });
    }

    if (rules.exclude && rules.exclude.length > 0) {
      yaml += 'exclude:\n';
      rules.exclude.forEach((pattern) => {
        yaml += `  - "${pattern}"\n`;
      });
    }

    return yaml.trim();
  }
}
