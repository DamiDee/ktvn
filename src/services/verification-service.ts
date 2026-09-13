import {
  DRIVER_VERIFICATION,
  REQUIRED_DOCUMENTS,
  VERIFICATION_QUEUE,
} from "@/mocks/verification";
import { DocumentStatus, VerificationStatus } from "@/types/enums";
import type {
  DriverVerification,
  ReviewComment,
  VerificationDocument,
} from "@/types/models";
import {
  ApiError,
  createId,
  MockDelay,
  request,
  type RequestOptions,
} from "./api-client";

export const verificationService = {
  async getMyVerification(
    options?: RequestOptions,
  ): Promise<DriverVerification> {
    return request(() => DRIVER_VERIFICATION, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async listQueue(options?: RequestOptions): Promise<DriverVerification[]> {
    return request(() => VERIFICATION_QUEUE, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async getVerification(
    id: string,
    options?: RequestOptions,
  ): Promise<DriverVerification | null> {
    return request(
      () => VERIFICATION_QUEUE.find((record) => record.id === id) ?? null,
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async requiredDocuments(options?: RequestOptions) {
    return request(() => REQUIRED_DOCUMENTS, {
      delayMs: MockDelay.instant,
      ...options,
    });
  },

  /** Simulated upload — the UI drives its own progress animation. */
  async uploadDocument(
    document: Pick<VerificationDocument, "type" | "label"> & {
      fileName: string;
      fileType: string;
      sizeBytes: number;
    },
    options?: RequestOptions,
  ): Promise<VerificationDocument> {
    return request(
      () => ({
        id: `doc-${document.type.toLowerCase()}`,
        type: document.type,
        label: document.label,
        status: DocumentStatus.UPLOADED,
        fileName: document.fileName,
        fileType: document.fileType,
        sizeBytes: document.sizeBytes,
        uploadedAt: new Date().toISOString(),
      }),
      { delayMs: MockDelay.slow, ...options },
    );
  },

  async submitApplication(options?: RequestOptions): Promise<VerificationStatus> {
    return request(() => VerificationStatus.SUBMITTED, {
      delayMs: MockDelay.slow,
      ...options,
    });
  },

  /**
   * Records the reviewer's judgement on one document.
   *
   * Flagging always carries a reason — a bare "needs attention" tells the
   * applicant nothing about what to fix.
   */
  async setDocumentStatus(
    verificationId: string,
    documentId: string,
    status: DocumentStatus,
    note?: string,
    options?: RequestOptions,
  ): Promise<VerificationDocument> {
    return request(
      () => {
        const record = VERIFICATION_QUEUE.find(
          (entry) => entry.id === verificationId,
        );
        const document = record?.documents.find((doc) => doc.id === documentId);

        if (!document) {
          throw new ApiError(
            "We couldn't find that document.",
            "NOT_FOUND",
            false,
          );
        }

        return { ...document, status, note: note ?? document.note };
      },
      { delayMs: MockDelay.fast, ...options },
    );
  },

  /** Adds a note to the review thread, internal or sent to the applicant. */
  async addComment(
    verificationId: string,
    comment: {
      body: string;
      visibility: ReviewComment["visibility"];
      documentId?: string;
    },
    options?: RequestOptions,
  ): Promise<ReviewComment> {
    return request(
      () => ({
        id: createId("vc"),
        author: "You",
        body: comment.body,
        at: new Date().toISOString(),
        visibility: comment.visibility,
        documentId: comment.documentId,
      }),
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async decide(
    id: string,
    decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT",
    options?: RequestOptions,
  ): Promise<VerificationStatus> {
    return request(
      () => {
        if (decision === "APPROVE") return VerificationStatus.APPROVED;
        if (decision === "REJECT") return VerificationStatus.REJECTED;
        return VerificationStatus.CHANGES_REQUIRED;
      },
      { delayMs: MockDelay.normal, ...options },
    );
  },
};
