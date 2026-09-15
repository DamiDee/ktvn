import {
  DocumentStatus,
  DocumentType,
  DriverTrack,
  VerificationStatus,
} from "@/types/enums";
import type { DriverVerification, VerificationDocument } from "@/types/models";
import { DRIVERS, VEHICLES } from "./people";

/** Both tracks are held to the same document set — Product Rule 10. */
export const REQUIRED_DOCUMENTS: {
  type: DocumentType;
  label: string;
  hint: string;
}[] = [
  {
    type: DocumentType.GOVERNMENT_ID,
    label: "NIN slip",
    hint: "Mandatory 11-digit NIN record for identity verification",
  },
  {
    type: DocumentType.PROFILE_PHOTO,
    label: "Profile photo",
    hint: "A clear, recent photograph of your face",
  },
  {
    type: DocumentType.DRIVERS_LICENCE,
    label: "Driver's licence",
    hint: "Must be valid for at least three more months",
  },
  {
    type: DocumentType.VEHICLE_REGISTRATION,
    label: "Vehicle registration",
    hint: "Proof of ownership for the vehicle you will drive",
  },
  {
    type: DocumentType.INSURANCE,
    label: "Insurance certificate",
    hint: "Your own vehicle insurance policy",
  },
  {
    type: DocumentType.ROADWORTHINESS,
    label: "Roadworthiness certificate",
    hint: "Current certificate issued by a licensed centre",
  },
];

function doc(
  type: DocumentType,
  label: string,
  status: DocumentStatus,
  extra: Partial<VerificationDocument> = {},
): VerificationDocument {
  return { id: `doc-${type.toLowerCase()}`, type, label, status, ...extra };
}

export const DRIVER_VERIFICATION: DriverVerification = {
  id: "ver-0041",
  driverId: DRIVERS[1].id,
  applicantName: DRIVERS[1].fullName,
  applicantAvatarUrl: DRIVERS[1].avatarUrl,
  track: DriverTrack.VOLUNTEER,
  status: VerificationStatus.INSPECTION_REQUIRED,
  submittedAt: "2026-09-04T10:12:00.000Z",
  updatedAt: "2026-09-08T14:30:00.000Z",
  statusDetail:
    "Your documents have been accepted. A physical vehicle inspection is required before final approval.",
  vehicle: VEHICLES.corolla,
  documents: [
    doc(DocumentType.GOVERNMENT_ID, "NIN slip", DocumentStatus.VERIFIED, {
      fileName: "nin-slip.pdf",
      fileType: "PDF",
      sizeBytes: 482_112,
      uploadedAt: "2026-09-04T10:04:00.000Z",
    }),
    doc(DocumentType.PROFILE_PHOTO, "Profile photo", DocumentStatus.VERIFIED, {
      fileName: "profile.jpg",
      fileType: "JPG",
      sizeBytes: 214_003,
      uploadedAt: "2026-09-04T10:05:00.000Z",
    }),
    doc(
      DocumentType.DRIVERS_LICENCE,
      "Driver's licence",
      DocumentStatus.VERIFIED,
      {
        fileName: "licence.pdf",
        fileType: "PDF",
        sizeBytes: 366_918,
        uploadedAt: "2026-09-04T10:06:00.000Z",
        expiresAt: "2028-02-19T00:00:00.000Z",
      },
    ),
    doc(
      DocumentType.VEHICLE_REGISTRATION,
      "Vehicle registration",
      DocumentStatus.UPLOADED,
      {
        fileName: "registration.pdf",
        fileType: "PDF",
        sizeBytes: 291_444,
        uploadedAt: "2026-09-04T10:08:00.000Z",
      },
    ),
    doc(DocumentType.INSURANCE, "Insurance certificate", DocumentStatus.UPLOADED, {
      fileName: "insurance-2026.pdf",
      fileType: "PDF",
      sizeBytes: 501_220,
      uploadedAt: "2026-09-04T10:09:00.000Z",
      expiresAt: "2027-01-31T00:00:00.000Z",
    }),
    doc(
      DocumentType.ROADWORTHINESS,
      "Roadworthiness certificate",
      DocumentStatus.NEEDS_ATTENTION,
      {
        fileName: "roadworthiness.jpg",
        fileType: "JPG",
        sizeBytes: 188_760,
        uploadedAt: "2026-09-04T10:10:00.000Z",
        note: "The certificate number is not legible. Please upload a clearer copy.",
      },
    ),
  ],
  steps: [
    {
      id: "step-submitted",
      label: "Application submitted",
      description: "We received your application.",
      status: "COMPLETE",
      completedAt: "2026-09-04T10:12:00.000Z",
    },
    {
      id: "step-documents",
      label: "Documents received",
      description: "All required documents were uploaded.",
      status: "COMPLETE",
      completedAt: "2026-09-04T10:12:00.000Z",
    },
    {
      id: "step-review",
      label: "Document review",
      description: "Your driver's licence and vehicle papers were checked.",
      status: "COMPLETE",
      completedAt: "2026-09-07T09:20:00.000Z",
    },
    {
      id: "step-inspection",
      label: "Physical inspection",
      description: "A team member will inspect your vehicle in person.",
      status: "ACTIVE",
    },
    {
      id: "step-final",
      label: "Final approval",
      description: "Final checks before you can accept passengers.",
      status: "PENDING",
    },
  ],
  inspection: {
    required: true,
    scheduled: false,
    note: "The verification team will contact you with inspection details.",
  },
  comments: [
    {
      id: "vc-0041-1",
      author: "Deborah Ajayi",
      body: "ID, licence and registration all match the membership record. Holding for the vehicle inspection.",
      at: "2026-09-08T14:28:00.000Z",
      visibility: "INTERNAL",
    },
    {
      id: "vc-0041-2",
      author: "Deborah Ajayi",
      body: "Your documents look good. We'll be in touch to book the vehicle inspection this week.",
      at: "2026-09-08T14:31:00.000Z",
      visibility: "APPLICANT",
    },
  ],
};

