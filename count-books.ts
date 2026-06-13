import "dotenv/config";
import { list } from "@vercel/blob";

async function main() {
  let totalFiles = 0;
  let totalSize = 0;
  let cursor: string | undefined;

  do {
    const result = await list({
      prefix: "books/",
      cursor,
    });

    totalFiles += result.blobs.length;

    for (const blob of result.blobs) {
      totalSize += blob.size;
    }

    cursor = result.cursor;
  } while (cursor);

  console.log("=".repeat(50));
  console.log(`📚 Total books: ${totalFiles}`);
  console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `💾 Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
  );
  console.log("=".repeat(50));
}

main().catch(console.error);
