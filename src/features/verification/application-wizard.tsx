"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  HandHeart,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StepIndicator } from "@/components/ui/progress";
import { VerifiedBadge } from "@/components/ui/badge";
import { SafetyNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { DocumentUpload } from "@/components/verification/document-upload";
import { useApplicationStore } from "@/stores/application-store";
import { verificationService } from "@/services";
import { APPLICATION_STEPS, REQUIRED_DOCUMENTS } from "@/mocks/verification";
import { DocumentType, DriverTrack } from "@/types/enums";
import { transitions } from "@/lib/motion";
import {
  identitySchema,
  licenceSchema,
  vehicleSchema,
  LICENCE_CLASSES,
  SEAT_OPTIONS,
  KOINONIA_DEPARTMENTS,
  type IdentityValues,
  type LicenceValues,
  type VehicleValues,
} from "./application-schemas";

/**
 * The driver application.
 *
 * Six steps rather than one long form, each validated on its own, with the
 * draft held in a store so moving back never loses an answer. Both tracks
 * complete the identical application — the track choice is the last thing
 * asked, not a fork in the process.
 */
export function ApplicationWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const stepIndex = useApplicationStore((state) => state.stepIndex);
  const setStepIndex = useApplicationStore((state) => state.setStepIndex);
  const next = useApplicationStore((state) => state.next);
  const back = useApplicationStore((state) => state.back);
  const markSubmitted = useApplicationStore((state) => state.markSubmitted);

  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);

  const step = APPLICATION_STEPS[stepIndex];

  function goNext() {
    setDirection(1);
    next(APPLICATION_STEPS.length);
  }

  function goBack() {
    setDirection(-1);
    back();
  }

  async function submit() {
    setSubmitting(true);
    try {
      await verificationService.submitApplication();
      markSubmitted();
      toast({
        title: "Application submitted",
        description: "We'll review your documents and be in touch.",
        tone: "success",
      });
      router.push("/driver/verification");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Driver application"
        title="Drive with purpose."
        description="The same verification standard applies whether you drive in service or professionally."
      />

      <StepIndicator
        steps={[...APPLICATION_STEPS]}
        currentIndex={stepIndex}
        onStepClick={(index) => {
          setDirection(index > stepIndex ? 1 : -1);
          setStepIndex(index);
        }}
        className="mb-6"
      />

      <Card radius="xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={transitions.card}
          >
            {step.id === "identity" ? <IdentityStep onNext={goNext} /> : null}
            {step.id === "licence" ? (
              <LicenceStep onNext={goNext} onBack={goBack} />
            ) : null}
            {step.id === "vehicle" ? (
              <VehicleStep onNext={goNext} onBack={goBack} />
            ) : null}
            {step.id === "documents" ? (
              <DocumentsStep onNext={goNext} onBack={goBack} />
            ) : null}
            {step.id === "track" ? (
              <TrackStep onNext={goNext} onBack={goBack} />
            ) : null}
            {step.id === "review" ? (
              <ReviewStep
                onBack={goBack}
                onSubmit={submit}
                submitting={submitting}
                onEditStep={(index) => {
                  setDirection(-1);
                  setStepIndex(index);
                }}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}

/* --- Shared step chrome --------------------------------------------------- */

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="type-section-title text-ink">{title}</h2>
      <p className="type-body mt-1.5 text-ink-secondary">{description}</p>
    </div>
  );
}

function StepActions({
  onBack,
  nextLabel = "Continue",
  submitting = false,
  type = "submit",
  onNext,
}: {
  onBack?: () => void;
  nextLabel?: string;
  submitting?: boolean;
  type?: "submit" | "button";
  onNext?: () => void;
}) {
  return (
    <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-line pt-6 sm:flex-row sm:justify-end">
      {onBack ? (
        <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={onBack}>
          Back
        </Button>
      ) : null}
      <Button
        type={type}
        variant="primary"
        size="lg"
        iconRight={ArrowRight}
        loading={submitting}
        loadingLabel="Submitting"
        onClick={type === "button" ? onNext : undefined}
      >
        {nextLabel}
      </Button>
    </div>
  );
}

/* --- 01 Identity ---------------------------------------------------------- */

function IdentityStep({ onNext }: { onNext: () => void }) {
  const identity = useApplicationStore((state) => state.identity);
  const setIdentity = useApplicationStore((state) => state.setIdentity);
  const documents = useApplicationStore((state) => state.documents);
  const setDocument = useApplicationStore((state) => state.setDocument);

  const [showMissing, setShowMissing] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<IdentityValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      fullName: identity.fullName ?? "",
      email: identity.email ?? "",
      phone: identity.phone ?? "",
      nin: identity.nin ?? "",
      address: identity.address ?? "",
      workerStatus: identity.workerStatus,
      department: identity.department ?? "",
      guarantorName: identity.guarantorName ?? "",
      guarantorPhone: identity.guarantorPhone ?? "",
      guarantorRelationship: identity.guarantorRelationship ?? "",
    },
  });

  const workerStatus = useWatch({ control, name: "workerStatus" });
  const missingUploads =
    !documents[DocumentType.GOVERNMENT_ID] ||
    !documents[DocumentType.PROFILE_PHOTO] ||
    (workerStatus === "NO" && !documents[DocumentType.GUARANTOR_PHOTO]);

  return (
    <form
      onSubmit={handleSubmit((values) => {
        // The photographs are part of this step, so the step isn't finished
        // until they're both here.
        if (missingUploads) {
          setShowMissing(true);
          return;
        }
        setIdentity(values);
        onNext();
      })}
      noValidate
    >
      <StepHeading
        title="Who you are"
        description="We verify your identity, NIN and connection to the Koinonia community."
      />

      <div className="space-y-5">
        <Input
          label="Full name"
          placeholder="Emeka Nwosu"
          icon={User}
          error={errors.fullName?.message}
          required
          {...register("fullName")}
        />
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="emeka.nwosu@example.com"
          icon={Mail}
          error={errors.email?.message}
          required
          {...register("email")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            placeholder="+234 807 000 0000"
            icon={Phone}
            error={errors.phone?.message}
            required
            {...register("phone")}
          />
          <Input
            label="Home address"
            placeholder="FHA Lugbe, Abuja"
            icon={MapPin}
            error={errors.address?.message}
            required
            {...register("address")}
          />
        </div>

        <Input
          label="National Identity Number (NIN)"
          placeholder="12345678901"
          inputMode="numeric"
          maxLength={11}
          icon={IdCard}
          hint="Your 11-digit NIN is mandatory for driver verification."
          error={errors.nin?.message}
          required
          {...register("nin")}
        />

        <Select
          label="Are you a Koinonia worker?"
          placeholder="Select an answer"
          options={[
            { value: "YES", label: "Yes, I am a Koinonia worker" },
            { value: "NO", label: "No, I will provide a guarantor" },
          ]}
          error={errors.workerStatus?.message}
          required
          {...register("workerStatus")}
        />

        {workerStatus === "YES" ? (
          <Select
            label="Koinonia department"
            placeholder="Select your department"
            options={KOINONIA_DEPARTMENTS.map((department) => ({
              value: department,
              label: department,
            }))}
            error={errors.department?.message}
            required
            {...register("department")}
          />
        ) : null}

        {workerStatus === "NO" ? (
          <div className="space-y-5 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4">
            <div>
              <p className="type-card-title text-ink">Guarantor details</p>
              <p className="type-meta mt-1 text-ink-secondary">
                Your guarantor must be reachable and known within the community.
              </p>
            </div>
            <Input
              label="Guarantor's full name"
              placeholder="Grace Adeyemi"
              icon={User}
              error={errors.guarantorName?.message}
              required
              {...register("guarantorName")}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Guarantor's phone"
                type="tel"
                placeholder="+234 802 000 0000"
                icon={Phone}
                error={errors.guarantorPhone?.message}
                required
                {...register("guarantorPhone")}
              />
              <Input
                label="Relationship"
                placeholder="Family friend"
                error={errors.guarantorRelationship?.message}
                required
                {...register("guarantorRelationship")}
              />
            </div>
            <DocumentUpload
              type={DocumentType.GUARANTOR_PHOTO}
              label="Guarantor photo"
              hint="A clear, recent photo used during verification"
              document={documents[DocumentType.GUARANTOR_PHOTO]}
              onUploaded={(doc) => setDocument(DocumentType.GUARANTOR_PHOTO, doc)}
              onRemoved={() => setDocument(DocumentType.GUARANTOR_PHOTO, null)}
              missingError={
                showMissing ? "Upload your guarantor's photo to continue" : undefined
              }
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <DocumentUpload
            type={DocumentType.GOVERNMENT_ID}
            label="NIN slip"
            hint="A clear image or PDF of your official NIN slip"
            document={documents[DocumentType.GOVERNMENT_ID]}
            onUploaded={(doc) => setDocument(DocumentType.GOVERNMENT_ID, doc)}
            onRemoved={() => setDocument(DocumentType.GOVERNMENT_ID, null)}
            missingError={
              showMissing ? "Upload your NIN slip to continue" : undefined
            }
          />
          <DocumentUpload
            type={DocumentType.PROFILE_PHOTO}
            label="Profile photo"
            hint="A clear, recent photo of your face"
            document={documents[DocumentType.PROFILE_PHOTO]}
            onUploaded={(doc) => setDocument(DocumentType.PROFILE_PHOTO, doc)}
            onRemoved={() => setDocument(DocumentType.PROFILE_PHOTO, null)}
            missingError={
              showMissing ? "Upload a profile photo to continue" : undefined
            }
          />
        </div>
      </div>

      <StepActions />
    </form>
  );
}

/* --- 02 Licence ----------------------------------------------------------- */

function LicenceStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const licence = useApplicationStore((state) => state.licence);
  const setLicence = useApplicationStore((state) => state.setLicence);
  const documents = useApplicationStore((state) => state.documents);
  const setDocument = useApplicationStore((state) => state.setDocument);

  const [showMissing, setShowMissing] = useState(false);
  const missingLicence = !documents[DocumentType.DRIVERS_LICENCE];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LicenceValues>({
    resolver: zodResolver(licenceSchema),
    defaultValues: {
      licenceNumber: licence.licenceNumber ?? "",
      licenceClass: licence.licenceClass ?? "",
      licenceExpiry: licence.licenceExpiry ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (missingLicence) {
          setShowMissing(true);
          return;
        }
        setLicence(values);
        onNext();
      })}
      noValidate
    >
      <StepHeading
        title="Your driver's licence"
        description="It must be valid for at least three more months on the day you apply."
      />

      <div className="space-y-5">
        <Input
          label="Licence number"
          placeholder="ABC12345AA"
          error={errors.licenceNumber?.message}
          required
          {...register("licenceNumber")}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Licence class"
            placeholder="Select a class"
            options={LICENCE_CLASSES}
            error={errors.licenceClass?.message}
            required
            {...register("licenceClass")}
          />
          <Input
            label="Expiry date"
            type="date"
            error={errors.licenceExpiry?.message}
            required
            {...register("licenceExpiry")}
          />
        </div>

        <DocumentUpload
          type={DocumentType.DRIVERS_LICENCE}
          label="Driver's licence"
          hint="Photograph or scan both sides if they carry information"
          document={documents[DocumentType.DRIVERS_LICENCE]}
          onUploaded={(doc) => setDocument(DocumentType.DRIVERS_LICENCE, doc)}
          onRemoved={() => setDocument(DocumentType.DRIVERS_LICENCE, null)}
          missingError={
            showMissing
              ? "Upload a photo of your licence to continue"
              : undefined
          }
        />
      </div>

      <StepActions onBack={onBack} />
    </form>
  );
}

