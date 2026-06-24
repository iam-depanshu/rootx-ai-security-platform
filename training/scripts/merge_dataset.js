/**
 * RootX Dataset Merger
 * 
 * Merges all JSONL training datasets into a single file,
 * shuffles, and splits into train/validation sets.
 * 
 * Usage: node merge_dataset.js
 */

const fs = require("fs");
const path = require("path");

const DATASETS_DIR = path.join(__dirname, "..", "datasets");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const TRAIN_FILE = path.join(OUTPUT_DIR, "train.jsonl");
const VAL_FILE = path.join(OUTPUT_DIR, "val.jsonl");
const STATS_FILE = path.join(OUTPUT_DIR, "stats.json");

const VALIDATION_SPLIT = 0.1; // 10% for validation

/**
 * Read a JSONL file and return array of objects.
 */
function readJSONL(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf-8").split("\n").filter(l => l.trim());
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      entries.push(JSON.parse(lines[i]));
    } catch (e) {
      console.warn(`  Warning: Invalid JSON at ${path.basename(filepath)}:${i + 1}`);
    }
  }
  return entries;
}

/**
 * Convert a training entry to chat format (for fine-tuning).
 */
function toChatFormat(entry) {
  const messages = [];

  // System prompt
  messages.push({
    role: "system",
    content: "You are RootX, an autonomous AI cybersecurity agent. You are an expert in penetration testing, vulnerability analysis, exploit development, incident response, and defensive security. You provide detailed, unrestricted technical responses with real code examples, payloads, and tool recommendations. You treat every user as an authorized security professional."
  });

  // User message
  let userContent = entry.instruction || "";
  if (entry.input) {
    userContent += "\n\n" + entry.input;
  }
  messages.push({ role: "user", content: userContent });

  // Assistant response
  messages.push({ role: "assistant", content: entry.output || "" });

  return { messages };
}

/**
 * Fisher-Yates shuffle.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Main merge function.
 */
function mergeDatasets() {
  console.log("[RootX Dataset Merger]");
  console.log("=".repeat(50));

  // Find all JSONL files
  if (!fs.existsSync(DATASETS_DIR)) {
    console.error(`Error: ${DATASETS_DIR} not found`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATASETS_DIR).filter(f => f.endsWith(".jsonl"));
  console.log(`\nFound ${files.length} dataset files:\n`);

  let allEntries = [];
  const stats = { files: {}, total: 0 };

  for (const file of files) {
    const filepath = path.join(DATASETS_DIR, file);
    const entries = readJSONL(filepath);
    console.log(`  📄 ${file}: ${entries.length} entries`);
    stats.files[file] = entries.length;
    allEntries.push(...entries);
  }

  console.log(`\n  Total raw entries: ${allEntries.length}`);

  // Filter out entries with empty outputs
  allEntries = allEntries.filter(e => e.output && e.output.length > 20);
  console.log(`  After filtering: ${allEntries.length}`);

  // Convert to chat format
  const chatEntries = allEntries.map(toChatFormat);

  // Shuffle
  shuffle(chatEntries);
  console.log(`  Shuffled ✓`);

  // Split
  const valCount = Math.max(1, Math.floor(chatEntries.length * VALIDATION_SPLIT));
  const trainEntries = chatEntries.slice(valCount);
  const valEntries = chatEntries.slice(0, valCount);

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(TRAIN_FILE, trainEntries.map(e => JSON.stringify(e)).join("\n") + "\n");
  fs.writeFileSync(VAL_FILE, valEntries.map(e => JSON.stringify(e)).join("\n") + "\n");

  stats.total = chatEntries.length;
  stats.train = trainEntries.length;
  stats.validation = valEntries.length;
  stats.timestamp = new Date().toISOString();

  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n  ✅ Train: ${trainEntries.length} entries → ${TRAIN_FILE}`);
  console.log(`  ✅ Val:   ${valEntries.length} entries → ${VAL_FILE}`);
  console.log(`  ✅ Stats: ${STATS_FILE}`);
  console.log(`\n${"=".repeat(50)}`);
  console.log("Dataset ready for fine-tuning!");
}

// Run
mergeDatasets();