/** Admin verification queue. */
export const VERIFICATION_QUEUE: DriverVerification[] = [
  DRIVER_VERIFICATION,
  {
    id: "ver-0042",
    driverId: DRIVERS[5].id,
    applicantName: DRIVERS[5].fullName,
    applicantAvatarUrl: DRIVERS[5].avatarUrl,
    track: DriverTrack.PROFESSIONAL,
    status: VerificationStatus.DOCUMENT_REVIEW,
    submittedAt: "2026-09-07T16:44:00.000Z",
    updatedAt: "2026-09-09T08:12:00.000Z",
    statusDetail: "Licence and insurance documents are being reviewed.",
    vehicle: VEHICLES.accent,
    documents: [
      doc(DocumentType.GOVERNMENT_ID, "NIN slip", DocumentStatus.UPLOADED, {
        fileName: "id.pdf",
        fileType: "PDF",
        uploadedAt: "2026-09-07T16:40:00.000Z",
      }),
      doc(DocumentType.PROFILE_PHOTO, "Profile photo", DocumentStatus.UPLOADED, {
        fileName: "photo.jpg",
        fileType: "JPG",
        uploadedAt: "2026-09-07T16:41:00.000Z",
      }),
      doc(
        DocumentType.DRIVERS_LICENCE,
        "Driver's licence",
        DocumentStatus.UPLOADED,
        {
          fileName: "licence.pdf",
          fileType: "PDF",
          uploadedAt: "2026-09-07T16:42:00.000Z",
          expiresAt: "2026-11-02T00:00:00.000Z",
        },
      ),
      doc(
        DocumentType.VEHICLE_REGISTRATION,
        "Vehicle registration",
        DocumentStatus.UPLOADED,
        { fileName: "reg.pdf", fileType: "PDF", uploadedAt: "2026-09-07T16:43:00.000Z" },
      ),
      doc(DocumentType.INSURANCE, "Insurance certificate", DocumentStatus.EXPIRED, {
        fileName: "insurance-2025.pdf",
        fileType: "PDF",
        uploadedAt: "2026-09-07T16:43:30.000Z",
        expiresAt: "2026-06-30T00:00:00.000Z",
        note: "This policy expired on 30 June 2026.",
      }),
      doc(
        DocumentType.ROADWORTHINESS,
        "Roadworthiness certificate",
        DocumentStatus.MISSING,
      ),
    ],
    steps: [
      {
        id: "step-submitted",
        label: "Application submitted",
        description: "We received your application.",
        status: "COMPLETE",
        completedAt: "2026-09-07T16:44:00.000Z",
      },
      {
        id: "step-documents",
        label: "Documents received",
        description: "Two documents still need attention.",
        status: "COMPLETE",
        completedAt: "2026-09-07T16:44:00.000Z",
      },
      {
        id: "step-review",
        label: "Document review",
        description: "Reviewing licence, registration and insurance.",
        status: "ACTIVE",
      },
      {
        id: "step-inspection",
        label: "Physical inspection",
        description: "Scheduled once documents are cleared.",
        status: "PENDING",
      },
      {
        id: "step-final",
        label: "Final approval",
        description: "Final checks before approval.",
        status: "PENDING",
      },
    ],
    inspection: { required: true, scheduled: false },
    comments: [
      {
        id: "vc-0042-1",
        author: "Deborah Ajayi",
        body: "Insurance expired in June and there's no roadworthiness certificate at all. Can't progress this one.",
        at: "2026-09-09T09:05:00.000Z",
        visibility: "INTERNAL",
      },
    ],
    changesRequested: [
      "Upload a current insurance certificate",
      "Upload a roadworthiness certificate",
    ],
  },
  {
    id: "ver-0043",
    driverId: DRIVERS[4].id,
    applicantName: DRIVERS[4].fullName,
    applicantAvatarUrl: DRIVERS[4].avatarUrl,
    track: DriverTrack.VOLUNTEER,
    status: VerificationStatus.INSPECTION_SCHEDULED,
    submittedAt: "2026-09-01T11:20:00.000Z",
    updatedAt: "2026-09-08T10:00:00.000Z",
    statusDetail: "Vehicle inspection scheduled for Thursday morning.",
    vehicle: VEHICLES.civic,
    documents: REQUIRED_DOCUMENTS.map((required) =>
      doc(required.type, required.label, DocumentStatus.VERIFIED, {
        fileName: `${required.type.toLowerCase()}.pdf`,
        fileType: "PDF",
        uploadedAt: "2026-09-01T11:15:00.000Z",
      }),
    ),
    steps: [
      { id: "step-submitted", label: "Application submitted", description: "Received.", status: "COMPLETE", completedAt: "2026-09-01T11:20:00.000Z" },
      { id: "step-documents", label: "Documents received", description: "All documents uploaded.", status: "COMPLETE", completedAt: "2026-09-01T11:20:00.000Z" },
      { id: "step-review", label: "Document review", description: "Documents verified.", status: "COMPLETE", completedAt: "2026-09-05T09:00:00.000Z" },
      { id: "step-inspection", label: "Physical inspection", description: "Scheduled at Lugbe inspection point.", status: "ACTIVE" },
      { id: "step-final", label: "Final approval", description: "Final checks before approval.", status: "PENDING" },
    ],
    inspection: {
      required: true,
      scheduled: true,
      scheduledAt: "2026-09-10T09:30:00.000Z",
      location: "Koinonia Centre car park, Lugbe",
    },
  },
  {
    id: "ver-0044",
    driverId: DRIVERS[0].id,
    applicantName: DRIVERS[0].fullName,
    applicantAvatarUrl: DRIVERS[0].avatarUrl,
    track: DriverTrack.PROFESSIONAL,
    status: VerificationStatus.FINAL_REVIEW,
    submittedAt: "2026-08-28T08:00:00.000Z",
    updatedAt: "2026-09-09T07:45:00.000Z",
    statusDetail: "The verification team is completing final checks.",
    vehicle: VEHICLES.camry,
    documents: REQUIRED_DOCUMENTS.map((required) =>
      doc(required.type, required.label, DocumentStatus.VERIFIED, {
        fileName: `${required.type.toLowerCase()}.pdf`,
        fileType: "PDF",
        uploadedAt: "2026-08-28T07:50:00.000Z",
      }),
    ),
    steps: [
      { id: "step-submitted", label: "Application submitted", description: "Received.", status: "COMPLETE", completedAt: "2026-08-28T08:00:00.000Z" },
      { id: "step-documents", label: "Documents received", description: "All documents uploaded.", status: "COMPLETE", completedAt: "2026-08-28T08:00:00.000Z" },
      { id: "step-review", label: "Document review", description: "Documents verified.", status: "COMPLETE", completedAt: "2026-08-30T12:00:00.000Z" },
      { id: "step-inspection", label: "Physical inspection", description: "Vehicle passed inspection.", status: "COMPLETE", completedAt: "2026-09-06T11:00:00.000Z" },
      { id: "step-final", label: "Final approval", description: "Final checks in progress.", status: "ACTIVE" },
    ],
    inspection: {
      required: true,
      scheduled: true,
      scheduledAt: "2026-09-06T11:00:00.000Z",
      location: "Koinonia Centre car park, Lugbe",
    },
  },
];

/** Steps in the driver application wizard. */
export const APPLICATION_STEPS = [
  { id: "identity", number: "01", label: "Identity" },
  { id: "licence", number: "02", label: "Licence" },
  { id: "vehicle", number: "03", label: "Vehicle" },
  { id: "documents", number: "04", label: "Documents" },
  { id: "track", number: "05", label: "Track" },
  { id: "review", number: "06", label: "Review" },
] as const;

export type ApplicationStepId = (typeof APPLICATION_STEPS)[number]["id"];
