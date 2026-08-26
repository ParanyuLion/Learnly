-- CreateTable
CREATE TABLE "SortSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SortCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "SortCategory_setId_fkey" FOREIGN KEY ("setId") REFERENCES "SortSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SortItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "SortItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "SortSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SortItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SortCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