/* --- 03 Vehicle ----------------------------------------------------------- */

function VehicleStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const vehicle = useApplicationStore((state) => state.vehicle);
  const setVehicle = useApplicationStore((state) => state.setVehicle);
  const documents = useApplicationStore((state) => state.documents);
  const setDocument = useApplicationStore((state) => state.setDocument);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      colour: vehicle.colour ?? "",
      plateNumber: vehicle.plateNumber ?? "",
      year: vehicle.year ?? "",
      seats: vehicle.seats ?? "",
    },
  });

  const live = useWatch({ control });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setVehicle(values);
        onNext();
      })}
      noValidate
    >
      <StepHeading
        title="Your vehicle"
        description="Passengers see this before they board, so it needs to match the car exactly."
      />

      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Make"
            placeholder="Toyota"
            error={errors.make?.message}
            required
            {...register("make")}
          />
          <Input
            label="Model"
            placeholder="Corolla"
            error={errors.model?.message}
            required
            {...register("model")}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Colour"
            placeholder="Silver"
            error={errors.colour?.message}
            required
            {...register("colour")}
          />
          <Input
            label="Year"
            inputMode="numeric"
            placeholder="2018"
            error={errors.year?.message}
            required
            {...register("year")}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Plate number"
            placeholder="ABC-123-XY"
            className="type-numeric uppercase"
            error={errors.plateNumber?.message}
            required
            {...register("plateNumber")}
          />
          <Select
            label="Passenger seats"
            placeholder="Select"
            options={SEAT_OPTIONS}
            error={errors.seats?.message}
            required
            {...register("seats")}
          />
        </div>

        {/* Live summary — what a passenger will actually see */}
        <div>
          <p className="type-micro mb-2.5 text-ink-muted">
            How passengers will see it
          </p>
          <NestedTile className="grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Vehicle</p>
              <p className="type-meta mt-1 truncate font-semibold text-ink">
                {live.make || live.model
                  ? `${live.make} ${live.model}`.trim()
                  : "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Colour</p>
              <p className="type-meta mt-1 truncate font-semibold text-ink">
                {live.colour || "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Plate</p>
              <p className="type-numeric type-meta mt-1 truncate font-semibold text-ink uppercase">
                {live.plateNumber || "—"}
              </p>
            </div>
          </NestedTile>
        </div>

        <DocumentUpload
          type={DocumentType.VEHICLE_PHOTO}
          label="Vehicle photo"
          hint="A clear photo of the car, showing the plate"
          document={documents[DocumentType.VEHICLE_PHOTO]}
          onUploaded={(doc) => setDocument(DocumentType.VEHICLE_PHOTO, doc)}
          onRemoved={() => setDocument(DocumentType.VEHICLE_PHOTO, null)}
        />
      </div>

      <StepActions onBack={onBack} />
    </form>
  );
}

