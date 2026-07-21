"""
RAG Engine for Software Engineering Knowledge Retrieval
Provides domain-specific context for question generation and answer evaluation
using local embedding models and vector similarity matching.
"""

import os
import json
import numpy as np

# Seed Software Engineering Knowledge Base
SE_KNOWLEDGE_BASE = [
    {
        "id": "se-01",
        "topic": "Software Architecture",
        "subcategory": "SOLID Principles",
        "content": "SOLID principles: Single Responsibility (one reason to change), Open/Closed (open for extension, closed for modification), Liskov Substitution (subtypes must be substitutable for base types), Interface Segregation (client-specific interfaces), Dependency Inversion (depend on abstractions, not concretions)."
    },
    {
        "id": "se-02",
        "topic": "Backend Development",
        "subcategory": "REST API & Authentication",
        "content": "REST API best practices include stateless requests, standard HTTP verbs (GET, POST, PUT, DELETE), proper status codes (200, 201, 400, 401, 403, 404, 500), and secure token authentication like JWT stored in HTTP-only cookies or Bearer headers with short expiration times and refresh tokens."
    },
    {
        "id": "se-03",
        "topic": "Database & Query Optimization",
        "subcategory": "SQL & Transactions",
        "content": "Database optimization involves indexing frequently queried columns, avoiding SELECT *, using query execution plans, and ensuring ACID properties (Atomicity, Consistency, Isolation, Durability) for transaction management. Isolation levels prevent dirty reads, non-repeatable reads, and phantom reads."
    },
    {
        "id": "se-04",
        "topic": "Frontend Development",
        "subcategory": "React & Performance",
        "content": "React performance optimization techniques: memoization (useMemo, useCallback, React.memo), virtualized lists for long data sets, code splitting using React.lazy and Suspense, reducing unnecessary component re-renders, and efficient state management."
    },
    {
        "id": "se-05",
        "topic": "Software Testing & Security",
        "subcategory": "Testing Pyramid & OWASP",
        "content": "Testing pyramid consists of Unit tests (base/fastest), Integration tests, and End-to-End (E2E) tests. Security best practices: sanitizing inputs against SQL Injection & XSS, enforcing CORS, rate limiting, and password hashing using bcrypt or Argon2."
    },
    {
        "id": "se-06",
        "topic": "Object-Oriented & Design Patterns",
        "subcategory": "Design Patterns",
        "content": "Design patterns: Creational (Singleton, Factory, Builder), Structural (Adapter, Decorator, Facade), Behavioral (Observer, Strategy, Command). Design patterns provide reusable solutions to common software design problems."
    },
    {
        "id": "se-07",
        "topic": "System Design & Scalability",
        "subcategory": "Microservices & Caching",
        "content": "System scalability strategies: Horizontal vs Vertical scaling, Load balancing (Round Robin, Least Connections), In-memory Caching (Redis/Memcached), Database Sharding, Event-driven architecture using Kafka/RabbitMQ."
    }
]

class LocalRAGEngine:
    def __init__(self):
        self.documents = SE_KNOWLEDGE_BASE
        self.embedder = None
        self.doc_embeddings = None
        self._init_embeddings()

    def _init_embeddings(self):
        """Try initializing SentenceTransformer model, fall back to TF-IDF if unavailable."""
        try:
            from sentence_transformers import SentenceTransformer
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
            texts = [f"{doc['topic']} {doc['subcategory']}: {doc['content']}" for doc in self.documents]
            self.doc_embeddings = self.embedder.encode(texts, convert_to_numpy=True)
            print("Loaded SentenceTransformer for RAG vector search.")
        except Exception as e:
            print(f"SentenceTransformer not available ({e}), falling back to keyword/TF-IDF vectorizer.")
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer
                self.vectorizer = TfidfVectorizer(stop_words='english')
                texts = [f"{doc['topic']} {doc['subcategory']}: {doc['content']}" for doc in self.documents]
                self.doc_embeddings = self.vectorizer.fit_transform(texts).toarray()
            except Exception as e2:
                print(f"TF-IDF fallback error: {e2}")
                self.vectorizer = None

    def retrieve_context(self, query: str, top_k: int = 2) -> str:
        """Find the top-k most relevant knowledge base entries for a given query."""
        if not self.documents:
            return ""

        if self.embedder is not None and self.doc_embeddings is not None:
            query_vec = self.embedder.encode([query], convert_to_numpy=True)[0]
            # Cosine similarity
            norms = np.linalg.norm(self.doc_embeddings, axis=1) * np.linalg.norm(query_vec)
            norms[norms == 0] = 1e-10
            sims = np.dot(self.doc_embeddings, query_vec) / norms
            top_indices = np.argsort(sims)[::-1][:top_k]
            matched = [self.documents[idx]["content"] for idx in top_indices if sims[idx] > 0.1]
            return "\n\n".join(matched)
        
        elif hasattr(self, 'vectorizer') and self.vectorizer is not None:
            query_vec = self.vectorizer.transform([query]).toarray()[0]
            doc_matrix = self.doc_embeddings
            norms = np.linalg.norm(doc_matrix, axis=1) * np.linalg.norm(query_vec)
            norms[norms == 0] = 1e-10
            sims = np.dot(doc_matrix, query_vec) / norms
            top_indices = np.argsort(sims)[::-1][:top_k]
            matched = [self.documents[idx]["content"] for idx in top_indices if sims[idx] > 0.05]
            return "\n\n".join(matched)

        # Keyword match fallback
        query_words = set(query.lower().split())
        scored = []
        for doc in self.documents:
            text = f"{doc['topic']} {doc['subcategory']} {doc['content']}".lower()
            score = sum(1 for w in query_words if w in text)
            scored.append((score, doc["content"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return "\n\n".join([item[1] for item in scored[:top_k] if item[0] > 0])

# Global instance
rag_engine = LocalRAGEngine()
