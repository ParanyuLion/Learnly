-- CreateTable
CREATE TABLE "FlashcardSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    CONSTRAINT "Flashcard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "FlashcardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
