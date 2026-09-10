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
  ChevronDown,
  HandHeart,
  IdCard,
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
import { ChoiceCards } from "@/components/ui/segmented-control";
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
import { TRACK_DESCRIPTION } from "@/constants/status-presentation";
import { transitions } from "@/lib/motion";
import {
  identitySchema,
  licenceSchema,
  vehicleSchema,
  LICENCE_CLASSES,
  SEAT_OPTIONS,
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdentityValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      fullName: identity.fullName ?? "",
      memberId: identity.memberId ?? "",
      phone: identity.phone ?? "",
      address: identity.address ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setIdentity(values);
        onNext();
      })}
      noValidate
    >
      <StepHeading
        title="Who you are"
        description="These details are checked against your membership record."
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
          label="Member ID"
          placeholder="KOI-2017-001188"
          icon={IdCard}
          error={errors.memberId?.message}
          required
          {...register("memberId")}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <DocumentUpload
            type={DocumentType.GOVERNMENT_ID}
            label="Government ID"
            hint="NIN slip, passport or voter's card"
            document={documents[DocumentType.GOVERNMENT_ID]}
            onUploaded={(doc) => setDocument(DocumentType.GOVERNMENT_ID, doc)}
            onRemoved={() => setDocument(DocumentType.GOVERNMENT_ID, null)}
          />
          <DocumentUpload
            type={DocumentType.PROFILE_PHOTO}
            label="Profile photo"
            hint="A clear, recent photo of your face"
            document={documents[DocumentType.PROFILE_PHOTO]}
            onUploaded={(doc) => setDocument(DocumentType.PROFILE_PHOTO, doc)}
            onRemoved={() => setDocument(DocumentType.PROFILE_PHOTO, null)}
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
          />
        ))}
      </div>

      {missing.length > 0 ? (
        <p className="type-meta mt-4 text-ink-muted">
          {missing.length} of {VEHICLE_DOCUMENTS.length} still to upload. You
          can continue and add them before submitting.
        </p>
      ) : null}

      <StepActions onBack={onBack} type="button" onNext={onNext} />
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
  const track = useApplicationStore((state) => state.track);
  const setTrack = useApplicationStore((state) => state.setTrack);

  return (
    <div>
      <StepHeading
        title="Choose your track"
        description="You can request a switch later, though it needs approval rather than happening instantly."
      />

      <ChoiceCards
        label="Driver track"
        value={track}
        onChange={setTrack}
        options={[
          {
            value: DriverTrack.VOLUNTEER,
            label: "Volunteer",
            icon: HandHeart,
            description: "Serve through your journey.",
            detail:
              "Offer seats you already have. No fare is charged and no payment is collected.",
          },
          {
            value: DriverTrack.PROFESSIONAL,
            label: "Professional",
            icon: Wallet,
            description: "Earn through verified transportation.",
            detail:
              "Paid journeys with the fare agreed upfront, receipts, and a record of earnings.",
          },
        ]}
      />

      <div className="mt-5 flex items-center justify-center gap-2">
        <VerifiedBadge label="Same verification standard" tone="forest" size="md" />
      </div>

      {!track ? (
        <p className="type-meta mt-4 text-center text-ink-muted">
          Choose a track to continue.
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
          disabled={!track}
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
  const { identity, licence, vehicle, track, documents } = useApplicationStore();

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
            ["Member ID", identity.memberId],
            ["Phone", identity.phone],
            ["Address", identity.address],
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
          title="Track"
          icon={track === DriverTrack.PROFESSIONAL ? Wallet : HandHeart}
          onEdit={() => onEditStep(4)}
          rows={[
            [
              "Chosen track",
              track === DriverTrack.PROFESSIONAL
                ? "Professional"
                : track === DriverTrack.VOLUNTEER
                  ? "Volunteer"
                  : undefined,
            ],
            ["What that means", track ? TRACK_DESCRIPTION[track] : undefined],
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
