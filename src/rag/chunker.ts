import * as fs from "fs/promises";
import * as path from "path";
import type { Chunk } from "../types.js";

const MAX_CHUNK_SIZE = 2000;

export function chunkMarkdown(content: string, filePath: string): Chunk[] {
  const fileName = path.basename(filePath);
  const chunks: Chunk[] = [];
  const sections = content.split(/(?=^## )/m);

  let globalPosition = 0;
  let lastParagraph = "";

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const firstLine = lines[0] ?? "";
    const isHeading = firstLine.startsWith("## ");
    const heading = isHeading ? firstLine.trim() : "(Introduction)";

    if (section.length <= MAX_CHUNK_SIZE) {
      const chunkContent = lastParagraph
        ? `${lastParagraph}\n\n${section.trim()}`
        : section.trim();

      chunks.push({
        id: `${fileName}-${globalPosition}`,
        content: chunkContent,
        metadata: {
          source: fileName,
          heading,
          position: globalPosition,
          charCount: chunkContent.length,
        },
      });

      const paragraphs = section.trim().split(/\n\n+/);
      lastParagraph = paragraphs[paragraphs.length - 1] ?? "";
      globalPosition++;
      continue;
    }

    const paragraphs = section
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);
    let currentChunk = lastParagraph ? `${lastParagraph}\n\n` : "";

    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index] ?? "";

      if (
        currentChunk.length > 0 &&
        currentChunk.length + paragraph.length > MAX_CHUNK_SIZE
      ) {
        const chunkContent = isHeading
          ? `${heading}\n\n${currentChunk.trim()}`
          : currentChunk.trim();

        chunks.push({
          id: `${fileName}-${globalPosition}`,
          content: chunkContent,
          metadata: {
            source: fileName,
            heading,
            position: globalPosition,
            charCount: chunkContent.length,
          },
        });

        const chunkParagraphs = section.trim().split(/\n\n+/);
        lastParagraph = chunkParagraphs[chunkParagraphs.length - 1] ?? "";
        currentChunk = `${lastParagraph}\n\n`;
        globalPosition++;
      }
      currentChunk += paragraph + "\n\n";
    }

    if (currentChunk.trim().length > 0) {
      const chunkContent = isHeading
        ? `${heading}\n\n${currentChunk.trim()}`
        : currentChunk.trim();

      chunks.push({
        id: `${fileName}-${globalPosition}`,
        content: chunkContent,
        metadata: {
          source: fileName,
          heading,
          position: globalPosition,
          charCount: chunkContent.length,
        },
      });

      const finalParagraphs = section.trim().split(/\n\n+/);
      lastParagraph = finalParagraphs[finalParagraphs.length - 1] ?? "";
      globalPosition++;
    }
  }

  return chunks;
}

export async function processDirectory(dirPath: string): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    throw new Error(`Can not read directory: ${dirPath}`);
  }

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const file of markdownFiles) {
    const fullPath = path.join(dirPath, file.name);
    let content: string;

    try {
      content = await fs.readFile(fullPath, "utf-8");
    } catch {
      console.warn(`Can not read: ${file.name}`);
      continue;
    }

    const chunks = chunkMarkdown(content, file.name);
    allChunks.push(...chunks);
    console.log(`Processing ${file.name}... ${chunks.length} chunks generated`);
  }

  return allChunks;
}
