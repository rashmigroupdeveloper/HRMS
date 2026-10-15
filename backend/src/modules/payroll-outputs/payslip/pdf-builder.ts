/**
 * Lightweight, zero-dependency PDF 1.4 document builder.
 * Generates standards-compliant PDF documents for tabular forms and payslips (docs/04 §6.6).
 */

export interface PdfTextLine {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  bold?: boolean;
  color?: [number, number, number]; // [r, g, b] in range 0-1
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: [number, number, number];
  stroke?: [number, number, number];
  lineWidth?: number;
}

export interface PdfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: [number, number, number];
  lineWidth?: number;
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // Map non-ASCII characters to space for standard Type1 font
}

export class SimplePdfDocument {
  // A4 dimensions in points (72 points/inch)
  readonly width: number = 595.28;
  readonly height: number = 841.89;

  private readonly streamCommands: string[] = [];

  drawRect(rect: PdfRect): this {
    const commands: string[] = ['q'];
    if (rect.lineWidth !== undefined) {
      commands.push(`${rect.lineWidth.toFixed(2)} w`);
    }
    if (rect.fill) {
      commands.push(
        `${rect.fill[0].toFixed(3)} ${rect.fill[1].toFixed(3)} ${rect.fill[2].toFixed(3)} rg`
      );
    }
    if (rect.stroke) {
      commands.push(
        `${rect.stroke[0].toFixed(3)} ${rect.stroke[1].toFixed(3)} ${rect.stroke[2].toFixed(3)} RG`
      );
    }

    commands.push(
      `${rect.x.toFixed(2)} ${rect.y.toFixed(2)} ${rect.width.toFixed(2)} ${rect.height.toFixed(2)} re`
    );

    if (rect.fill && rect.stroke) {
      commands.push('B');
    } else if (rect.fill) {
      commands.push('f');
    } else if (rect.stroke) {
      commands.push('S');
    }
    commands.push('Q');
    this.streamCommands.push(commands.join('\n'));
    return this;
  }

  drawLine(line: PdfLine): this {
    const commands: string[] = ['q'];
    const lw = line.lineWidth ?? 0.5;
    commands.push(`${lw.toFixed(2)} w`);
    if (line.stroke) {
      commands.push(
        `${line.stroke[0].toFixed(3)} ${line.stroke[1].toFixed(3)} ${line.stroke[2].toFixed(3)} RG`
      );
    } else {
      commands.push('0.5 0.5 0.5 RG');
    }
    commands.push(`${line.x1.toFixed(2)} ${line.y1.toFixed(2)} m`);
    commands.push(`${line.x2.toFixed(2)} ${line.y2.toFixed(2)} l`);
    commands.push('S');
    commands.push('Q');
    this.streamCommands.push(commands.join('\n'));
    return this;
  }

  drawText(textLine: PdfTextLine): this {
    const font = textLine.bold ? '/F2' : '/F1';
    const size = textLine.fontSize ?? 9;
    const escaped = escapePdfText(textLine.text);

    const commands: string[] = ['BT', `${font} ${size.toFixed(1)} Tf`];

    if (textLine.color) {
      commands.push(
        `${textLine.color[0].toFixed(3)} ${textLine.color[1].toFixed(3)} ${textLine.color[2].toFixed(3)} rg`
      );
    } else {
      commands.push('0.1 0.1 0.1 rg');
    }

    commands.push(`${textLine.x.toFixed(2)} ${textLine.y.toFixed(2)} Td`);
    commands.push(`(${escaped}) Tj`);
    commands.push('ET');

    this.streamCommands.push(commands.join('\n'));
    return this;
  }

  build(): Buffer {
    const streamContent = this.streamCommands.join('\n');
    const streamLength = Buffer.byteLength(streamContent, 'utf-8');

    const objects: string[] = [];

    // Object 1: Catalog
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

    // Object 2: Pages
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');

    // Object 3: Page
    objects.push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`
    );

    // Object 4: Regular Font (Helvetica)
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

    // Object 5: Bold Font (Helvetica-Bold)
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');

    // Object 6: Content stream
    objects.push(`6 0 obj\n<< /Length ${String(streamLength)} >>\nstream\n${streamContent}\nendstream\nendobj`);

    let output = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const obj of objects) {
      offsets.push(Buffer.byteLength(output, 'utf-8'));
      output += `${obj}\n`;
    }

    const startXref = Buffer.byteLength(output, 'utf-8');
    output += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;

    for (let i = 1; i <= objects.length; i++) {
      const off = offsets[i] ?? 0;
      output += `${off.toString().padStart(10, '0')} 00000 n \n`;
    }

    output += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(startXref)}\n%%EOF\n`;

    return Buffer.from(output, 'utf-8');
  }
}
