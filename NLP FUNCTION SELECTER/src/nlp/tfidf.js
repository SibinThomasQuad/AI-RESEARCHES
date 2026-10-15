const { tokenize, removeStopWords, stemTokens, getNGrams } = require("./tokenizer");

/**
 * TF-IDF and Cosine Similarity Classifier for offline Intent Recognition.
 */
class TfIdfClassifier {
  constructor() {
    this.documents = []; // { id, name, rawText, tokens, ngrams, vector }
    this.vocab = new Set();
    this.idf = {};
  }

  /**
   * Add a function document to the corpus.
   * @param {string} id - Identifier (e.g. function name)
   * @param {string} text - Combined function description, keywords, and examples
   * @param {Array<string>} keywords - Exact keywords with higher relevance weight
   */
  addDocument(id, text, keywords = []) {
    const rawTokens = tokenize(text);
    const contentTokens = removeStopWords(rawTokens);
    const stemmed = stemTokens(contentTokens);
    const bigrams = getNGrams(contentTokens, 2);

    // Give extra weight to keywords by repeating their stemmed tokens
    const keywordTokens = [];
    keywords.forEach(kw => {
      const kwTokens = removeStopWords(tokenize(kw));
      keywordTokens.push(...stemTokens(kwTokens));
      keywordTokens.push(...stemTokens(kwTokens)); // 2x boost
    });

    const allFeatures = [...stemmed, ...keywordTokens, ...bigrams];

    allFeatures.forEach(feat => this.vocab.add(feat));

    this.documents.push({
      id,
      text,
      keywords,
      features: allFeatures
    });
  }

  /**
   * Train/Index all added documents: calculate IDF and document vectors.
   */
  train() {
    const N = this.documents.length;
    this.idf = {};

    // Calculate document frequency (DF) for each feature
    this.vocab.forEach(term => {
      let count = 0;
      for (const doc of this.documents) {
        if (doc.features.includes(term)) {
          count++;
        }
      }
      // Smoothed IDF
      this.idf[term] = Math.log((N + 1) / (count + 1)) + 1;
    });

    // Compute TF-IDF vectors for documents
    for (const doc of this.documents) {
      doc.vector = this._computeVector(doc.features);
    }
  }

  /**
   * Compute TF-IDF normalized vector for a list of features.
   */
  _computeVector(features) {
    const tf = {};
    for (const f of features) {
      tf[f] = (tf[f] || 0) + 1;
    }

    const vector = {};
    let sumSq = 0;

    for (const term in tf) {
      if (this.idf[term]) {
        // TF-IDF = (1 + log(tf)) * idf
        const weight = (1 + Math.log(tf[term])) * this.idf[term];
        vector[term] = weight;
        sumSq += weight * weight;
      }
    }

    // L2 Normalize
    const magnitude = Math.sqrt(sumSq);
    if (magnitude > 0) {
      for (const term in vector) {
        vector[term] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Compute Cosine Similarity between two sparse vectors.
   */
  _cosineSimilarity(vecA, vecB) {
    let dot = 0;
    for (const term in vecA) {
      if (vecB[term]) {
        dot += vecA[term] * vecB[term];
      }
    }
    return dot;
  }

  /**
   * Classify a user prompt and score all documents.
   * @param {string} prompt
   * @returns {Array<{ id: string, score: number }>} Sorted by score descending
   */
  classify(prompt) {
    const rawTokens = tokenize(prompt);
    const contentTokens = removeStopWords(rawTokens);
    const stemmed = stemTokens(contentTokens);
    const bigrams = getNGrams(contentTokens, 2);
    const queryFeatures = [...stemmed, ...bigrams];

    const queryVector = this._computeVector(queryFeatures);

    const scores = this.documents.map(doc => {
      let score = this._cosineSimilarity(queryVector, doc.vector);

      // Keyword boost: If an exact keyword is present in prompt, boost score
      const promptLower = prompt.toLowerCase();
      let keywordBoost = 0;
      for (const kw of doc.keywords) {
        const kwLower = kw.toLowerCase();
        if (promptLower.includes(kwLower)) {
          keywordBoost += 0.35; // Significant boost for direct keyword/phrase match
        }
      }

      // Check function ID match (e.g., "payslip" word directly in prompt)
      if (promptLower.includes(doc.id.toLowerCase())) {
        keywordBoost += 0.4;
      }

      const totalScore = Math.min(1.0, score + keywordBoost);

      return {
        id: doc.id,
        score: Math.round(totalScore * 1000) / 1000,
        tfidfScore: Math.round(score * 1000) / 1000
      };
    });

    return scores.sort((a, b) => b.score - a.score);
  }
}

module.exports = { TfIdfClassifier };
