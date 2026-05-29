/**
 * digital-office.test.js — Digital Office logic tests
 * 
 * Tests document management, user permissions, and workflow logic.
 * Pure unit tests.
 */

const DocumentManager = {
  isValidDocument: (doc) => {
    return !!(doc?.title && doc?.type && doc?.authorId);
  },

  canUserAccess: (user, document) => {
    if (!user || !document) return false;
    if (user.role === 'ADMIN') return true;
    if (document.authorId === user.id) return true;
    if (document.sharedWith?.includes(user.id)) return true;
    if (document.isPublic) return true;
    return false;
  },

  getDocumentStatus: (doc) => {
    if (!doc) return 'UNKNOWN';
    if (doc.archivedAt) return 'ARCHIVED';
    if (doc.approvedAt) return 'APPROVED';
    if (doc.submittedAt) return 'PENDING_REVIEW';
    return 'DRAFT';
  },

  formatFileSize: (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  },

  generateDocumentCode: (type, department, sequence) => {
    const typeCode = type.substring(0, 2).toUpperCase();
    const deptCode = department.substring(0, 3).toUpperCase();
    const seqStr = String(sequence).padStart(4, '0');
    const year = new Date().getFullYear();
    return `${typeCode}-${deptCode}-${year}-${seqStr}`;
  },
};

describe('Digital Office — Document Manager', () => {
  describe('isValidDocument', () => {
    it('returns true for complete document', () => {
      expect(DocumentManager.isValidDocument({
        title: 'Q1 Report', type: 'REPORT', authorId: 'u1'
      })).toBe(true);
    });

    it('returns false for incomplete documents', () => {
      expect(DocumentManager.isValidDocument({ title: 'Test' })).toBe(false);
      expect(DocumentManager.isValidDocument(null)).toBe(false);
    });
  });

  describe('canUserAccess', () => {
    const adminUser = { id: 'admin1', role: 'ADMIN' };
    const regularUser = { id: 'user1', role: 'STAFF' };
    const doc = { id: 'doc1', authorId: 'author1', isPublic: false, sharedWith: ['user1'] };

    it('grants admin access to any document', () => {
      expect(DocumentManager.canUserAccess(adminUser, doc)).toBe(true);
    });

    it('grants access to document author', () => {
      const author = { id: 'author1', role: 'STAFF' };
      expect(DocumentManager.canUserAccess(author, doc)).toBe(true);
    });

    it('grants access to users in sharedWith list', () => {
      expect(DocumentManager.canUserAccess(regularUser, doc)).toBe(true);
    });

    it('denies access to unauthorized users', () => {
      const stranger = { id: 'stranger', role: 'STAFF' };
      expect(DocumentManager.canUserAccess(stranger, doc)).toBe(false);
    });

    it('grants access to public documents', () => {
      const publicDoc = { ...doc, isPublic: true, sharedWith: [] };
      const stranger = { id: 'stranger', role: 'STAFF' };
      expect(DocumentManager.canUserAccess(stranger, publicDoc)).toBe(true);
    });
  });

  describe('getDocumentStatus', () => {
    it('returns ARCHIVED for archived docs', () => {
      expect(DocumentManager.getDocumentStatus({ archivedAt: new Date() })).toBe('ARCHIVED');
    });

    it('returns APPROVED for approved docs', () => {
      expect(DocumentManager.getDocumentStatus({ approvedAt: new Date() })).toBe('APPROVED');
    });

    it('returns PENDING_REVIEW for submitted docs', () => {
      expect(DocumentManager.getDocumentStatus({ submittedAt: new Date() })).toBe('PENDING_REVIEW');
    });

    it('returns DRAFT for new docs', () => {
      expect(DocumentManager.getDocumentStatus({ title: 'Draft' })).toBe('DRAFT');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => { expect(DocumentManager.formatFileSize(512)).toBe('512 B'); });
    it('formats kilobytes', () => { expect(DocumentManager.formatFileSize(1536)).toBe('1.5 KB'); });
    it('formats megabytes', () => { expect(DocumentManager.formatFileSize(2097152)).toBe('2.0 MB'); });
    it('formats gigabytes', () => { expect(DocumentManager.formatFileSize(1073741824)).toBe('1.0 GB'); });
  });

  describe('generateDocumentCode', () => {
    it('generates correct document code format', () => {
      const code = DocumentManager.generateDocumentCode('REPORT', 'SALES', 1);
      const year = new Date().getFullYear();
      expect(code).toBe(`RE-SAL-${year}-0001`);
    });

    it('pads sequence numbers correctly', () => {
      const code = DocumentManager.generateDocumentCode('MEMO', 'HR', 42);
      const year = new Date().getFullYear();
      expect(code).toBe(`ME-HR-${year}-0042`);
    });
  });
});
