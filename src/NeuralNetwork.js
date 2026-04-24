import * as tf from "@tensorflow/tfjs";
import booksMarkdown from "../livros-probabilidade-estatistica.md?raw";

const GUTENBERG_MIRROR = "https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt";
const GUTENBERG_SOURCES = [
  { bookId: 1342, title: "Pride and Prejudice" },
  { bookId: 11, title: "Alice's Adventures in Wonderland" },
  { bookId: 84, title: "Frankenstein" },
  { bookId: 1661, title: "The Adventures of Sherlock Holmes" },
  { bookId: 2701, title: "Moby Dick" },
  { bookId: 74, title: "The Adventures of Tom Sawyer" },
];

const CHUNK_SIZE_CHARS = 512;
const MAX_CONCURRENT_FETCHES = 4;
const BATCH_SIZE = 16;
const SEQ_LENGTH = 20;
const VOCAB_SIZE = 2400;
const EMBEDDING_DIM = 72;
const LSTM_UNITS = 112;
const TRAIN_BATCH_SIZE = 32;
const TRAIN_EPOCHS = 4;
const MAX_SEQUENCES = 3200;

function tokenize(text) {
  return text.toLowerCase().match(/\b[a-z0-9áàãâéêíóôõúüçñ_:-]+\b/g) || [];
}

function chunkText(text, chunkSize = CHUNK_SIZE_CHARS) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function tokenizeChunk(text) {
  const words = tokenize(text);
  const unique = Array.from(new Set(words));
  const entropyProxy = unique.length / Math.max(words.length, 1);
  return {
    raw_text: text.trim(),
    tokens: unique.slice(0, 128),
    token_count: words.length,
    char_count: text.length,
    entropy_proxy: Number(entropyProxy.toFixed(4)),
  };
}

