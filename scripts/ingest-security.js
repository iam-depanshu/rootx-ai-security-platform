import { ChromaClient } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';

const client = new ChromaClient({ path: 'http://localhost:8000' });

const COLLECTION_NAME = 'rootx-security';

async function ensureCollection() {
  try {
    return await client.getCollection({ name: COLLECTION_NAME });
  } catch {
    return await client.createCollection({ name: COLLECTION_NAME });
  }
}

function chunkText(text, maxLength = 500) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function ingestFile(collection, filePath, source, type) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.trim());
  
  const allDocs = [];
  const allIds = [];
  const allMetadatas = [];
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const item = JSON.parse(lines[i]);
      let text = '';
      
      if (item.instruction && item.output) {
        text = `Q: ${item.instruction}\nA: ${item.output}`;
      } else if (item.question && item.answer) {
        text = `Q: ${item.question}\nA: ${item.answer}`;
      } else if (item.vulnerability && item.fix) {
        text = `Vulnerability: ${item.vulnerability}\nCWE: ${item.cwe || 'N/A'}\nBad: ${item.bad}\nGood: ${item.good}\nExplanation: ${item.explanation}`;
      } else if (typeof item === 'object') {
        text = JSON.stringify(item);
      } else {
        text = String(item);
      }
      
      const chunks = chunkText(text);
      
      for (let j = 0; j < chunks.length; j++) {
        allDocs.push(chunks[j]);
        allIds.push(`${source}-${i}-${j}`);
        allMetadatas.push({ 
          source, 
          type, 
          line: i,
          chunk: j,
          totalChunks: chunks.length
        });
      }
    } catch (e) {
      console.warn(`[INGEST] Skipping invalid JSON at line ${i + 1} in ${source}:`, e.message);
    }
  }
  
  if (allDocs.length > 0) {
    await collection.add({
      ids: allIds,
      documents: allDocs,
      metadatas: allMetadatas,
    });
    console.log(`[INGEST] Added ${allDocs.length} chunks from ${source} (${lines.length} records)`);
  }
}

async function main() {
  console.log('[INGEST] Starting RootX security knowledge ingestion...');
  console.log('[INGEST] Connecting to ChromaDB at http://localhost:8000...');
  
  const collection = await ensureCollection();
  console.log('[INGEST] Collection ready:', COLLECTION_NAME);
  
  const dataDir = path.join(process.cwd(), 'training', 'data');
  
  const files = [
    { file: 'cwe_top25.json', type: 'cwe' },
    { file: 'owasp_top10.json', type: 'owasp' },
    { file: 'secure_patterns_js.json', type: 'pattern', lang: 'javascript' },
    { file: 'secure_patterns_py.json', type: 'pattern', lang: 'python' },
    { file: 'secure_patterns_go.json', type: 'pattern', lang: 'go' },
    { file: 'cve_examples.json', type: 'cve' },
    { file: 'rootx_rules.json', type: 'rules' },
    { file: 'attack_signatures.json', type: 'signatures' },
  ];
  
  for (const { file, type, lang } of files) {
    const filePath = path.join(dataDir, file);
    try {
      await fs.access(filePath);
      await ingestFile(collection, filePath, file, type);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log(`[INGEST] Skipping missing file: ${file}`);
      } else {
        console.error(`[INGEST] Error processing ${file}:`, e.message);
      }
    }
  }
  
  const count = await collection.count();
  console.log(`\n[INGEST] Complete! Total documents in collection: ${count}`);
}

main().catch(console.error);