/* --- 04 Documents --------------------------------------------------------- */

const VEHICLE_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.VEHICLE_REGISTRATION,
  DocumentType.INSURANCE,
  DocumentType.ROADWORTHINESS,
];

const VEHICLE_DOCUMENTS = REQUIRED_DOCUMENTS.filter((doc) =>
  VEHICLE_DOCUMENT_TYPES.includes(doc.type),
);

function DocumentsStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const documents = useApplicationStore((state) => state.documents);
  const setDocument = useApplicationStore((state) => state.setDocument);

  const [showMissing, setShowMissing] = useState(false);
  const missing = VEHICLE_DOCUMENTS.filter((doc) => !documents[doc.type]);

  return (
    <div>
      <StepHeading
        title="Vehicle documents"
        description="The same three documents are required on both tracks."
      />

      <div className="space-y-4">
        {VEHICLE_DOCUMENTS.map((required) => (
          <DocumentUpload
            key={required.type}
            type={required.type}
            label={required.label}
            hint={required.hint}
            document={documents[required.type]}
            onUploaded={(doc) => setDocument(required.type, doc)}
            onRemoved={() => setDocument(required.type, null)}
            missingError={
              showMissing ? `Upload your ${required.label.toLowerCase()}` : undefined
            }
          />
        ))}
      </div>

      {missing.length > 0 ? (
        <p
          className={cn(
            "type-meta mt-4",
            showMissing
              ? "text-danger-600 dark:text-red-300"
              : "text-ink-muted",
          )}
        >
          {missing.length} of {VEHICLE_DOCUMENTS.length} still to upload. All
          three are required before you can submit.
        </p>
      ) : null}

      <StepActions
        onBack={onBack}
        type="button"
        onNext={() => {
          if (missing.length > 0) {
            setShowMissing(true);
            return;
          }
          onNext();
        }}
      />
    </div>
  );
}