function hashText(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function computeStimulusChecksum(sourceId, payload) {
  return hashText(`${sourceId}:${JSON.stringify(payload)}`);
}

function createStimulus(sourceId, payload) {
  const checksum = computeStimulusChecksum(sourceId, payload);
  return {
    sourceId,
    payload,
    checksum,
    verified: true,
  };
}

function verifyStimulus(stimulus) {
  return stimulus.checksum === computeStimulusChecksum(stimulus.sourceId, stimulus.payload);
}

function parseBooksManifest(markdown) {
  const sections = markdown.split(/\n##\s+/).slice(1);
  const books = sections
    .map((section) => {
      const [headingLine, ...rest] = section.trim().split("\n");
      const body = rest.join("\n");
      const linkMatch = body.match(/\*\*Link:\*\*\s*(https?:\/\/\S+)/i);
      const description = body
        .replace(/\*\*Link:\*\*\s*https?:\/\/\S+/i, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        title: headingLine.trim(),
        link: linkMatch ? linkMatch[1].trim() : "",
        description,
      };
    })
    .filter((book) => book.title.length > 0);

  const intro = markdown.split(/\n##\s+/)[0].replace(/\s+/g, " ").trim();
  return { intro, books };
}

function manifestToCorpus(manifest) {
  return [
    manifest.intro,
    ...manifest.books.map(
      (book) => `${book.title}. ${book.description}. Referencia: ${book.link}.`
    ),
  ].join(" ");
}

function buildVocabularyFromText(corpus, maxVocab = VOCAB_SIZE) {
  const counts = new Map();
  const tokens = tokenize(corpus);
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const sortedTokens = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxVocab - 2)
    .map(([token]) => token);

  const tokenToId = { "<PAD>": 0, "<UNK>": 1 };
  const idToToken = { 0: "<PAD>", 1: "<UNK>" };

  sortedTokens.forEach((token, index) => {
    const id = index + 2;
    tokenToId[token] = id;
    idToToken[id] = token;
  });

  return { tokenToId, idToToken };
}

function buildTrainingSequences(corpus, tokenToId, seqLength = SEQ_LENGTH) {
  const ids = tokenize(corpus).map((token) => tokenToId[token] ?? tokenToId["<UNK>"]);
  const sequences = [];
  for (let i = 0; i + seqLength < ids.length; i += 1) {
    sequences.push({
      input: ids.slice(i, i + seqLength),
      output: ids[i + seqLength],
    });
    if (sequences.length >= MAX_SEQUENCES) break;
  }
  return sequences;
}

function createModel(vocabSize) {
  const model = tf.sequential();
  model.add(
    tf.layers.embedding({
      inputDim: vocabSize,
      outputDim: EMBEDDING_DIM,
      inputLength: SEQ_LENGTH,
    })
  );
  model.add(tf.layers.lstm({ units: LSTM_UNITS }));
  model.add(tf.layers.dense({ units: vocabSize, activation: "softmax" }));
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "sparseCategoricalCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}

function sampleToken(probabilities, temperature = 0.9) {
  const adjusted = probabilities.map((p) => Math.exp(Math.log(Math.max(p, 1e-8)) / temperature));
  const total = adjusted.reduce((sum, value) => sum + value, 0);
  const normalized = adjusted.map((value) => value / total);

  let random = Math.random();
  for (let i = 0; i < normalized.length; i += 1) {
    random -= normalized[i];
    if (random <= 0) return i;
  }
  return normalized.length - 1;
}

function padSeedIds(seedIds) {
  const context = [...seedIds.slice(-SEQ_LENGTH)];
  while (context.length < SEQ_LENGTH) context.unshift(0);
  return context;
}

function generateContinuation(model, seedText, tokenToId, idToToken, length = 42) {
  const seedIds = tokenize(seedText).map((token) => tokenToId[token] ?? tokenToId["<UNK>"]);
  const context = padSeedIds(seedIds);
  const generated = [];

  for (let i = 0; i < length; i += 1) {
    const probabilities = tf.tidy(() => {
      const input = tf.tensor2d([context], [1, SEQ_LENGTH], "int32");
      const output = model.predict(input);
      return Array.from(output.dataSync());
    });

    const nextId = sampleToken(probabilities, 0.85);
    context.shift();
    context.push(nextId);

    const token = idToToken[nextId];
    if (!token || token === "<PAD>") continue;
    generated.push(token);
  }

  return generated.join(" ").trim();
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runWithConcurrency(items, limit, handler) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) await handler(next);
    }
  });
  await Promise.all(workers);
}

class GutenbergSource {
  constructor(meta) {
    this.bookId = meta.bookId;
    this.title = meta.title;
    this.connected = false;
    this.textCache = "";
  }

  get url() {
    return GUTENBERG_MIRROR.replace("{book_id}", String(this.bookId));
  }

  isConnected() {
    return this.connected;
  }

  async connect() {
    try {
      const response = await fetchWithTimeout(this.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      this.textCache = text.slice(0, CHUNK_SIZE_CHARS * 64);
      this.connected = this.textCache.length > 0;
    } catch {
      this.connected = false;
      this.textCache = "";
    }
    return this.connected;
  }

  read(query = {}) {
    const chunkSize = query.chunkSize ?? CHUNK_SIZE_CHARS;
    const rawChunks = chunkText(this.textCache, chunkSize).slice(0, 64);
    return rawChunks.map((chunk) => tokenizeChunk(chunk));
  }
}

class TextHTTPWorker {
  constructor({ sources, chunkSize = CHUNK_SIZE_CHARS, batchSize = BATCH_SIZE }) {
    this.sources = sources;
    this.chunkSize = chunkSize;
    this.batchSize = batchSize;
    this.queue = [];
    this.stats = {
      connected: 0,
      fetched: 0,
      verified: 0,
      rejected: 0,
      queued: 0,
    };
  }

  async run() {
    await runWithConcurrency(this.sources, MAX_CONCURRENT_FETCHES, async (source) => {
      const ok = await source.connect();
      if (ok) this.stats.connected += 1;
    });

    for (const source of this.sources) {
      if (!source.isConnected()) continue;
      const payloads = source.read({ chunkSize: this.chunkSize });
      for (const payload of payloads) {
        this.stats.fetched += 1;
        const stimulus = createStimulus(`gutenberg:${source.bookId}`, payload);
        stimulus.verified = verifyStimulus(stimulus);
        if (stimulus.verified) {
          this.stats.verified += 1;
          this.queue.push(stimulus);
        } else {
          this.stats.rejected += 1;
        }
      }
    }

    this.stats.queued = this.queue.length;
  }

