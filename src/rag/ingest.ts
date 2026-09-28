import * as fs from "fs/promises";
import * as path from "path";
import { config } from "../config.js";
import { processDirectory } from "./chunker.js";
import { generateEmbeddings } from "./embeddings.js";
import { VectorStore } from "./vector-store.js";

const PREVIEW_JSON = path.join(
  path.dirname(config.dbPath),
  "chunks-preview.json",
);

export async function runIngest(
  docsPath: string = config.docsPath,
): Promise<void> {
  console.log("Initializing documents ingestion...");
  console.log(`Directory: ${docsPath}\n`);

  const chunks = await processDirectory(docsPath);

  if (chunks.length === 0) {
    console.log("No .md files found in the directory");
  }

  console.log(`Total chunks generated: ${chunks.length}`);
  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  const texts = chunks.map((chunk) => chunk.content);
  const embeddings = await generateEmbeddings(texts);
  const dimensions = embeddings[0]?.length;
  console.log(`Embeddings generated ${dimensions} dimensions each`);

  const preview = chunks.map((chunk, i) => ({
    id: chunk.id,
    content:
      chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
    metadata: chunk.metadata,
    embeddingsPreview: (embeddings[i] ?? []).slice(0, 5),
    embeddingDims: embeddings[i] ?? "",
  }));

  await fs.mkdir(path.dirname(PREVIEW_JSON), { recursive: true });
  await fs.writeFile(PREVIEW_JSON, JSON.stringify(preview, null, 2), "utf-8");
  console.log(`\nSaving SQLite vector store: ${config.dbPath}`);

  const store = new VectorStore(config.dbPath);
  store.clear();

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const embedding = embeddings[index];

    if (chunk && embedding) {
      store.insert(chunk, embedding);
    }
  }

  console.log(`Saved ${store.size} chunks in vector store ${config.dbPath}`);
  console.log(`\nTotal: ${chunks.length} chunks processed`);
  console.log(`\nPreview in ${PREVIEW_JSON}`);
  console.log(`\nIngestion complete, ready for semantic search.`);
}

runIngest().catch((error: Error) => {
  console.error(`Ingest error ${error.message}`);
});
