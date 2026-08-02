-- A task may have one optional blocker. Retain the lowest immutable id when
-- consolidating legacy multi-blocker rows before applying the constraint.
DELETE FROM "dependencies"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (PARTITION BY "blockedId" ORDER BY "id" ASC) AS "rank"
    FROM "dependencies"
  ) AS "ranked_dependencies"
  WHERE "rank" > 1
);

CREATE UNIQUE INDEX "dependencies_blockedId_key" ON "dependencies"("blockedId");