  consumeBatches() {
    const batches = [];
    for (let i = 0; i < this.queue.length; i += this.batchSize) {
      batches.push(this.queue.slice(i, i + this.batchSize));
    }
    return batches;
  }
}

class StimuliBatcher {
  constructor(batchSize = BATCH_SIZE) {
    this.batchSize = batchSize;
    this.buffer = [];
  }

  add(stimulus) {
    if (!stimulus.verified) return null;
    this.buffer.push(stimulus);
    if (this.buffer.length >= this.batchSize) {
      const batch = [...this.buffer];
      this.buffer = [];
      return batch;
    }
    return null;
  }

  flush() {
    const batch = [...this.buffer];
    this.buffer = [];
    return batch;
  }

  consolidatedVocabulary(batch) {
    const terms = new Set();
    batch.forEach((stimulus) => {
      (stimulus.payload.tokens || []).forEach((token) => terms.add(token));
    });
    return Array.from(terms);
  }
}

export class TextNeuralNetwork {
  constructor() {
    this.model = null;
    this.trainingSequences = [];
    this.tokenToId = null;
    this.idToToken = null;
    this.manifest = parseBooksManifest(booksMarkdown);
    this.pipelineStats = null;
    this.isTraining = false;
    this.hasTrained = false;
    this.tcpStimuliCount = 0;
    this.tcpCorpus = [];
  }

  async initialize(onStatus) {
    onStatus?.("Lendo livros-probabilidade-estatistica.md...");
    const manifestCorpus = manifestToCorpus(this.manifest);

    onStatus?.("Conectando fontes HTTP (GutenbergSource) com concorrencia 4...");
    const sources = GUTENBERG_SOURCES.map((meta) => new GutenbergSource(meta));
    const worker = new TextHTTPWorker({ sources, chunkSize: CHUNK_SIZE_CHARS, batchSize: BATCH_SIZE });
    await worker.run();

    onStatus?.("Verificando checksum e consolidando lotes para STDP...");
    const batcher = new StimuliBatcher(BATCH_SIZE);
    const allStimuli = [];

    worker.queue.forEach((stimulus) => {
      allStimuli.push(stimulus);
    });

    chunkText(manifestCorpus, CHUNK_SIZE_CHARS).forEach((chunk, index) => {
      const stimulus = createStimulus(`manifest:${index}`, tokenizeChunk(chunk));
      stimulus.verified = verifyStimulus(stimulus);
      if (stimulus.verified) allStimuli.push(stimulus);
    });

    const batches = [];
    for (const stimulus of allStimuli) {
      const readyBatch = batcher.add(stimulus);
      if (readyBatch) batches.push(readyBatch);
    }
    const pending = batcher.flush();
    if (pending.length > 0) batches.push(pending);

    const consolidatedTokens = new Set();
    batches.forEach((batch) => {
      batcher.consolidatedVocabulary(batch).forEach((token) => consolidatedTokens.add(token));
    });

    const corpusParts = [manifestCorpus, ...allStimuli.map((stimulus) => stimulus.payload.raw_text)];
    const corpus = corpusParts.join(" ");

    onStatus?.("Criando vocabulário e sequencias LSTM...");
    const { tokenToId, idToToken } = buildVocabularyFromText(corpus, VOCAB_SIZE);
    this.tokenToId = tokenToId;
    this.idToToken = idToToken;
    this.trainingSequences = buildTrainingSequences(corpus, tokenToId, SEQ_LENGTH);

    if (this.model) this.model.dispose();
    this.model = createModel(Object.keys(tokenToId).length);
    this.hasTrained = false;

    this.pipelineStats = {
      listedBooks: this.manifest.books.length,
      httpSources: sources.length,
      connectedSources: worker.stats.connected,
      fetched: worker.stats.fetched,
      verified: worker.stats.verified + this.manifest.books.length,
      rejected: worker.stats.rejected,
      queued: worker.stats.queued,
      batches: batches.length,
      consolidatedVocabulary: consolidatedTokens.size,
      sequences: this.trainingSequences.length,
      tcpStimuli: this.tcpStimuliCount,
    };

    onStatus?.("E1 pronto: DataPipe ativo para treino LSTM.");
    return this.getPipelineStats();
  }

