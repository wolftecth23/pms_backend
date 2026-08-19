import { Injectable } from '@nestjs/common';

@Injectable()
export class CodeGeneratorService {
  generateProjectCode(name: string): string {
    const words = name.trim().split(/\s+/);

    const prefix =
      words.length === 1
        ? words[0].substring(0, 3).toUpperCase()
        : words
            .map((w) => w[0])
            .join('')
            .substring(0, 5)
            .toUpperCase();

    const number = Math.floor(1000 + Math.random() * 9000);

    return `${prefix}-${number}`;
  }
}
