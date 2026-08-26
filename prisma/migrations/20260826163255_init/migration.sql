-- CreateTable
CREATE TABLE "GameSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "left" TEXT NOT NULL,
    "right" TEXT NOT NULL,
    CONSTRAINT "Pair_setId_fkey" FOREIGN KEY ("setId") REFERENCES "GameSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
