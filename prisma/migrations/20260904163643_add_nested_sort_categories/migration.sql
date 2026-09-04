-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SortCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "SortCategory_setId_fkey" FOREIGN KEY ("setId") REFERENCES "SortSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SortCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SortCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SortCategory" ("id", "name", "setId") SELECT "id", "name", "setId" FROM "SortCategory";
DROP TABLE "SortCategory";
ALTER TABLE "new_SortCategory" RENAME TO "SortCategory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
