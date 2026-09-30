-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."IntentType" AS ENUM ('DATING', 'FRIENDSHIP', 'NEW_IN_TOWN');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'SELF_DESCRIBED');

-- CreateEnum
CREATE TYPE "public"."DietaryPreference" AS ENUM ('VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'HALAL', 'KOSHER', 'JAIN', 'GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE');

-- CreateEnum
CREATE TYPE "public"."AlcoholPreference" AS ENUM ('DRINKS', 'SOMETIMES', 'NEVER');

-- CreateEnum
CREATE TYPE "public"."AlcoholPolicy" AS ENUM ('ALCOHOL_FREE', 'ALCOHOL_OPTIONAL', 'ALCOHOL_CENTRIC');

-- CreateEnum
CREATE TYPE "public"."ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."HostStatus" AS ENUM ('APPLIED', 'APPROVED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."EventFormat" AS ENUM ('FOOD_DRINK', 'OUTDOOR', 'ARTS_CRAFTS', 'GAMES', 'FITNESS', 'LEARNING', 'MUSIC', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EventTag" AS ENUM ('FRIENDSHIP_FIRST', 'OPEN_TO_DATING', 'NEWCOMER_FRIENDLY', 'BEGINNER_FRIENDLY');

-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MatchingWindowStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('UNKNOWN', 'CHECKED_IN', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."CancellationSource" AS ENUM ('USER', 'HOST', 'SYSTEM', 'MODERATOR');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('RAZORPAY', 'FREE');

-- CreateEnum
CREATE TYPE "public"."RefundStatus" AS ENUM ('NONE', 'PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."InteractionChoice" AS ENUM ('FRIENDSHIP', 'DATING', 'EITHER', 'PASS');

-- CreateEnum
CREATE TYPE "public"."MatchType" AS ENUM ('FRIENDSHIP', 'DATING');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('ACTIVE', 'UNMATCHED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."ChannelMessageKind" AS ENUM ('CHAT', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ReportCategory" AS ENUM ('HARASSMENT', 'SAFETY_THREAT', 'SEXUAL_MISCONDUCT', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'UNDERAGE', 'HOST_MISCONDUCT', 'VENUE_UNSAFE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('OPEN', 'TRIAGED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phoneE164" TEXT,
    "dateOfBirth" DATE,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ONBOARDING',
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "verificationGesture" VARCHAR(40),
    "verificationSelfieKey" TEXT,
    "verificationIdKey" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "expoPushToken" TEXT,
    "gender" "public"."Gender",
    "datingPreferences" "public"."Gender"[],
    "lastActiveAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserIntent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "intent" "public"."IntentType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "bio" VARCHAR(300),
    "interests" TEXT[],
    "languages" TEXT[],
    "budgetMinMinor" INTEGER,
    "budgetMaxMinor" INTEGER,
    "accessibilityNeeds" TEXT[],
    "dietary" "public"."DietaryPreference"[],
    "alcohol" "public"."AlcoholPreference",
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."ProfilePhoto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "moderationStatus" "public"."ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatchmentArea" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "emergencyNumber" VARCHAR(16) NOT NULL,
    "boundary" geometry(MultiPolygon, 4326),
    "centroid" geography(Point, 4326),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatchmentArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserCatchment" (
    "userId" UUID NOT NULL,
    "catchmentId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCatchment_pkey" PRIMARY KEY ("userId","catchmentId")
);

-- CreateTable
CREATE TABLE "public"."Venue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catchmentId" UUID NOT NULL,
    "createdByHostId" UUID,
    "name" TEXT NOT NULL,
    "publicAreaLabel" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "location" geography(Point, 4326),
    "accessibility" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Host" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "status" "public"."HostStatus" NOT NULL DEFAULT 'APPLIED',
    "bio" VARCHAR(500),
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "payoutRef" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hostId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "catchmentId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "coverImageKey" TEXT,
    "format" "public"."EventFormat" NOT NULL,
    "tags" "public"."EventTag"[],
    "languages" TEXT[],
    "dietaryOptions" "public"."DietaryPreference"[],
    "alcoholPolicy" "public"."AlcoholPolicy" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "minAttendees" SMALLINT NOT NULL DEFAULT 4,
    "maxAttendees" SMALLINT NOT NULL DEFAULT 8,
    "bookedCount" SMALLINT NOT NULL DEFAULT 0,
    "costMinor" INTEGER NOT NULL,
    "platformFeeMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "public"."EventStatus" NOT NULL DEFAULT 'DRAFT',
    "cancelledReason" TEXT,
    "checkInCode" CHAR(4) NOT NULL DEFAULT lpad((floor(random() * 10000))::int::text, 4, '0'),
    "matchingStatus" "public"."MatchingWindowStatus" NOT NULL DEFAULT 'NOT_OPEN',
    "matchingOpensAt" TIMESTAMPTZ(3),
    "matchingClosesAt" TIMESTAMPTZ(3),
    "channelPurgedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventBooking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "public"."BookingStatus" NOT NULL,
    "attendance" "public"."AttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "checkedInAt" TIMESTAMPTZ(3),
    "waitlistPosition" INTEGER,
    "holdExpiresAt" TIMESTAMPTZ(3),
    "amountMinor" INTEGER NOT NULL,
    "platformFeeMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "refundStatus" "public"."RefundStatus" NOT NULL DEFAULT 'NONE',
    "refundAmountMinor" INTEGER,
    "providerRefundId" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationSource" "public"."CancellationSource",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PostEventInteraction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "choice" "public"."InteractionChoice" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostEventInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hostRating" SMALLINT NOT NULL,
    "venueSafetyRating" SMALLINT NOT NULL,
    "feltSafe" BOOLEAN NOT NULL,
    "comment" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "type" "public"."MatchType" NOT NULL,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedById" UUID,
    "endedAt" TIMESTAMPTZ(3),
    "lastMessageAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matchId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "moderationStatus" "public"."ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventChannelMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "senderId" UUID,
    "kind" "public"."ChannelMessageKind" NOT NULL DEFAULT 'CHAT',
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SafetyReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporterId" UUID NOT NULL,
    "subjectUserId" UUID,
    "eventId" UUID,
    "matchId" UUID,
    "category" "public"."ReportCategory" NOT NULL,
    "severity" "public"."ReportSeverity" NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'OPEN',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(4000) NOT NULL,
    "evidenceKeys" TEXT[],
    "assignedToId" UUID,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBlock" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" VARCHAR(200) NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "public"."User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserIntent_userId_intent_key" ON "public"."UserIntent"("userId", "intent");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePhoto_profileId_position_key" ON "public"."ProfilePhoto"("profileId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CatchmentArea_slug_key" ON "public"."CatchmentArea"("slug");

-- CreateIndex
CREATE INDEX "CatchmentArea_countryCode_cityName_idx" ON "public"."CatchmentArea"("countryCode", "cityName");

-- CreateIndex
CREATE INDEX "UserCatchment_catchmentId_idx" ON "public"."UserCatchment"("catchmentId");

-- CreateIndex
CREATE INDEX "Venue_catchmentId_idx" ON "public"."Venue"("catchmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Host_userId_key" ON "public"."Host"("userId");

-- CreateIndex
CREATE INDEX "Event_catchmentId_status_startsAt_idx" ON "public"."Event"("catchmentId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_hostId_startsAt_idx" ON "public"."Event"("hostId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_status_endsAt_idx" ON "public"."Event"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_providerOrderId_key" ON "public"."EventBooking"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_providerPaymentId_key" ON "public"."EventBooking"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_idempotencyKey_key" ON "public"."EventBooking"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_providerRefundId_key" ON "public"."EventBooking"("providerRefundId");

-- CreateIndex
CREATE INDEX "EventBooking_eventId_status_idx" ON "public"."EventBooking"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventBooking_userId_status_idx" ON "public"."EventBooking"("userId", "status");

-- CreateIndex
CREATE INDEX "EventBooking_status_holdExpiresAt_idx" ON "public"."EventBooking"("status", "holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_eventId_userId_key" ON "public"."EventBooking"("eventId", "userId");

-- CreateIndex
CREATE INDEX "PostEventInteraction_eventId_toUserId_idx" ON "public"."PostEventInteraction"("eventId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PostEventInteraction_eventId_fromUserId_toUserId_key" ON "public"."PostEventInteraction"("eventId", "fromUserId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EventFeedback_eventId_userId_key" ON "public"."EventFeedback"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Match_userBId_idx" ON "public"."Match"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_userAId_userBId_key" ON "public"."Match"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "Message_matchId_createdAt_idx" ON "public"."Message"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientId_key" ON "public"."Message"("senderId", "clientId");

-- CreateIndex
CREATE INDEX "EventChannelMessage_eventId_createdAt_idx" ON "public"."EventChannelMessage"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyReport_status_severity_createdAt_idx" ON "public"."SafetyReport"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyReport_subjectUserId_idx" ON "public"."SafetyReport"("subjectUserId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "public"."UserBlock"("blockedId");

-- CreateIndex
CREATE INDEX "Notification_sentAt_createdAt_idx" ON "public"."Notification"("sentAt", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."UserIntent" ADD CONSTRAINT "UserIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCatchment" ADD CONSTRAINT "UserCatchment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCatchment" ADD CONSTRAINT "UserCatchment_catchmentId_fkey" FOREIGN KEY ("catchmentId") REFERENCES "public"."CatchmentArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venue" ADD CONSTRAINT "Venue_catchmentId_fkey" FOREIGN KEY ("catchmentId") REFERENCES "public"."CatchmentArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venue" ADD CONSTRAINT "Venue_createdByHostId_fkey" FOREIGN KEY ("createdByHostId") REFERENCES "public"."Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Host" ADD CONSTRAINT "Host_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_catchmentId_fkey" FOREIGN KEY ("catchmentId") REFERENCES "public"."CatchmentArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventBooking" ADD CONSTRAINT "EventBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventBooking" ADD CONSTRAINT "EventBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostEventInteraction" ADD CONSTRAINT "PostEventInteraction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostEventInteraction" ADD CONSTRAINT "PostEventInteraction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostEventInteraction" ADD CONSTRAINT "PostEventInteraction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventFeedback" ADD CONSTRAINT "EventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventFeedback" ADD CONSTRAINT "EventFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventChannelMessage" ADD CONSTRAINT "EventChannelMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventChannelMessage" ADD CONSTRAINT "EventChannelMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyReport" ADD CONSTRAINT "SafetyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyReport" ADD CONSTRAINT "SafetyReport_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyReport" ADD CONSTRAINT "SafetyReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyReport" ADD CONSTRAINT "SafetyReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyReport" ADD CONSTRAINT "SafetyReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