/* --- 05 Track ------------------------------------------------------------- */

function TrackStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const tracks = useApplicationStore((state) => state.tracks);
  const toggleTrack = useApplicationStore((state) => state.toggleTrack);

  const options = [
    {
      value: DriverTrack.VOLUNTEER,
      label: "Volunteer",
      icon: HandHeart,
      description: "Serve through your journey.",
      detail: "Offer seats you already have. No fare is charged or collected.",
    },
    {
      value: DriverTrack.PROFESSIONAL,
      label: "Professional",
      icon: Wallet,
      description: "Earn through verified transportation.",
      detail: "Paid journeys with upfront fares, receipts and earnings records.",
    },
  ] as const;

  return (
    <div>
      <StepHeading
        title="Choose your driving tracks"
        description="Select one or both. Each time you go online, you'll choose which approved track to use."
      />

      <div className="grid gap-3 sm:grid-cols-2" aria-label="Driver tracks">
        {options.map((option) => {
          const selected = tracks.includes(option.value);
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleTrack(option.value)}
              className={cn(
                "relative rounded-[var(--kx-radius-lg)] border p-5 text-left transition-all duration-[200ms]",
                selected
                  ? "border-forest-500 bg-forest-50 shadow-sm dark:border-gold-500/70 dark:bg-gold-500/10"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-nested",
              )}
            >
              <span className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-full bg-forest-100 text-forest-700 dark:bg-gold-500/15 dark:text-gold-300">
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border",
                    selected
                      ? "border-forest-600 bg-forest-600 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-forest-950"
                      : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              </span>
              <span className="type-card-title mt-4 block text-ink">{option.label}</span>
              <span className="type-meta mt-1 block font-medium text-ink-secondary">
                {option.description}
              </span>
              <span className="type-meta mt-2 block text-ink-muted">{option.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <VerifiedBadge label="Same verification standard" tone="forest" size="md" />
      </div>

      {tracks.length === 0 ? (
        <p className="type-meta mt-4 text-center text-ink-muted">
          Choose at least one track to continue.
        </p>
      ) : null}

      <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          disabled={tracks.length === 0}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

/* --- 06 Review ------------------------------------------------------------ */

function ReviewStep({
  onBack,
  onSubmit,
  submitting,
  onEditStep,
}: {
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  onEditStep: (index: number) => void;
}) {
  const { identity, licence, vehicle, tracks, documents } = useApplicationStore();

  const uploaded = Object.keys(documents).length;

  return (
    <div>
      <StepHeading
        title="Review your application"
        description="Check everything reads correctly, then send it to the verification team."
      />

      <div className="space-y-3">
        <ReviewSection
          title="Identity"
          icon={User}
          onEdit={() => onEditStep(0)}
          rows={[
            ["Full name", identity.fullName],
            ["Email", identity.email],
            ["Phone", identity.phone],
            ["NIN", identity.nin ? `•••••••${identity.nin.slice(-4)}` : undefined],
            ["Address", identity.address],
            [
              "Community eligibility",
              identity.workerStatus === "YES"
                ? identity.department
                : identity.workerStatus === "NO"
                  ? `Guarantor: ${identity.guarantorName ?? "Provided"}`
                  : undefined,
            ],
          ]}
        />

        <ReviewSection
          title="Licence"
          icon={IdCard}
          onEdit={() => onEditStep(1)}
          rows={[
            ["Number", licence.licenceNumber],
            [
              "Class",
              LICENCE_CLASSES.find((c) => c.value === licence.licenceClass)
                ?.label ?? licence.licenceClass,
            ],
            ["Expires", licence.licenceExpiry],
          ]}
        />

        <ReviewSection
          title="Vehicle"
          icon={Car}
          onEdit={() => onEditStep(2)}
          rows={[
            [
              "Vehicle",
              vehicle.make && vehicle.model
                ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ""}`
                : undefined,
            ],
            ["Colour", vehicle.colour],
            ["Plate", vehicle.plateNumber?.toUpperCase()],
            ["Passenger seats", vehicle.seats],
          ]}
        />

        <ReviewSection
          title="Documents"
          icon={ShieldCheck}
          onEdit={() => onEditStep(3)}
          rows={[
            ["Uploaded", `${uploaded} document${uploaded === 1 ? "" : "s"}`],
            ...Object.values(documents).map(
              (doc) => [doc.label, doc.fileName] as [string, string | undefined],
            ),
          ]}
        />

        <ReviewSection
          title="Driving tracks"
          icon={tracks.includes(DriverTrack.PROFESSIONAL) ? Wallet : HandHeart}
          onEdit={() => onEditStep(4)}
          rows={[
            [
              "Approved tracks requested",
              tracks.length
                ? tracks
                    .map((track) =>
                      track === DriverTrack.PROFESSIONAL ? "Professional" : "Volunteer",
                    )
                    .join(" and ")
                : undefined,
            ],
            [
              "How it works",
              tracks.length
                ? "Choose an active track each time you go online."
                : undefined,
            ],
          ]}
        />
      </div>

      <SafetyNote className="mt-5">
        Submitting sends your documents to the verification team. Approval also
        requires a physical inspection of your vehicle, which we&rsquo;ll arrange
        with you.
      </SafetyNote>

      <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="lg"
          icon={ArrowLeft}
          onClick={onBack}
          disabled={submitting}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          loading={submitting}
          loadingLabel="Submitting"
          onClick={onSubmit}
        >
          Submit for Verification
        </Button>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  icon: Icon,
  rows,
  onEdit,
}: {
  title: string;
  icon: typeof User;
  rows: [string, string | undefined][];
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--kx-radius-md)] border border-line">
      <div className="flex items-center gap-3 bg-surface-nested px-4 py-3">
        <Icon className="size-4 shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="type-card-title text-ink">{title}</span>
          <ChevronDown
            className={cn(
              "size-4 text-ink-muted transition-transform duration-[250ms]",
              open && "rotate-180",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="type-meta shrink-0 font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
        >
          Edit
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.dl
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitions.card}
            className="overflow-hidden"
          >
            <div className="divide-y divide-line px-4">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <dt className="type-meta shrink-0 text-ink-muted">{label}</dt>
                  <dd
                    className={cn(
                      "type-meta min-w-0 truncate text-right font-medium",
                      value ? "text-ink" : "text-ink-muted italic",
                    )}
                  >
                    {value || "Not provided"}
                  </dd>
                </div>
              ))}
            </div>
          </motion.dl>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
