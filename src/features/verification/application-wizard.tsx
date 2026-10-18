"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Car,
  Check,
  ChevronDown,
  IdCard,
  Globe2,
  LockKeyhole,
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
import { Checkbox, Input, PasswordInput, Select } from "@/components/ui/input";
import { StepIndicator } from "@/components/ui/progress";
import { SafetyNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { DocumentUpload } from "@/components/verification/document-upload";
import { ApplicationUploadProgress, type ApplicationUploadState } from "@/components/verification/application-upload-progress";
import { useApplicationStore } from "@/stores/application-store";
import { APPLICATION_STEPS, REQUIRED_DOCUMENTS } from "@/mocks/verification";
import { DocumentStatus, DocumentType, DriverTrack } from "@/types/enums";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { FreebusError, liveAuth } from "@/services/freebus-api";
import { buildDriverRegistration, DriverApplicationError } from "./driver-registration";
import { transitions } from "@/lib/motion";
import {
  identitySchema,
  licenceSchema,
  vehicleSchema,
  accountCredentialsSchema,
  LICENCE_CLASSES,
  KOINONIA_DEPARTMENTS,
  type IdentityValues,
  type LicenceValues,
  type VehicleValues,
  type AccountCredentials,
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
  const { toast } = useToast();

  const stepIndex = useApplicationStore((state) => state.stepIndex);
  const setStepIndex = useApplicationStore((state) => state.setStepIndex);
  const next = useApplicationStore((state) => state.next);
  const back = useApplicationStore((state) => state.back);
  const markSubmitted = useApplicationStore((state) => state.markSubmitted);

  const complete = useApplicationStore((state) => state.submitted);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submissionLock = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const [uploadState, setUploadState] = useState<ApplicationUploadState | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(1);

  const steps = APPLICATION_STEPS.map((item) => item.id === "track" ? { ...item, label: "Driving" } : item);
  const step = steps[stepIndex];

  function goNext() {
    setDirection(1);
    next(APPLICATION_STEPS.length);
  }

  function goBack() {
    setDirection(-1);
    back();
  }

  async function submit(credentials: AccountCredentials) {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSubmitting(true);
    setFormError(null);
    const draft = useApplicationStore.getState();
    const files = Object.values(draft.documents)
      .filter((doc) => doc.base64 && (doc.type !== DocumentType.GUARANTOR_PHOTO || draft.identity.workerStatus === "NO"))
      .map((doc) => ({ label: doc.label, sizeBytes: doc.sizeBytes ?? 0, originalSizeBytes: doc.originalSizeBytes ?? doc.sizeBytes ?? 0 }));
    setUploadState(LIVE_FREE_BUSES ? { phase: "checking", loadedBytes: 0, totalBytes: 0, deltaBytes: 0, files } : null);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      // Yield so the progress screen can paint before validating/serializing files.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (controller.signal.aborted) return;
      const payload = buildDriverRegistration(draft, credentials);
      if (LIVE_FREE_BUSES) {
        const totalBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
        setUploadState({ phase: "uploading", loadedBytes: 0, totalBytes, deltaBytes: 0, files });
        const user = await liveAuth.register(payload, {
          signal: controller.signal,
          onProgress: (progress) => setUploadState((state) => state && ({ ...state, ...progress })),
        });
        if (!user?.id) throw new FreebusError("Registration did not return an account. Please contact support before trying again.", 502);
        setUploadState((state) => state && ({ ...state, phase: "success", loadedBytes: state.totalBytes }));
      }
      markSubmitted();
      toast({ title: LIVE_FREE_BUSES ? "Driver account created" : "Application preview complete", description: LIVE_FREE_BUSES ? "Sign in with your email or username." : "Demo mode: no account was created or documents submitted.", tone: "success" });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof DriverApplicationError) {
        setDirection(-1);
        setStepIndex(error.stepIndex);
      }
      const message = error instanceof FreebusError && error.status === 413
        ? "The server rejected the application because it is too large. Replace large PDFs with smaller files or photos. If this continues, contact support."
        : error instanceof FreebusError || error instanceof DriverApplicationError ? error.message : "We couldn't submit your application. Please try again.";
      if (error instanceof FreebusError && error.status === 413) {
        setDirection(-1);
        setStepIndex(3);
      }
      setFormError(message);
      setUploadState((state) => state && ({ ...state, phase: "error", failedAt: state.phase === "checking" ? "checking" : state.phase === "confirming" ? "confirming" : "uploading", error: message, status: error instanceof FreebusError ? error.status : undefined }));
    } finally {
      uploadController.current = null;
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="premium-driver-layout">
      <ApplicationUploadProgress state={uploadState} onClose={() => { if (!submissionLock.current) setUploadState(null); }} />
      <aside className="premium-driver-story">
        <p className="mb-4 text-xs font-semibold tracking-[.18em] text-ink-muted uppercase">K-Rides / Drive with us</p>
        <h1 className="text-4xl font-medium leading-[1.08] tracking-[-.055em] text-ink sm:text-5xl">Your next chapter.<br /><span className="text-gold-800 dark:text-gold-300">Behind the wheel.</span></h1>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-secondary">Bring your ambition. We’ll guide you through the details, one simple step at a time.</p>
        <div className="relative mt-7 hidden aspect-[4/3] overflow-hidden rounded-[28px] sm:block">
          <Image src="/images/krides-driver-premium.webp" alt="A welcoming professional driver beside a graphite sedan." fill sizes="(max-width: 1023px) 90vw, 35vw" className="object-cover" />
        </div>
        <ol className="mt-6 hidden space-y-4 lg:block" aria-label="Your application journey">
          {steps.map((item, index) => <li key={item.id} className="flex items-center gap-3 text-sm"><span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold", index <= stepIndex ? "bg-forest-900 text-white" : "bg-surface-nested text-ink-muted")}>{index < stepIndex ? <Check className="size-3.5" aria-hidden /> : index + 1}</span><span className={index === stepIndex ? "font-semibold text-ink" : "text-ink-secondary"}>{item.label}</span>{index < stepIndex ? <span className="sr-only">Completed</span> : null}</li>)}
        </ol>
      </aside>
      <div className="min-w-0">
      {!LIVE_FREE_BUSES ? <div className="mb-6 rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-secondary"><strong className="text-ink">Application preview.</strong> Demo mode does not create an account or submit documents.</div> : null}
      {formError ? <p role="alert" className="mb-6 rounded-2xl border border-danger-500/25 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-danger-500/10 dark:text-red-200">{formError}</p> : null}
      <div className="mb-6" role="status">
        <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-ink">{complete ? LIVE_FREE_BUSES ? "Application submitted" : "Preview complete" : stepIndex >= 4 ? "You’re almost there" : stepIndex > 0 ? "Looking good. Keep going." : "Let’s get you started"}</span><span className="text-xs text-ink-secondary">Step {stepIndex + 1} of {steps.length}</span></div>
        <div className="premium-progress" role="progressbar" aria-label="Completed application steps" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={complete ? steps.length : stepIndex}><span style={{ width: `${(complete ? 1 : stepIndex / steps.length) * 100}%` }} /></div>
      </div>
      <StepIndicator
        steps={steps}
        showProgress={false}
        currentIndex={stepIndex}
        onStepClick={submitting || complete ? undefined : (index) => {
          setDirection(index > stepIndex ? 1 : -1);
          setStepIndex(index);
        }}
        className="mb-6"
      />

      {complete ? <Card radius="xl"><span className="mb-5 grid size-14 place-items-center rounded-full bg-gold-100 text-gold-800"><Check className="size-7" aria-hidden /></span><h2 className="type-section-title text-ink">{LIVE_FREE_BUSES ? "Your driver account is ready." : "You’ve explored the full application."}</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{LIVE_FREE_BUSES ? "Your application has been submitted. Sign in with your email or username to access your account. Your documents and vehicle still need approval before you can drive." : "Demo mode: your driver account has not been created and no documents were sent."}</p><Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-gold-800 dark:text-gold-300">Sign in <ArrowRight className="ml-2 size-4" aria-hidden /></Link></Card> : <Card radius="xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            ref={stepContentRef}
            tabIndex={-1}
            onAnimationComplete={() => { if (stepIndex > 0) stepContentRef.current?.focus(); }}
            key={step.id}
            custom={direction}
            initial={stepIndex === 0 ? false : { opacity: 0, x: direction * 24 }}
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
                  if (submissionLock.current) return;
                  setDirection(-1);
                  setStepIndex(index);
                }}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </Card>}
      </div>
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
  disabled = false,
}: {
  onBack?: () => void;
  nextLabel?: string;
  submitting?: boolean;
  type?: "submit" | "button";
  onNext?: () => void;
  disabled?: boolean;
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
        disabled={disabled}
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
      username: identity.username ?? "",
      country: identity.country ?? "Nigeria",
      city: identity.city ?? "",
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
    !documents[DocumentType.GOVERNMENT_ID]?.base64 ||
    !documents[DocumentType.PROFILE_PHOTO]?.base64 ||
    (workerStatus === "NO" && !documents[DocumentType.GUARANTOR_PHOTO]?.base64);

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
        <Input label="Username" autoComplete="username" icon={AtSign} error={errors.username?.message} required {...register("username")} />
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

        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="City / area" autoComplete="address-level2" icon={MapPin} error={errors.city?.message} required {...register("city")} />
          <Input label="Country" autoComplete="country-name" icon={Globe2} error={errors.country?.message} required {...register("country")} />
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
  const missingLicence = !documents[DocumentType.DRIVERS_LICENCE]?.base64;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LicenceValues>({
    resolver: zodResolver(licenceSchema),
    defaultValues: {
      licenceNumber: licence.licenceNumber ?? "",
      licenceClass: licence.licenceClass,
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
  const [showMissing, setShowMissing] = useState(false);
  const vehiclePhoto = documents[DocumentType.VEHICLE_PHOTO];
  const photoUploading = vehiclePhoto?.status === DocumentStatus.UPLOADING;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (photoUploading) return;
        if (!vehiclePhoto?.base64) {
          setShowMissing(true);
          return;
        }
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
          <Input
            label="Passenger seats"
            type="number"
            min={1}
            step={1}
            placeholder="4"
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
          document={vehiclePhoto}
          onUploaded={(doc) => setDocument(DocumentType.VEHICLE_PHOTO, doc)}
          onRemoved={() => setDocument(DocumentType.VEHICLE_PHOTO, null)}
          missingError={
            showMissing ? "Upload a photo of your vehicle to continue" : undefined
          }
        />
      </div>

      <StepActions onBack={onBack} disabled={photoUploading} />
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
  const missing = VEHICLE_DOCUMENTS.filter((doc) => !documents[doc.type]?.base64);

  return (
    <div>
      <StepHeading
        title="Vehicle documents"
        description="Upload your vehicle registration, insurance and roadworthiness certificate."
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
          {missing.length} of {VEHICLE_DOCUMENTS.length} still to add. All
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

function TrackStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const tracks = useApplicationStore((state) => state.tracks);
  const toggleTrack = useApplicationStore((state) => state.toggleTrack);
  const [showMissing, setShowMissing] = useState(false);
  return <div>
    <StepHeading title="How would you like to drive?" description="Choose one or both tracks. Each requires the same documents and verification." />
    <div className="space-y-4 rounded-2xl border border-line bg-surface-nested p-6">
      <Checkbox label="Volunteer — offer free journeys to the community" checked={tracks.includes(DriverTrack.VOLUNTEER)} onChange={() => toggleTrack(DriverTrack.VOLUNTEER)} />
      <Checkbox label="Professional — accept paid rides" checked={tracks.includes(DriverTrack.PROFESSIONAL)} onChange={() => toggleTrack(DriverTrack.PROFESSIONAL)} />
      {showMissing && tracks.length === 0 ? <p role="alert" className="text-sm text-danger-600">Choose at least one driving track.</p> : null}
    </div>
    <StepActions onBack={onBack} type="button" onNext={() => { if (!tracks.length) { setShowMissing(true); return; } onNext(); }} nextLabel="Review my details" />
  </div>;
}

/* --- 06 Review ------------------------------------------------------------ */

function ReviewStep({
  onBack,
  onSubmit,
  submitting,
  onEditStep,
}: {
  onBack: () => void;
  onSubmit: (credentials: AccountCredentials) => Promise<void>;
  submitting: boolean;
  onEditStep: (index: number) => void;
}) {
  const { identity, licence, vehicle, documents, tracks } = useApplicationStore();
  const { register, handleSubmit, formState: { errors } } = useForm<AccountCredentials>({
    resolver: zodResolver(accountCredentialsSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const uploaded = Object.keys(documents).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeading
        title="Review your application"
        description="One last look. Your details have stayed with you as you moved through these steps."
      />

      <div className="space-y-3">
        <ReviewSection
          title="Identity"
          icon={User}
          onEdit={() => onEditStep(0)}
          rows={[
            ["Full name", identity.fullName],
            ["Email", identity.email],
            ["Username", identity.username],
            ["Phone", identity.phone],
            ["NIN", identity.nin ? `•••••••${identity.nin.slice(-4)}` : undefined],
            ["Address", identity.address],
            ["City / area", identity.city],
            ["Country", identity.country],
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
            ["Added", `${uploaded} document${uploaded === 1 ? "" : "s"}`],
            ...Object.values(documents).map(
              (doc) => [doc.label, doc.fileName] as [string, string | undefined],
            ),
          ]}
        />

        <ReviewSection title="Driving tracks" icon={Wallet} onEdit={() => onEditStep(4)} rows={[["Selected", tracks.map((track) => track === DriverTrack.VOLUNTEER ? "Volunteer" : "Professional").join(" and ")], ["Next step", "Document review and vehicle inspection"]]} />
      </div>

      <fieldset disabled={submitting} className="mt-6 min-w-0 space-y-5">
        <legend className="mb-4 text-base font-semibold text-ink">Secure your account</legend>
        <PasswordInput label="Password" icon={LockKeyhole} autoComplete="new-password" required error={errors.password?.message} {...register("password")} />
        <PasswordInput label="Confirm password" icon={ShieldCheck} autoComplete="new-password" required error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Checkbox label={<>I accept the <Link href="/#terms" className="underline">terms of use</Link> and <Link href="/#privacy" className="underline">privacy notice</Link>.</>} error={errors.acceptedTerms?.message} {...register("acceptedTerms")} />
      </fieldset>

      <SafetyNote className="mt-5">
        {LIVE_FREE_BUSES ? "Submitting creates your driver account and sends your application for review. Document review and a physical vehicle inspection are required before you can drive." : "Demo mode: no documents will be sent and no driver account will be created."}
      </SafetyNote>

      <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          icon={ArrowLeft}
          onClick={onBack}
          disabled={submitting}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          loading={submitting}
          loadingLabel="Submitting"
        >
          {LIVE_FREE_BUSES ? "Create driver account" : "Complete application preview"}
        </Button>
      </div>
    </form>
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