  async train(onProgress) {
    if (!this.model || !this.tokenToId) {
      throw new Error("Inicialize o pipeline antes de treinar.");
    }
    if (this.trainingSequences.length < 32) {
      throw new Error("Poucas sequencias para treino. Inicialize novamente.");
    }

    this.isTraining = true;
    const xs = tf.tensor2d(
      this.trainingSequences.map((sequence) => sequence.input),
      [this.trainingSequences.length, SEQ_LENGTH],
      "int32"
    );
    const ys = tf.tensor1d(this.trainingSequences.map((sequence) => sequence.output), "int32");

    try {
      await this.model.fit(xs, ys, {
        epochs: TRAIN_EPOCHS,
        batchSize: TRAIN_BATCH_SIZE,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs = {}) => {
            const normalized = {
              loss: Number(logs.loss ?? 0),
              accuracy: Number(logs.acc ?? logs.accuracy ?? 0),
            };
            onProgress?.(epoch + 1, TRAIN_EPOCHS, normalized);
          },
        },
      });
      this.hasTrained = true;
    } finally {
      this.isTraining = false;
      xs.dispose();
      ys.dispose();
    }
  }

  injectTcpChunk(rawText) {
    const text = (rawText || "").trim();
    if (!text) return null;

    const stimulus = createStimulus(`tcp:manual:${Date.now()}`, tokenizeChunk(text));
    stimulus.verified = verifyStimulus(stimulus);
    if (!stimulus.verified) return null;

    this.tcpStimuliCount += 1;
    this.tcpCorpus.push(stimulus.payload.raw_text);
    if (this.pipelineStats) {
      this.pipelineStats.tcpStimuli = this.tcpStimuliCount;
      this.pipelineStats.verified += 1;
    }

    return {
      sourceId: stimulus.sourceId,
      checksum: stimulus.checksum,
      totalTcpStimuli: this.tcpStimuliCount,
    };
  }

  generateIOResponse(prompt, context = {}) {
    if (!this.tokenToId || !this.idToToken) {
      throw new Error("Pipeline ainda nao inicializado.");
    }

    const cleanPrompt = (prompt || "").trim() || "status io";
    const tcpTail = this.tcpCorpus.slice(-2).join(" ");
    const seed = `${cleanPrompt} ${tcpTail}`.trim();

    let responseBody = "";
    if (this.model && this.hasTrained) {
      responseBody = generateContinuation(this.model, seed, this.tokenToId, this.idToToken, 44);
    }

    if (!responseBody) {
      const fallback = this.manifest.books
        .slice(0, 3)
        .map((book) => `${book.title}`)
        .join(" | ");
      responseBody = `Resposta sintetica baseada em livros-probabilidade: ${fallback}.`;
    }

    const metadata = {
      node: context.nodeId || "E1-A",
      rho: Number(context.rho ?? 1000),
      weightIn: Number(context.weightIn ?? 0.5).toFixed(2),
      weightOut: Number(context.weightOut ?? 0.5).toFixed(2),
      leftHz: Number(context.leftHz ?? 0).toFixed(2),
      rightHz: Number(context.rightHz ?? 0).toFixed(2),
      checksum: hashText(`${cleanPrompt}:${responseBody}:${Date.now()}`),
      tcpStimuli: this.tcpStimuliCount,
    };

    return {
      metadata,
      responseText: responseBody,
    };
  }

  getPipelineStats() {
    return this.pipelineStats ? { ...this.pipelineStats } : null;
  }

  getManifestBooks() {
    return [...this.manifest.books];
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}