import {
  filterStatementsByDate,
  processStatement,
} from '../../services/statement-processor.js';
import type { Statement } from '../../types/index.js';
import { downloadPdf, extractFilename } from '../../lib/pdf-downloader.js';
import { uploadPdf } from '../../lib/cloudinary-service.js';

jest.mock('../../lib/pdf-downloader.js');
jest.mock('../../lib/cloudinary-service.js');

const mockDownloadPdf = downloadPdf as jest.MockedFunction<typeof downloadPdf>;
const mockExtractFilename = extractFilename as jest.MockedFunction<
  typeof extractFilename
>;
const mockUploadPdf = uploadPdf as jest.MockedFunction<typeof uploadPdf>;

describe('statement-processor', () => {
  describe('filterStatementsByDate', () => {
    const statements: Statement[] = [
      { pdfUrl: 'url1', statementDate: '2024-01-15' },
      { pdfUrl: 'url2', statementDate: '2024-02-15' },
      { pdfUrl: 'url3', statementDate: '2024-03-15' },
      { pdfUrl: 'url4', statementDate: '2023-12-15' },
    ];

    it('should filter statements after the cutoff date', () => {
      const filtered = filterStatementsByDate(statements, '2024-02-01');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].statementDate).toBe('2024-02-15');
      expect(filtered[1].statementDate).toBe('2024-03-15');
    });

    it('should exclude statements on the cutoff date', () => {
      const filtered = filterStatementsByDate(statements, '2024-02-15');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].statementDate).toBe('2024-03-15');
    });

    it('should return empty array if no statements match', () => {
      const filtered = filterStatementsByDate(statements, '2024-04-01');
      expect(filtered).toHaveLength(0);
    });

    it('should return all statements if all are after cutoff', () => {
      const filtered = filterStatementsByDate(statements, '2023-01-01');
      expect(filtered).toHaveLength(4);
    });

    it('should handle empty statements array', () => {
      const filtered = filterStatementsByDate([], '2024-01-01');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('processStatement', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('with pdfUrl (direct URL download)', () => {
      it('should download PDF from URL and upload to Cloudinary', async () => {
        const statement: Statement = {
          pdfUrl: 'https://example.com/statement.pdf',
          statementDate: '2024-01-15',
        };

        const mockBuffer = Buffer.from('%PDF-1.4\nmock pdf content');
        const mockAttachment = {
          public_id: 'supplier_statements/net_abacus/statement',
          format: 'pdf',
          url: 'https://cloudinary.com/statement.pdf',
          title: 'statement.pdf',
          etag: 'abc123',
        };

        mockDownloadPdf.mockResolvedValue(mockBuffer);
        mockExtractFilename.mockReturnValue('statement.pdf');
        mockUploadPdf.mockResolvedValue(mockAttachment);

        const result = await processStatement(statement, 'net_abacus');

        expect(mockDownloadPdf).toHaveBeenCalledWith(
          'https://example.com/statement.pdf',
        );
        expect(mockExtractFilename).toHaveBeenCalledWith(
          'https://example.com/statement.pdf',
        );
        expect(mockUploadPdf).toHaveBeenCalledWith(mockBuffer, {
          carrierName: 'net_abacus',
          filename: 'statement.pdf',
          metadata: {
            statement_date: '2024-01-15',
            carrier: 'net_abacus',
          },
        });
        expect(result).toEqual(mockAttachment);
      });

      it('should throw error if pdfUrl download fails', async () => {
        const statement: Statement = {
          pdfUrl: 'https://example.com/statement.pdf',
          statementDate: '2024-01-15',
        };

        mockDownloadPdf.mockRejectedValue(new Error('Download failed'));

        await expect(processStatement(statement, 'net_abacus')).rejects.toThrow(
          'Download failed',
        );
      });
    });

    describe('with fileBuffer (pre-captured file)', () => {
      it('should use buffer directly and upload to Cloudinary', async () => {
        const mockBuffer = Buffer.from('%PDF-1.4\nmock pdf content');
        const statement: Statement = {
          fileBuffer: mockBuffer,
          filename: 'UFG_Statement_2024-01-15.pdf',
          statementDate: '2024-01-15',
        };

        const mockAttachment = {
          public_id: 'supplier_statements/com_ufginsurance/UFG_Statement',
          format: 'pdf',
          url: 'https://cloudinary.com/ufg_statement.pdf',
          title: 'UFG_Statement_2024-01-15.pdf',
          etag: 'xyz789',
        };

        mockUploadPdf.mockResolvedValue(mockAttachment);

        const result = await processStatement(statement, 'com_ufginsurance');

        expect(mockDownloadPdf).not.toHaveBeenCalled();
        expect(mockExtractFilename).not.toHaveBeenCalled();

        expect(mockUploadPdf).toHaveBeenCalledWith(mockBuffer, {
          carrierName: 'com_ufginsurance',
          filename: 'UFG_Statement_2024-01-15.pdf',
          metadata: {
            statement_date: '2024-01-15',
            carrier: 'com_ufginsurance',
          },
        });
        expect(result).toEqual(mockAttachment);
      });

      it('should use default filename if filename is not provided', async () => {
        const mockBuffer = Buffer.from('%PDF-1.4\nmock pdf content');
        const statement: Statement = {
          fileBuffer: mockBuffer,
          statementDate: '2024-01-15',
        };

        const mockAttachment = {
          public_id: 'supplier_statements/com_ufginsurance/statement',
          format: 'pdf',
          url: 'https://cloudinary.com/statement.pdf',
          title: 'statement.pdf',
          etag: 'default123',
        };

        mockUploadPdf.mockResolvedValue(mockAttachment);

        const result = await processStatement(statement, 'com_ufginsurance');

        expect(mockUploadPdf).toHaveBeenCalledWith(mockBuffer, {
          carrierName: 'com_ufginsurance',
          filename: 'statement.pdf',
          metadata: {
            statement_date: '2024-01-15',
            carrier: 'com_ufginsurance',
          },
        });
        expect(result).toEqual(mockAttachment);
      });

      it('should throw error if fileBuffer upload fails', async () => {
        const mockBuffer = Buffer.from('%PDF-1.4\nmock pdf content');
        const statement: Statement = {
          fileBuffer: mockBuffer,
          filename: 'statement.pdf',
          statementDate: '2024-01-15',
        };

        mockUploadPdf.mockRejectedValue(new Error('Upload failed'));

        await expect(
          processStatement(statement, 'com_ufginsurance'),
        ).rejects.toThrow('Upload failed');
      });
    });

    describe('error cases', () => {
      it('should throw error if statement has neither pdfUrl nor fileBuffer', async () => {
        const statement: Statement = {
          statementDate: '2024-01-15',
        };

        await expect(processStatement(statement, 'net_abacus')).rejects.toThrow(
          'Statement has neither pdfUrl nor fileBuffer',
        );

        expect(mockDownloadPdf).not.toHaveBeenCalled();
        expect(mockUploadPdf).not.toHaveBeenCalled();
      });

      it('should throw error if fileBuffer is empty', async () => {
        const statement: Statement = {
          fileBuffer: Buffer.from([]),
          statementDate: '2024-01-15',
        };

        await expect(processStatement(statement, 'net_abacus')).rejects.toThrow(
          'PDF buffer is empty or null',
        );

        expect(mockUploadPdf).not.toHaveBeenCalled();
      });

      it('should throw error if fileBuffer does not have valid PDF header', async () => {
        const statement: Statement = {
          fileBuffer: Buffer.from('<!DOCTYPE html>'),
          filename: 'error.pdf',
          statementDate: '2024-01-15',
        };

        await expect(processStatement(statement, 'net_abacus')).rejects.toThrow(
          'Invalid PDF: expected header "%PDF" but got "<!DO"',
        );

        expect(mockUploadPdf).not.toHaveBeenCalled();
      });
    });

    describe('fileBuffer priority', () => {
      it('should prefer fileBuffer over pdfUrl when both are present', async () => {
        const mockBuffer = Buffer.from('%PDF-1.4\nmock pdf content');
        const statement: Statement = {
          pdfUrl: 'https://example.com/statement.pdf',
          fileBuffer: mockBuffer,
          filename: 'buffer_statement.pdf',
          statementDate: '2024-01-15',
        };

        const mockAttachment = {
          public_id: 'supplier_statements/net_abacus/buffer_statement',
          format: 'pdf',
          url: 'https://cloudinary.com/buffer_statement.pdf',
          title: 'buffer_statement.pdf',
          etag: 'buffer123',
        };

        mockUploadPdf.mockResolvedValue(mockAttachment);

        const result = await processStatement(statement, 'net_abacus');

        expect(mockDownloadPdf).not.toHaveBeenCalled();
        expect(mockExtractFilename).not.toHaveBeenCalled();

        expect(mockUploadPdf).toHaveBeenCalledWith(mockBuffer, {
          carrierName: 'net_abacus',
          filename: 'buffer_statement.pdf',
          metadata: {
            statement_date: '2024-01-15',
            carrier: 'net_abacus',
          },
        });
        expect(result).toEqual(mockAttachment);
      });
    });
  });
});
