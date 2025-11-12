/**
 * Error Detector
 * Detects and classifies errors from terminal output
 * Supports: TypeScript, JavaScript, Python, Shell, and general errors
 */

import { logger } from '../utils/logger.js';

export type ErrorSeverity = 'minor' | 'moderate' | 'critical';
export type ErrorType =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'shell'
  | 'syntax'
  | 'runtime'
  | 'compile'
  | 'general';

export interface DetectedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  context?: string;
  timestamp: string;
}

interface ErrorPattern {
  name: string;
  pattern: RegExp;
  type: ErrorType;
  severity: ErrorSeverity;
  extract: (match: RegExpMatchArray, fullOutput: string) => Partial<DetectedError>;
}

export class ErrorDetector {
  private patterns: ErrorPattern[] = [
    // TypeScript Errors
    {
      name: 'TypeScript Error',
      pattern: /(.+?)\((\d+),(\d+)\):\s*error\s+TS(\d+):\s*(.+)/i,
      type: 'typescript',
      severity: 'moderate',
      extract: (match, output) => ({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: `TS${match[4]}: ${match[5]}`,
        context: this.extractContext(output, match.index || 0, 2)
      })
    },

    // JavaScript/Node Runtime Errors
    {
      name: 'JavaScript Runtime Error',
      pattern: /Error:\s*(.+?)\s+at\s+(.+?):(\d+):(\d+)/i,
      type: 'javascript',
      severity: 'critical',
      extract: (match, output) => ({
        message: match[1],
        file: match[2],
        line: parseInt(match[3]),
        column: parseInt(match[4]),
        stack: this.extractStack(output, match.index || 0),
        context: this.extractContext(output, match.index || 0, 3)
      })
    },

    // Python Tracebacks
    {
      name: 'Python Traceback',
      pattern: /File\s+"(.+?)",\s+line\s+(\d+).*?\n\s+(.+?)\n(\w+Error):\s*(.+)/i,
      type: 'python',
      severity: 'critical',
      extract: (match, output) => ({
        file: match[1],
        line: parseInt(match[2]),
        message: `${match[4]}: ${match[5]}`,
        context: match[3].trim(),
        stack: this.extractPythonStack(output, match.index || 0)
      })
    },

    // Shell Command Failures
    {
      name: 'Shell Command Error',
      pattern: /sh:\s+\d+:\s+(.+?):\s+(command\s+not\s+found|not\s+found|permission\s+denied)/i,
      type: 'shell',
      severity: 'moderate',
      extract: (match) => ({
        message: `Shell error: ${match[1]} - ${match[2]}`,
        context: match[0]
      })
    },

    // npm/yarn errors
    {
      name: 'npm Error',
      pattern: /npm\s+ERR!\s+(.+)/i,
      type: 'runtime',
      severity: 'moderate',
      extract: (match, output) => ({
        message: `npm error: ${match[1]}`,
        context: this.extractContext(output, match.index || 0, 2)
      })
    },

    // Compilation errors (generic)
    {
      name: 'Compilation Error',
      pattern: /error:\s+(.+?)\s+\[(.+?)\]/i,
      type: 'compile',
      severity: 'moderate',
      extract: (match) => ({
        message: match[1],
        context: match[2]
      })
    },

    // Syntax errors (generic)
    {
      name: 'Syntax Error',
      pattern: /SyntaxError:\s*(.+)/i,
      type: 'syntax',
      severity: 'critical',
      extract: (match, output) => ({
        message: `Syntax error: ${match[1]}`,
        stack: this.extractStack(output, match.index || 0)
      })
    },

    // Exception/Error keywords
    {
      name: 'General Error',
      pattern: /(Exception|Error|FATAL|CRITICAL):\s*(.+)/i,
      type: 'general',
      severity: 'moderate',
      extract: (match) => ({
        message: `${match[1]}: ${match[2]}`
      })
    },

    // Exit code errors
    {
      name: 'Exit Code Error',
      pattern: /exit(?:ed)?\s+(?:with\s+)?code\s+(\d+)/i,
      type: 'runtime',
      severity: 'minor',
      extract: (match) => ({
        message: `Process exited with code ${match[1]}`,
        context: `Exit code: ${match[1]}`
      })
    }
  ];

