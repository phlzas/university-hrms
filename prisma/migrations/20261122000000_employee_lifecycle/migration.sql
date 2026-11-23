ALTER TABLE Employee ADD COLUMN email TEXT;
ALTER TABLE Employee ADD COLUMN createdBy TEXT;
ALTER TABLE Employee ADD COLUMN updatedBy TEXT;
ALTER TABLE Employee ADD COLUMN deletedAt DATETIME;
ALTER TABLE Employee ADD COLUMN restoredAt DATETIME;

ALTER TABLE User ADD COLUMN employeeId TEXT;
ALTER TABLE User ADD COLUMN provisionedBy TEXT;
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

CREATE TABLE "InviteToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "InviteToken_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "InviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InviteToken_userId_idx" ON "InviteToken"("userId");
