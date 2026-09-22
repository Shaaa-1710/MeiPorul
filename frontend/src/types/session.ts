import { Claim } from './claim';
import { AuditMetrics } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  claims?: Claim[];
  metrics?: AuditMetrics;
  provenance?: import('./api').ProvenanceTrace;
  isAudited?: boolean;
  isMock?: boolean;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  selectedDocumentIds: string[];
}