  private recentErrors: DetectedError[] = [];
  private maxRecentErrors = 10;
  private errorCooldown = 1000; // ms - prevent duplicate error spam
  private lastErrorTime = 0;
  private lastErrorHash = '';

  /**
   * Detect errors in terminal output
   */
  detect(output: string): DetectedError | null {
    // Strip ANSI codes for cleaner pattern matching
    const cleanOutput = this.stripAnsiCodes(output);

    // Try each pattern
    for (const pattern of this.patterns) {
      const match = cleanOutput.match(pattern.pattern);
      if (match) {
        const error = this.buildError(pattern, match, cleanOutput);

        // Check if this is a duplicate recent error (cooldown)
        if (this.isDuplicateError(error)) {
          logger.debug(`Suppressing duplicate error: ${error.message.substring(0, 50)}...`);
          return null;
        }

        logger.info(`Detected ${pattern.name}: ${error.message.substring(0, 100)}`);
        this.addRecentError(error);
        return error;
      }
    }

    return null;
  }

  /**
   * Build error object from pattern match
   */
  private buildError(
    pattern: ErrorPattern,
    match: RegExpMatchArray,
    output: string
  ): DetectedError {
    const extracted = pattern.extract(match, output);

    return {
      type: pattern.type,
      severity: pattern.severity,
      message: extracted.message || match[0],
      file: extracted.file,
      line: extracted.line,
      column: extracted.column,
      stack: extracted.stack,
      context: extracted.context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract surrounding context lines
   */
  private extractContext(output: string, startIndex: number, linesBefore = 2): string {
    const lines = output.substring(0, startIndex + 200).split('\n');
    const relevantLines = lines.slice(-linesBefore - 1);
    return relevantLines.join('\n');
  }

  /**
   * Extract JavaScript stack trace
   */
  private extractStack(output: string, startIndex: number): string {
    const fromError = output.substring(startIndex);
    const stackLines = fromError.split('\n').slice(0, 10); // First 10 lines
    return stackLines
      .filter(line => line.trim().startsWith('at ') || line.includes('Error:'))
      .join('\n');
  }

  /**
   * Extract Python stack trace
   */
  private extractPythonStack(output: string, startIndex: number): string {
    const fromError = output.substring(Math.max(0, startIndex - 500), startIndex + 500);
    const lines = fromError.split('\n');
    const stackLines = lines.filter(
      line => line.includes('File "') || line.trim().startsWith('at ') || line.includes('Traceback')
    );
    return stackLines.join('\n');
  }

  /**
   * Strip ANSI color codes
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Check if error is duplicate (within cooldown period)
   */
  private isDuplicateError(error: DetectedError): boolean {
    const now = Date.now();
    const errorHash = this.hashError(error);

    if (
      errorHash === this.lastErrorHash &&
      now - this.lastErrorTime < this.errorCooldown
    ) {
      return true;
    }

    this.lastErrorHash = errorHash;
    this.lastErrorTime = now;
    return false;
  }

  /**
   * Create simple hash of error for duplicate detection
   */
  private hashError(error: DetectedError): string {
    return `${error.type}:${error.message.substring(0, 100)}:${error.file || ''}:${error.line || ''}`;
  }

  /**
   * Add error to recent errors buffer
   */
  private addRecentError(error: DetectedError): void {
    this.recentErrors.unshift(error);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.pop();
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): DetectedError[] {
    return [...this.recentErrors];
  }

  /**
   * Clear recent errors
   */
  clearRecentErrors(): void {
    this.recentErrors = [];
  }

  /**
   * Classify severity based on error type and content
   */
  classifySeverity(error: DetectedError): ErrorSeverity {
    // Critical: runtime crashes, syntax errors
    if (error.type === 'syntax' || error.type === 'runtime') {
      return 'critical';
    }

    // Critical: Python exceptions, JavaScript errors with stack traces
    if ((error.type === 'python' || error.type === 'javascript') && error.stack) {
      return 'critical';
    }

    // Moderate: TypeScript errors, compilation errors
    if (error.type === 'typescript' || error.type === 'compile') {
      return 'moderate';
    }

    // Minor: shell errors, exit codes
    if (error.type === 'shell' || error.message.includes('exit code')) {
      return 'minor';
    }

    return error.severity;
  }
}
